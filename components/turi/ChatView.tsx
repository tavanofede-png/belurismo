"use client";

import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CompassIcon,
  WalletIcon,
  UsersThreeIcon,
  MapPinIcon,
  PaperclipIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PhoneDisconnectIcon,
  XIcon,
  StopIcon,
  CheckIcon,
  FilePdfIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { applyLocalAction, type Attachment } from "@/lib/turi/domain";
import { api, type TuriController } from "./useTuri";
import type { VoiceController } from "./useRealtime";
import type { Tab } from "./TuriWorkspace";
import TuriMark from "./TuriMark";
import ConversationWidgets from "./ConversationWidgets";
import TravelOptions from "./TravelOptions";
import { postTripNoticeState, snoozePostTripNotice, dismissPostTripNotice, settleTripStatus } from "@/lib/turi/posttrip";
import "./post-trip-finance.css";

const suggestions = [
  {
    title: "Antes del viaje",
    text: "Antes del viaje",
    icon: CompassIcon,
    hint: "Un plan a tu medida",
  },
  {
    title: "Después del viaje",
    text: "Después del viaje",
    icon: WalletIcon,
    hint: "Cerramos las cuentas",
  },
  {
    title: "Nos vamos en grupo",
    text: "Quiero organizar un viaje con amigos y repartir los gastos de forma clara.",
    icon: UsersThreeIcon,
    hint: "Cuentas claras, buen viaje",
  },
  {
    title: "Ya estoy de viaje",
    text: "Ya estoy de viaje. Ayudame con recomendaciones, precios locales y cómo pedir las cosas.",
    icon: MapPinIcon,
    hint: "Turi va con vos",
  },
];
const fieldLabels: Record<string, string> = {
  description: "Concepto",
  amount: "Importe",
  currency: "Moneda",
  homeAmount: "En tu presupuesto",
  date: "Fecha",
  category: "Categoría",
  payer: "Pagó",
  title: "Actividad",
  start: "Inicio",
  end: "Fin",
  location: "Lugar",
  notes: "Notas",
  reminderMinutes: "Recordatorio (min)",
  at: "Cuándo",
  destination: "Destino",
  startDate: "Desde",
  endDate: "Hasta",
  budget: "Presupuesto",
  returnReserve: "Para la vuelta",
  travelers: "Viajeros",
  preferences: "Preferencias",
  timeZone: "Zona horaria",
  destinationCurrency: "Moneda del destino",
};
export default function ChatView({
  turi,
  voice,
  onTab,
}: {
  turi: TuriController;
  voice: VoiceController;
  onTab: (tab: Tab) => void;
}) {
  const [text, setText] = useState(""),
    [files, setFiles] = useState<Attachment[]>([]),
    [fileBusy, setFileBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    end = useRef<HTMLDivElement>(null),
    log = useRef<HTMLDivElement>(null),
    following = useRef(true);
  useEffect(() => {
    if (following.current)
      end.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [turi.messages, turi.activity, turi.proposals]);
  const addFiles = async (selected: FileList | null) => {
    if (!selected) return;
    setFileBusy(true);
    try {
      const newFiles = Array.from(selected);
      if (
        files.length + newFiles.length > 3 ||
        files.reduce((s, f) => s + f.size, 0) +
          newFiles.reduce((s, f) => s + f.size, 0) >
          2_500_000
      )
        throw new Error(
          "Podés adjuntar hasta 3 archivos que juntos pesen hasta 2,5 MB.",
        );
      const loaded = await Promise.all(
        newFiles.map(async (file) => {
          if (
            ![
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/webp",
            ].includes(file.type)
          )
            throw new Error("Elegí un PDF o una imagen PNG, JPEG o WebP.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(new Error("No pude leer el archivo."));
            reader.readAsDataURL(file);
          });
          return { name: file.name, size: file.size, type: file.type, data };
        }),
      );
      setFiles((previous) => [...previous, ...loaded]);
    } catch (e) {
      turi.setError((e as Error).message);
    } finally {
      setFileBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const submit = async (event?: FormEvent, value = text) => {
    event?.preventDefault();
    if ((!value.trim() && !files.length) || turi.busy || fileBusy) return;
    following.current = true;
    if (voice.phase !== "off") {
      if (files.length) {
        turi.setError(
          "Terminá la llamada para enviar el comprobante por chat.",
        );
        return;
      }
      if (voice.sendText(value.trim())) setText("");
      return;
    }
    const accepted = await turi.send(value, files);
    if (accepted) {
      setText("");
      setFiles([]);
      input.current?.focus();
    }
  };
  const returnNotice = postTripNoticeState(turi.state);
  return (
    <section className="turi-chat" aria-label="Conversación con Turi">
      {returnNotice.eligible && (
        <div className="turi-return-notice" role="status">
          <strong>Tu viaje terminó</strong>
          <span>{returnNotice.message}</span>
          <div>
            <button onClick={() => void submit(undefined, "Después del viaje")}>Revisar cierre</button>
            <button onClick={() => turi.setState(previous => snoozePostTripNotice(previous, 2))}>En 2 días</button>
            <button aria-label="Descartar aviso del cierre" onClick={() => turi.setState(previous => dismissPostTripNotice(previous))}>
              <XIcon size={16} />
            </button>
          </div>
        </div>
      )}
      <div
        className="turi-chat-scroll"
        ref={log}
        onScroll={() => {
          if (log.current)
            following.current =
              log.current.scrollHeight -
                log.current.scrollTop -
                log.current.clientHeight <
              100;
        }}
      >
        {!turi.messages.length ? (
          <div className="turi-welcome">
            <div className="turi-welcome-eyebrow">
              <span />
              HECHO PARA IR CON VOS
            </div>
            <div className="turi-welcome-orb">
              <TuriMark size={52} />
              <span className="turi-orb-spark" />
            </div>
            <h2>
              Un buen viaje
              <br />
              empieza con <span>una charla.</span>
            </h2>
            <p>
              Soy Turi. Planeamos el viaje, ordenamos los gastos
              <br className="turi-desktop-break" /> y resolvemos lo que aparezca
              en el camino.
            </p>
            <div className="turi-suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.title}
                  onClick={() => {
                    if (turi.status?.ai) void submit(undefined, item.text);
                    else {
                      setText(item.text);
                      input.current?.focus();
                    }
                  }}
                >
                  <item.icon size={22} weight="regular" />
                  <strong>{item.title}</strong>
                  <small>{item.hint}</small>
                  <ArrowUpRightIcon
                    size={16}
                    className="turi-suggestion-arrow"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="turi-messages"
            role="log"
            aria-label="Mensajes de la conversación"
          >
            {turi.messages.map((message, index) => (
              <article
                key={message.id}
                className={`turi-message ${message.role}${message.options?.length || message.widgets?.length ? " has-options" : ""}`}
              >
                {message.role === "assistant" && (
                  <span className={`turi-message-avatar${turi.busy && index === turi.messages.length - 1 ? " is-thinking" : ""}`}>
                    <TuriMark size={19} />
                  </span>
                )}
                <div className="turi-message-content">
                  {message.role === "assistant" && (message.text || (!message.options?.length && !message.widgets?.length && !message.sources?.length && turi.busy)) ? (
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: (props) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                      }}
                    >
                      {message.text || (turi.busy ? "…" : "")}
                    </Markdown>
                  ) : message.role === "user" ? (
                    <p>{message.text}</p>
                  ) : null}
                  {!!message.options?.length && (
                    <TravelOptions
                      options={message.options}
                      disabled={turi.busy || fileBusy || voice.phase === "connecting"}
                      onChoose={(value) => void submit(undefined, value)}
                    />
                  )}
                  {!!message.widgets?.length && <ConversationWidgets widgets={message.widgets} turi={turi}
                    disabled={turi.busy || fileBusy || voice.phase === "connecting"}
                    onSend={(value) => void submit(undefined, value)} />}
                  {message.attachments?.map((file, i) => (
                    <span
                      className="turi-message-file"
                      key={`${file.name}-${i}`}
                    >
                      <PaperclipIcon size={14} />
                      {file.name}
                    </span>
                  ))}
                  {!!message.sources?.length && (
                    <div className="turi-sources">
                      {message.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.title}
                          <ArrowUpRightIcon size={11} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {!!turi.activity && (
              <div className="turi-activity" role="status">
                <span className="turi-typing">
                  <i />
                  <i />
                  <i />
                </span>
                {turi.activity}
              </div>
            )}
          </div>
        )}
        {turi.proposals.map((proposal, index) => (
          <div className="turi-review-card" key={`${proposal.type}-${index}`}>
            <span className="turi-eyebrow">PARA QUE LO REVISES</span>
            <h3>{proposal.label}</h3>
            <dl>
              {Object.entries(proposal.data as Record<string, unknown>)
                .filter(
                  ([key]) => !["id", "shares", "calendarEventId"].includes(key),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{fieldLabels[key] || key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
            <div className="turi-review-buttons">
              <button
                className="turi-primary"
                onClick={() => {
                  try {
                    turi.setState((previous) =>
                      settleTripStatus(applyLocalAction(previous, proposal)),
                    );
                    turi.setProposals((previous) =>
                      previous.filter((_, i) => i !== index),
                    );
                  } catch (e) {
                    turi.setError((e as Error).message);
                  }
                }}
              >
                <CheckIcon size={15} />
                Guardar en mi viaje
              </button>
              <button
                className="turi-secondary"
                onClick={() =>
                  turi.setProposals((previous) =>
                    previous.filter((_, i) => i !== index),
                  )
                }
              >
                Descartar
              </button>
            </div>
          </div>
        ))}
        {turi.beloProposals.map((proposal, index) => (
          <div className="turi-review-card" key={proposal.token}>
            <span className="turi-eyebrow">PROPUESTA DE BELO</span>
            <h3>{proposal.label}</h3>
            <pre>{JSON.stringify(proposal.args, null, 2)}</pre>
            <p>
              Revisá los datos antes de solicitar la propuesta. Cualquier
              movimiento se aprueba después en la app de Belo.
            </p>
            <button
              className="turi-primary"
              onClick={async () => {
                try {
                  const result = await api("belo/approve", proposal);
                  turi.setMessages((list) => [
                    ...list,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      text: `Belo respondió a la solicitud de propuesta:\n\n${JSON.stringify(result)}\n\nRevisá el resultado y aprobá cualquier movimiento sólo en Belo.`,
                    },
                  ]);
                  turi.setBeloProposals((list) =>
                    list.filter((_, i) => i !== index),
                  );
                } catch (e) {
                  turi.setError((e as Error).message);
                }
              }}
            >
              Solicitar propuesta a Belo
            </button>
          </div>
        ))}
        <div ref={end} />
      </div>
      {voice.phase !== "off" && (
        <div className="turi-voice-bar" role="status">
          <span
            className={`turi-wave ${voice.phase === "speaking" ? "speaking" : ""}`}
            aria-hidden="true"
          >
            {Array.from({ length: 13 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 55}ms` }} />
            ))}
          </span>
          <div>
            <strong>
              {voice.phase === "connecting"
                ? "Conectando con Turi…"
                : voice.phase === "speaking"
                  ? "Turi está hablando"
                  : voice.muted
                    ? "Micrófono silenciado"
                    : "Te escucho"}
            </strong>
            <small>Voz en tiempo real · podés interrumpir</small>
          </div>
          <button
            className="turi-icon-button"
            onClick={voice.toggleMute}
            aria-label={
              voice.muted ? "Activar micrófono" : "Silenciar micrófono"
            }
            disabled={voice.phase === "connecting"}
          >
            {voice.muted ? (
              <MicrophoneSlashIcon size={19} />
            ) : (
              <MicrophoneIcon size={19} />
            )}
          </button>
          <button
            className="turi-end-call"
            onClick={voice.stop}
            aria-label="Terminar llamada"
          >
            <PhoneDisconnectIcon size={20} />
          </button>
        </div>
      )}
      <div className="turi-composer-area">
        <div className="turi-chat-modes" aria-label="Etapas del viaje">
          <button type="button" disabled={turi.busy || fileBusy} onClick={() => void submit(undefined, "Antes del viaje")}>Antes de viajar</button>
          <button type="button" disabled={turi.busy || fileBusy} onClick={() => void submit(undefined, "Después del viaje")}>Después de viajar</button>
          <button type="button" disabled={turi.busy || fileBusy} onClick={() => void submit(undefined, "Checklist antes de viajar")}>Checklist</button>
        </div>
        {!!files.length && (
          <div className="turi-attachments">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                {file.type.startsWith("image") ? (
                  <img src={file.data} alt="Vista previa del adjunto" />
                ) : (
                  <FilePdfIcon size={25} />
                )}
                <span>{file.name}</span>
                <button
                  aria-label={`Quitar ${file.name}`}
                  onClick={() =>
                    setFiles((list) => list.filter((_, i) => i !== index))
                  }
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form className="turi-composer" onSubmit={submit}>
          <textarea
            ref={input}
            aria-label="Mensaje para Turi"
            placeholder="Contame, ¿qué viaje tenés en mente?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={12000}
            rows={2}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="turi-composer-bottom">
            <div className="turi-composer-tools">
              <button
                type="button"
                className="turi-icon-button"
                title="Adjuntar PDF o imagen · hasta 2,5 MB"
                aria-label="Adjuntar PDF o imagen"
                onClick={() => fileInput.current?.click()}
                disabled={fileBusy || turi.busy || voice.phase !== "off"}
              >
                <PaperclipIcon size={20} />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => void addFiles(e.target.files)}
              />
              <button
                type="button"
                className={`turi-icon-button ${turi.location ? "selected" : ""}`}
                aria-label={
                  turi.location
                    ? "Dejar de compartir ubicación"
                    : "Compartir mi ubicación para esta conversación"
                }
                title={
                  turi.location
                    ? "Dejar de compartir ubicación"
                    : "Compartir ubicación"
                }
                onClick={turi.shareLocation}
              >
                <MapPinIcon
                  size={19}
                  weight={turi.location ? "fill" : "regular"}
                />
              </button>
              <span className="turi-composer-divider" />
              <button
                type="button"
                className="turi-voice-start"
                onClick={() =>
                  voice.phase === "off" ? void voice.start() : voice.stop()
                }
                disabled={turi.busy}
              >
                <MicrophoneIcon size={18} />
                <span>{voice.phase === "off" ? "Hablemos" : "En llamada"}</span>
              </button>
            </div>
            {turi.busy ? (
              <button
                type="button"
                className="turi-send"
                aria-label="Detener respuesta"
                onClick={turi.stop}
              >
                <StopIcon size={17} weight="fill" />
              </button>
            ) : (
              <button
                className="turi-send"
                type="submit"
                aria-label="Enviar mensaje"
                disabled={(!text.trim() && !files.length) || fileBusy}
              >
                <ArrowUpIcon size={20} weight="bold" />
              </button>
            )}
          </div>
        </form>
        <div className="turi-composer-caption">
          <span>
            {turi.location
              ? "Ubicación compartida para esta conversación"
              : "Vos decidís. Turi te acompaña."}
          </span>
          <button onClick={() => onTab("connections")}>
            {turi.status?.ai ? "Ver conexiones" : "Conexiones pendientes"}
            <ArrowUpRightIcon size={11} />
          </button>
        </div>
      </div>
    </section>
  );
}
