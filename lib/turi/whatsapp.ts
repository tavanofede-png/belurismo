import { after } from "next/server";
import { createHash } from "node:crypto";
import { toFile } from "openai";
import { AppError, required, safeEqual } from "./security";
import { redis, loadAccount, mutateAccount, cloudConfigured, rateLimit } from "./storage";
import { emptyWorkspace, money, type Attachment, type Message } from "./domain";
import type { BeloTravelHotel } from "./belo-travel";
import { buildConversationPanels } from "./conversation-panels";
import { renderBeloCard, renderHotelCard, renderOptionCard, renderTripSummary, type BeloCardImage } from "./whatsapp-cards";
import { openaiClient, runAgent, validateAttachments } from "./agent";
import { mergeTravelOptions, optionToText, readTravelOptions, type TravelOption } from "./travel-options";

// ponytail: demo channel over Evolution API (Baileys). Each sender is its own trip; no web linking.
// Real users need WhatsApp Cloud API: swap parseIncoming + sendWhatsapp.

type Media = { mimetype?: string; caption?: string; fileName?: string; fileLength?: number | string };
type EvolutionMessage = {
  key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: Media;
    documentMessage?: Media;
    documentWithCaptionMessage?: { message?: { documentMessage?: Media } };
    audioMessage?: Media;
    base64?: string;
  };
};
export type Incoming = {
  id: string;
  jid: string;
  text: string;
  media?: { kind: "file" | "audio"; type: string; name: string; base64?: string };
};

export const whatsappConfigured = () =>
  Boolean(
    process.env.EVOLUTION_URL &&
    process.env.EVOLUTION_API_KEY &&
    process.env.EVOLUTION_INSTANCE &&
    process.env.WHATSAPP_WEBHOOK_SECRET &&
    cloudConfigured(),
  );

export function parseIncoming(data: EvolutionMessage): Incoming | undefined {
  // Newer chats address by LID; the phone JID then comes in remoteJidAlt.
  const raw = data.key?.remoteJid || "",
    jid = raw.endsWith("@lid") && /@s\.whatsapp\.net$/.test(data.key?.remoteJidAlt || "") ? data.key!.remoteJidAlt! : raw,
    id = data.key?.id || "",
    m = data.message;
  // Private chats only: no groups, broadcasts, status or our own messages.
  if (!m || !id || data.key?.fromMe || !/^\d+@(s\.whatsapp\.net|lid)$/.test(jid)) return;
  const document = m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage,
    file = m.imageMessage || document,
    text = (m.conversation || m.extendedTextMessage?.text || file?.caption || "").trim();
  const media = m.audioMessage
    ? { kind: "audio" as const, type: m.audioMessage.mimetype || "audio/ogg", name: "nota.ogg", base64: m.base64 }
    : file
      ? {
          kind: "file" as const,
          type: (file.mimetype || "image/jpeg").split(";")[0],
          name: document?.fileName || "comprobante.jpg",
          base64: m.base64,
        }
      : undefined;
  if (!text && !media) return;
  return { id, jid, text, ...(media ? { media } : {}) };
}

// Comma-separated digits (e.g. 5491126883748). Empty = everyone. LIDs without a phone JID never match.
export function isAllowed(jid: string, list = process.env.WHATSAPP_ALLOWED || "") {
  const allowed = list.split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);
  return !allowed.length || allowed.includes(jid.replace(/@s\.whatsapp\.net$/, ""));
}

export function toWhatsappText(markdown: string) {
  return markdown
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}

const numberOf = (jid: string) => (jid.endsWith("@lid") ? jid : jid.split("@")[0]);
async function evolution(path: string, body: object) {
  const response = await fetch(
    `${required("EVOLUTION_URL").replace(/\/$/, "")}/${path}/${required("EVOLUTION_INSTANCE")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: required("EVOLUTION_API_KEY") },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new AppError("WhatsApp no pudo completar la operación.", 502);
}
export async function sendWhatsapp(jid: string, text: string) {
  const number = numberOf(jid),
    body = toWhatsappText(text);
  for (let index = 0; index < body.length; index += 3800)
    await evolution("message/sendText", { number, text: body.slice(index, index + 3800) });
}

// A branded card rendered on demand; if rendering fails, the fallback (raw photo + caption, or text) is sent.
type Card = { render: () => Promise<string>; caption: string; fallback: { url?: string; text: string } };
type WidgetHotel = BeloTravelHotel & { url: string };
export function hotelCaption(hotel: WidgetHotel) {
  return [
    `*${hotel.name}*${hotel.stars ? ` ${"⭐".repeat(hotel.stars)}` : ""}`,
    hotel.address,
    `${hotel.ratingLabel} ${hotel.rating}`,
    `${money(hotel.price)} por noche${hotel.discount ? ` (antes ${money(hotel.listPrice)}, -${hotel.discount}%)` : ""}`,
    `Ver en belo travel: ${hotel.url}`,
  ].join("\n");
}
// One message per card, in order. Captions carry only what must stay tappable (links).
async function sendCards(jid: string, cards: Card[]) {
  for (const card of cards) {
    try {
      const media = await card.render();
      await evolution("message/sendMedia", { number: numberOf(jid), mediatype: "image", mimetype: "image/png", fileName: "turi.png", media, caption: toWhatsappText(card.caption) });
    } catch {
      await (card.fallback.url
        ? evolution("message/sendMedia", { number: numberOf(jid), mediatype: "image", media: card.fallback.url, caption: toWhatsappText(card.fallback.text) })
        : Promise.reject()
      ).catch(() => sendWhatsapp(jid, card.fallback.text));
    }
  }
}

function attachmentOf(media: NonNullable<Incoming["media"]>): Attachment {
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(media.type))
    throw new AppError("Mandame un PDF o una imagen PNG, JPEG o WebP.");
  if (!media.base64) throw new AppError("No pude descargar ese archivo. Probá mandarlo de nuevo.");
  const size = Buffer.from(media.base64, "base64").length;
  if (size > 2_500_000) throw new AppError("El comprobante debe pesar hasta 2,5 MB.");
  const attachment = { name: media.name, type: media.type, size, data: `data:${media.type};base64,${media.base64}` };
  validateAttachments([attachment]);
  return attachment;
}
async function transcribe(media: NonNullable<Incoming["media"]>) {
  if (!media.base64) throw new AppError("No pude descargar el audio. Probá mandarlo de nuevo.");
  const bytes = Buffer.from(media.base64, "base64");
  if (bytes.length > 10_000_000) throw new AppError("El audio es muy largo. Mandame uno más corto.");
  const result = await openaiClient().audio.transcriptions.create({
    model: "gpt-4o-mini-transcribe",
    file: await toFile(bytes, media.name, { type: media.type.split(";")[0] }),
  });
  return result.text.trim();
}

async function processMessage(incoming: Incoming) {
  const id = `wa-${createHash("sha256").update(incoming.jid).digest("hex").slice(0, 32)}`;
  await rateLimit(id, "whatsapp", 15);
  if (!process.env.OPENAI_API_KEY) {
    await sendWhatsapp(incoming.jid, "Falta activar la conexión de inteligencia artificial para poder responder.");
    return;
  }
  await evolution("chat/sendPresence", { number: numberOf(incoming.jid), presence: "composing", delay: 1200 }).catch(() => {});
  let text = incoming.text;
  const attachments: Attachment[] = [];
  if (incoming.media?.kind === "audio") text = [text, await transcribe(incoming.media)].filter(Boolean).join("\n");
  else if (incoming.media) attachments.push(attachmentOf(incoming.media));
  if (!text) text = "Revisá este comprobante y prepará los datos para mi viaje.";
  const account = await loadAccount(id),
    history = [...(account.messages || []).slice(-16), { id: crypto.randomUUID(), role: "user" as const, text }];
  let answer = "",
    needsReview = false,
    options: TravelOption[] = [],
    hotels: WidgetHotel[] = [],
    beloCards: BeloCardImage[] = [],
    showSummary = false;
  await runAgent(
    { id, state: account.workspace || emptyWorkspace(), messages: history, attachments, channel: "whatsapp privado" },
    (event) => {
      if (event.type === "delta") answer += String(event.text);
      if (event.type === "travel_options") options = mergeTravelOptions(options, readTravelOptions(event.options));
      if (event.type === "proposal" || event.type === "belo_review") needsReview = true;
      const widget = event.widget as { type?: string; kind?: string; hotels?: WidgetHotel[]; cards?: BeloCardImage[] } | undefined;
      if (event.type === "widget" && widget?.type === "belo-hotels") hotels = widget.hotels || [];
      if (event.type === "widget" && widget?.type === "cards") beloCards = [...beloCards, ...(widget.cards || [])];
      if (event.type === "widget" && widget?.type === "panel" && widget.kind === "summary") showSummary = true;
    },
  );
  if (needsReview) answer += "\n\nTe lo dejo como propuesta: por WhatsApp no se guardó ningún cambio ni se movió dinero.";
  if (!answer) answer = "No pude generar una respuesta. Intentá nuevamente.";
  // ponytail: top 3 hotels and 5 belo cards so the chat doesn't flood; the rest stay on the web.
  const state = account.workspace || emptyWorkspace();
  const cards: Card[] = [
    ...hotels.slice(0, 3).map((h) => ({ render: () => renderHotelCard(h), caption: `Ver en belo travel: ${h.url}`,
      fallback: { url: h.image ?? undefined, text: hotelCaption(h) } })),
    ...options.map((o) => ({ render: () => renderOptionCard(o), caption: `Fuente: ${o.sourceUrl}`,
      fallback: { url: o.image?.url, text: optionToText(o) } })),
    ...beloCards.slice(0, 5).map((c) => ({ render: () => renderBeloCard(c), caption: "",
      fallback: { text: `Tarjeta de ${c.holder}${c.lastFour ? ` terminada en ${c.lastFour}` : ""}: ${c.error || c.status}` } })),
    ...(showSummary ? [{ render: () => renderTripSummary(buildConversationPanels(state).summary), caption: "",
      fallback: { text: "No pude armar la imagen del resumen. Pedime el detalle por texto." } }] : []),
  ];
  await sendWhatsapp(incoming.jid, answer);
  await sendCards(incoming.jid, cards);
  const messages: Message[] = [
    ...history,
    { id: crypto.randomUUID(), role: "assistant" as const, text: answer, ...(options.length ? { options } : {}) },
  ].slice(-30);
  await mutateAccount(id, (latest) => ({ ...latest, messages, updatedAt: Date.now() }));
}

export async function receiveWhatsapp(request: Request) {
  if (
    !whatsappConfigured() ||
    !safeEqual(request.headers.get("x-turi-secret") || "", process.env.WHATSAPP_WEBHOOK_SECRET || "")
  )
    throw new AppError("Webhook no autorizado.", 403);
  const body = await request.text();
  // Media arrives inline as base64 (webhook base64: true); Vercel caps bodies at 4.5 MB.
  if (body.length > 4_500_000) throw new AppError("Evento demasiado grande.", 413);
  let event: { event?: string; data?: EvolutionMessage };
  try {
    event = JSON.parse(body);
  } catch {
    throw new AppError("Evento inválido.");
  }
  const incoming = event.event === "messages.upsert" && event.data ? parseIncoming(event.data) : undefined;
  if (!incoming || !isAllowed(incoming.jid)) return Response.json({ ok: true });
  if (!(await redis("SET", `turi:wa-msg:${incoming.id}`, "processing", "NX", "EX", 86400)))
    return Response.json({ ok: true });
  after(async () => {
    try {
      await processMessage(incoming);
    } catch (error) {
      await sendWhatsapp(
        incoming.jid,
        error instanceof AppError ? error.message : "No pude completar la consulta. Intentá nuevamente en un momento.",
      ).catch(() => {});
    }
  });
  return Response.json({ ok: true });
}
