import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import sharp from "sharp";
import { beloLogo } from "./belo-logo";
import { money } from "./domain";
import type { BeloTravelHotel } from "./belo-travel";
import type { TravelOption } from "./travel-options";
import type { ConversationPanels } from "./conversation-panels";

// Brand cards for WhatsApp, rendered with Satori (flexbox only, no grid).
const C = { violet: "#5300da", violetDark: "#4000aa", mint: "#00ffb2", lav: "#e5d9fb", soft: "#fbf9ff", ink: "#17131f", muted: "#6f657c" };
const SIZE = 1080;

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: "normal" };
let fonts: Promise<Font[]> | undefined;
// ponytail: Inter from jsDelivr cached per instance; on failure Satori falls back to its bundled font.
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    ([400, 600, 800] as const).map(async (weight) => {
      const response = await fetch(`https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-${weight}-normal.ttf`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("font");
      return { name: "Inter", data: await response.arrayBuffer(), weight, style: "normal" as const };
    }),
  ).catch(() => {
    fonts = undefined;
    return [];
  });
  return fonts;
}

// Satori's JPEG decoder garbles many CDN photos, so sharp re-encodes them to the exact box first.
// Any format sharp reads (JPEG, PNG, WebP, AVIF); bounded in time and size, else the card has no photo.
export async function photoData(url: string | null | undefined, width: number, height: number): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) return null;
    const jpeg = await sharp(bytes).resize(width, height, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

async function png(node: ReactElement, height = SIZE): Promise<string> {
  const loaded = await loadFonts();
  // Omitting fonts (not an empty list) is what makes Satori use its bundled fallback.
  const image = new ImageResponse(node, { width: SIZE, height, ...(loaded.length ? { fonts: loaded } : {}) });
  return Buffer.from(await image.arrayBuffer()).toString("base64");
}

const TuriFace = ({ size = 64 }: { size?: number }) => (
  <div style={{ display: "flex", width: size, height: size, borderRadius: size, background: C.violet, alignItems: "center", justifyContent: "center" }}>
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 34 34">
      <ellipse cx="11" cy="12" rx="2.5" ry="3.2" fill="#fff" />
      <ellipse cx="23" cy="12" rx="2.5" ry="3.2" fill="#fff" />
      <path d="M8 21Q17 30 26 21" stroke={C.mint} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  </div>
);

const Star = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" fill={C.violet} /></svg>
);
const Dot = ({ color }: { color: string }) => (
  <div style={{ display: "flex", width: 18, height: 18, borderRadius: 18, background: color, marginTop: 9, flexShrink: 0 }} />
);
const Footer = ({ label }: { label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: "auto" }}>
    <TuriFace size={56} />
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>Turi</span>
      <span style={{ fontSize: 22, color: C.muted }}>{label}</span>
    </div>
    <img alt="belo" src={beloLogo()} width={120} height={58} style={{ marginLeft: "auto" }} />
  </div>
);

const PHOTO_W = SIZE - 96;
const Photo = ({ src, height, badge }: { src: string | null; height: number; badge?: string }) => (
  <div style={{ display: "flex", position: "relative", width: "100%", height, borderRadius: 36, overflow: "hidden",
    background: `linear-gradient(135deg, ${C.violet}, ${C.violetDark})` }}>
    {src ? <img alt="" src={src} width={PHOTO_W} height={height} /> : (
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", color: "#ffffffaa", fontSize: 30 }}>Sin foto</div>
    )}
    {badge && (
      <div style={{ display: "flex", position: "absolute", top: 28, left: 28, padding: "12px 24px", borderRadius: 999,
        background: C.mint, color: C.ink, fontSize: 32, fontWeight: 800 }}>{badge}</div>
    )}
  </div>
);

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 48, background: C.soft, fontFamily: "Inter", color: C.ink }}>
    {children}
  </div>
);

export type HotelCard = BeloTravelHotel & { url: string };
export async function renderHotelCard(hotel: HotelCard) {
  const photo = await photoData(hotel.image, PHOTO_W, 600);
  return png(
    <Frame>
      <Photo src={photo} height={600} badge={hotel.discount ? `-${hotel.discount}%` : undefined} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: 3, color: C.violet, marginRight: 10 }}>BELO TRAVEL</span>
          {Array.from({ length: hotel.stars || 0 }, (_, i) => <Star key={i} />)}
        </div>
        <span style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>{hotel.name}</span>
        <span style={{ fontSize: 26, color: C.muted }}>{`${hotel.address} · ${hotel.ratingLabel} ${hotel.rating}`}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 8 }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: C.violet }}>{money(hotel.price)}</span>
          <span style={{ fontSize: 26, color: C.muted }}>por noche</span>
          {hotel.discount > 0 && <span style={{ fontSize: 26, color: C.muted, textDecoration: "line-through" }}>{money(hotel.listPrice)}</span>}
        </div>
      </div>
      <Footer label="Precio publicado en belo travel" />
    </Frame>,
  );
}

const kindLabel: Record<TravelOption["kind"], string> = { hotel: "HOTEL", restaurant: "RESTAURANTE", activity: "ACTIVIDAD", beach: "PLAYA", place: "LUGAR" };
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
export async function renderOptionCard(option: TravelOption) {
  const photo = await photoData(option.image?.url, PHOTO_W, 540);
  const price = option.price ? `${option.price.currency} ${option.price.amount} ${{ night: "por noche", person: "por persona", total: "en total" }[option.price.basis]}` : "Precio a confirmar";
  return png(
    <Frame>
      <Photo src={photo} height={540} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 10 }}>
        <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: 3, color: C.violet }}>{`${kindLabel[option.kind]} · ${clip(option.location, 40).toUpperCase()}`}</span>
        <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>{clip(option.name, 60)}</span>
        <span style={{ fontSize: 34, fontWeight: 800, color: C.violet, marginTop: 4 }}>{price}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          <div style={{ display: "flex", gap: 14 }}><Dot color={C.mint} /><span style={{ fontSize: 26, color: C.ink }}>{clip(option.pros[0], 80)}</span></div>
          <div style={{ display: "flex", gap: 14 }}><Dot color={C.lav} /><span style={{ fontSize: 26, color: C.muted }}>{clip(option.cons[0], 80)}</span></div>
        </div>
      </div>
      <Footer label={clip(option.sourceTitle, 44)} />
    </Frame>,
  );
}

export type BeloCardImage = { holder: string; lastFour: string | null; status: string; limitUsd: string | null; error?: string };
const statusLabel: Record<string, string> = { active: "Activa", frozen: "Congelada", failed: "No se emitió" };
export async function renderBeloCard(card: BeloCardImage) {
  const failed = Boolean(card.error);
  return png(
    <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, background: C.soft, fontFamily: "Inter", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", width: 936, height: 590, padding: 56,
        borderRadius: 48, overflow: "hidden", color: failed ? C.muted : "#fff",
        background: failed ? "#fff" : `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDark} 50%, ${C.ink} 100%)`,
        border: failed ? `3px solid ${C.lav}` : "none" }}>
        {!failed && <div style={{ display: "flex", position: "absolute", right: -120, bottom: -180, width: 520, height: 520, borderRadius: 520, background: "radial-gradient(circle, rgba(0,255,178,0.32), transparent 70%)" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <img alt="belo" src={beloLogo(failed ? C.muted : "#ffffff")} width={150} height={73} />
          <span style={{ display: "flex", padding: "12px 26px", borderRadius: 999, fontSize: 30, fontWeight: 800,
            background: failed ? C.lav : card.status === "frozen" ? "#ffffff" : C.mint, color: C.ink }}>
            {statusLabel[failed ? "failed" : card.status] ?? card.status}
          </span>
        </div>
        <div style={{ display: "flex", width: 84, height: 62, borderRadius: 12, background: failed ? C.lav : "linear-gradient(135deg, #d9c48a, #a8915a)" }} />
        <span style={{ fontSize: failed ? 34 : 52, letterSpacing: failed ? 0 : 8, fontWeight: 600 }}>
          {failed ? clip(card.error!, 70) : `•••• •••• •••• ${card.lastFour ?? "····"}`}
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: 3, opacity: 0.65 }}>TITULAR</span>
            <span style={{ fontSize: 40, fontWeight: 800 }}>{clip(card.holder, 22)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 22, letterSpacing: 3, opacity: 0.65 }}>TOPE TURI</span>
            <span style={{ fontSize: 40, fontWeight: 800 }}>{card.limitUsd ? `USD ${card.limitUsd}` : "Sin tope"}</span>
          </div>
        </div>
      </div>
    </div>,
  );
}

export async function renderTripSummary(summary: ConversationPanels["summary"]) {
  const ratio = summary.budget > 0 ? Math.min(summary.total / summary.budget, 1) : 0;
  const over = summary.budget > 0 && summary.total > summary.budget;
  const top = summary.categories.filter((c) => c.amount > 0).slice(0, 4);
  return png(
    <Frame>
      <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: 3, color: C.violet }}>RESUMEN DEL VIAJE</span>
      <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, marginTop: 8 }}>{clip(summary.destination || "Tu viaje", 28)}</span>
      <span style={{ fontSize: 28, color: C.muted }}>
        {summary.startDate ? `${summary.startDate} → ${summary.endDate} · ${summary.expenseCount} gastos` : `${summary.expenseCount} gastos registrados`}
      </span>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44, padding: 40, borderRadius: 36, background: "#fff", border: `2px solid ${C.lav}`, gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 60, fontWeight: 800, color: over ? "#c62828" : C.violet }}>{money(summary.total, summary.currency)}</span>
          <span style={{ fontSize: 28, color: C.muted }}>{summary.budget > 0 ? `de ${money(summary.budget, summary.currency)}` : "sin presupuesto"}</span>
        </div>
        <div style={{ display: "flex", width: "100%", height: 28, borderRadius: 28, background: C.lav, overflow: "hidden" }}>
          <div style={{ display: "flex", width: `${Math.round(ratio * 100)}%`, height: "100%", borderRadius: 28, background: over ? "#c62828" : C.violet }} />
        </div>
        <span style={{ fontSize: 28, color: over ? "#c62828" : C.ink, fontWeight: 600 }}>
          {summary.budget > 0 ? (over ? `Te pasaste por ${money(summary.total - summary.budget, summary.currency)}` : `Te quedan ${money(summary.remaining, summary.currency)}`) : "Cargá un presupuesto para ver cuánto te queda"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 32 }}>
        {top.map((c) => (
          <div key={c.category} style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}>
            <span>{c.category}</span>
            <span style={{ fontWeight: 800 }}>{money(c.amount, summary.currency)}</span>
          </div>
        ))}
      </div>
      <Footer label="Gastos que registraste, no el saldo de belo" />
    </Frame>,
  );
}
