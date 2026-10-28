"use client";

import {
  ChatCircleDotsIcon,
  CompassIcon,
  WalletIcon,
  UsersThreeIcon,
  XIcon,
  ArrowUpRightIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  NotePencilIcon,
  AirplaneTiltIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { budgetSummary, money } from "@/lib/turi/domain";
import { useTuri } from "./useTuri";
import { useRealtime } from "./useRealtime";
import TuriMark from "./TuriMark";
import ChatView from "./ChatView";
import TripView from "./TripView";
import ConnectionsView from "./ConnectionsView";

export type Tab = "chat" | "trip" | "budget" | "group" | "connections";
const navigation = [
  { id: "chat", label: "Conversación", icon: ChatCircleDotsIcon },
  { id: "trip", label: "Mi viaje", icon: CompassIcon },
  { id: "budget", label: "Presupuesto", icon: WalletIcon },
  { id: "group", label: "Mi grupo", icon: UsersThreeIcon },
] as const;

export default function TuriWorkspace({ onClose }: { onClose: () => void }) {
  const turi = useTuri(),
    voice = useRealtime(turi),
    dialog = useRef<HTMLDialogElement>(null);
  const [tab, setActiveTab] = useState<Tab>(() =>
    new URLSearchParams(location.search).get("turi") === "connections"
      ? "connections"
      : "chat",
  );
  const activeTrip = useRef(turi.state.postTrip.tripId);
  const stopVoice = voice.stop;
  useEffect(() => {
    if (activeTrip.current !== turi.state.postTrip.tripId) {
      stopVoice();
      activeTrip.current = turi.state.postTrip.tripId;
    }
  }, [turi.state.postTrip.tripId, stopVoice]);
  const setTab = (next: Tab) => {
    if (next !== "chat") voice.stop();
    setActiveTab(next);
  };
  const budget = budgetSummary(turi.state),
    trip = turi.state.trip;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const close = () => {
    voice.stop();
    onClose();
  };
  const restartChat = () => {
    if (!window.confirm("¿Empezar una conversación nueva? Se borra el chat; tu viaje, gastos y grupo quedan guardados.")) return;
    voice.stop();
    turi.restart();
    setTab("chat");
  };
  const exportTrip = () => {
    const blob = new Blob(
        [JSON.stringify({ ...turi.state, summary: budget }, null, 2)],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "mi-viaje-turi.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <dialog
      ref={dialog}
      className="turi-dialog"
      aria-labelledby="turi-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="turi-window">
        <nav className="turi-rail" aria-label="Secciones de Turi">
          <button
            className="turi-brand-mark"
            onClick={() => setTab("chat")}
            aria-label="Inicio de Turi"
          >
            <TuriMark size={30} />
          </button>
          <div className="turi-rail-links">
            {navigation.map((item) => (
              <button
                key={item.id}
                title={item.label}
                aria-label={item.label}
                aria-current={tab === item.id ? "page" : undefined}
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
              >
                <item.icon
                  size={22}
                  weight={tab === item.id ? "fill" : "regular"}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <span className="turi-rail-bottom">
            belo<span>travel companion</span>
          </span>
        </nav>
        <div className="turi-main">
          <header className="turi-header">
            <div className="turi-header-title">
              <h1 id="turi-title">
                Turi <small>by Belo</small><span>Tu copiloto de viaje</span>
              </h1>
              <span className="turi-ai-badge">
                <i />
                Asistente virtual
              </span>
            </div>
            <div className="turi-header-actions">
              <button
                className="turi-icon-button"
                onClick={exportTrip}
                title="Descargar datos del viaje"
                aria-label="Descargar datos del viaje"
              >
                <DownloadSimpleIcon size={19} />
              </button>
              <button
                className="turi-icon-button"
                onClick={restartChat}
                disabled={!turi.messages.length}
                title="Nueva conversación"
                aria-label="Nueva conversación"
              >
                <NotePencilIcon size={19} />
              </button>
              <button
                className="turi-icon-button turi-close"
                onClick={close}
                aria-label="Cerrar Turi"
              >
                <XIcon size={21} />
              </button>
            </div>
          </header>
          {turi.error && (
            <div className="turi-error" role="alert">
              <span>{turi.error}</span>
              <button
                onClick={() => turi.setError("")}
                aria-label="Cerrar aviso"
              >
                <XIcon size={16} />
              </button>
            </div>
          )}
          <div className="turi-main-content">
            {tab === "chat" ? (
              <ChatView turi={turi} voice={voice} />
            ) : tab === "connections" ? (
              <ConnectionsView
                turi={turi}
                onImported={(text) => {
                  setTab("chat");
                  void turi.send(text);
                }}
                onAttachment={(attachment) => {
                  setTab("chat");
                  void turi.send(
                    "Revisá este archivo que elegí de Drive y prepará los datos del viaje para que los revise.",
                    [attachment],
                  );
                }}
              />
            ) : (
              <TripView tab={tab} turi={turi} />
            )}
          </div>
        </div>
        <aside className="turi-insights">
          <div className="turi-insights-heading">
            <span>EN TU RADAR</span>
            <span className="turi-tiny-dot" />
          </div>
          <button className="turi-trip-cover" onClick={() => setTab("trip")}>
            <div className="turi-ticket-visual" aria-hidden="true">
              <span>UN VIAJE. TURI EN CADA ETAPA.</span>
              <AirplaneTiltIcon size={45} weight="fill" />
            </div>
            <span className="turi-cover-label">PRÓXIMA PARADA</span>
            <strong>{trip.destination || "Un viaje por imaginar."}</strong>
            <span className="turi-cover-bottom">
              {trip.startDate
                ? `${trip.startDate.split("-").reverse().join("/")} · ${trip.travelers} ${trip.travelers === 1 ? "viajero" : "viajeros"}`
                : "Armémoslo a tu manera"}
              <ArrowUpRightIcon size={20} />
            </span>
          </button>
          <div className="turi-budget-widget">
            <div className="turi-widget-label">
              <WalletIcon size={17} />
              <span>Tu presupuesto</span>
              <button
                aria-label="Ver presupuesto"
                onClick={() => setTab("budget")}
              >
                <ArrowUpRightIcon size={16} />
              </button>
            </div>
            <strong>
              {trip.budget
                ? money(budget.available, trip.currency)
                : "Todo por planear"}
            </strong>
            <span className="turi-widget-muted">
              {trip.budget
                ? "disponibles en tu plan"
                : "Definí cuánto querés invertir en viajar"}
            </span>
            <div className="turi-budget-track">
              <span
                style={{
                  width: `${trip.budget ? Math.min(100, Math.max(0, (budget.spent / trip.budget) * 100)) : 0}%`,
                }}
              />
            </div>
            <div className="turi-budget-widget-bottom">
              <span>
                {trip.budget
                  ? `${Math.round((budget.spent / trip.budget) * 100)}% registrado`
                  : "Sin presupuesto todavía"}
              </span>
              <span>{trip.currency}</span>
            </div>
            {trip.returnReserve > 0 && (
              <small>
                Vuelta: {money(trip.returnReserve, trip.currency)} separados en
                tu plan.
              </small>
            )}
          </div>
          <div className="turi-insight-note">
            <span className="turi-note-number">01 / MENOS VUELTAS</span>
            <p>
              Vos disfrutá el viaje.
              <br />
              Las cuentas, las vemos juntos.
            </p>
            <button onClick={() => setTab("group")}>
              Conocé tu grupo
              <ArrowRightIcon size={16} />
            </button>
          </div>
          <div className="turi-storage-note">
            <span
              className={`turi-save-dot ${turi.status?.cloud ? "connected" : ""}`}
            />
            <span>
              {turi.status?.cloud
                ? "Sincronización segura habilitada"
                : "Tu viaje se guarda en este dispositivo"}
            </span>
          </div>
        </aside>
      </div>
    </dialog>
  );
}
