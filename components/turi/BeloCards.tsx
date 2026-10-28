"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ConversationWidget } from "@/lib/turi/conversation-widgets";
import "./belo-cards.css";

type Card = Extract<ConversationWidget, { type: "cards" }>["cards"][number];

const statusLabel: Record<string, string> = {
  active: "Activa",
  frozen: "Congelada",
  pending: "En emisión",
  failed: "No se emitió",
};

// Ice spikes in a 100×63 box (the card's 1.586 ratio): x along the edge, h length, w base, d stagger.
// Fixed list, not Math.random, so server and client render the same.
const spikes = [
  { edge: "top", x: 6, h: 9, w: 5, d: 0.0 }, { edge: "top", x: 14, h: 5, w: 4, d: 0.35 }, { edge: "top", x: 23, h: 12, w: 6, d: 0.15 },
  { edge: "top", x: 34, h: 6, w: 4, d: 0.5 }, { edge: "top", x: 47, h: 10, w: 5, d: 0.25 }, { edge: "top", x: 61, h: 7, w: 4, d: 0.6 },
  { edge: "top", x: 72, h: 13, w: 6, d: 0.1 }, { edge: "top", x: 85, h: 6, w: 4, d: 0.45 }, { edge: "top", x: 94, h: 10, w: 5, d: 0.2 },
  { edge: "bottom", x: 9, h: 7, w: 5, d: 0.3 }, { edge: "bottom", x: 28, h: 11, w: 6, d: 0.05 }, { edge: "bottom", x: 52, h: 6, w: 4, d: 0.55 },
  { edge: "bottom", x: 70, h: 9, w: 5, d: 0.2 }, { edge: "bottom", x: 90, h: 12, w: 6, d: 0.4 },
  { edge: "left", x: 22, h: 6, w: 5, d: 0.5 }, { edge: "left", x: 44, h: 8, w: 6, d: 0.15 },
  { edge: "right", x: 18, h: 7, w: 5, d: 0.3 }, { edge: "right", x: 40, h: 5, w: 4, d: 0.6 },
] as const;
// Crystals sit in the card's empty zones (between chip, number and labels) so text stays legible.
const crystals = [{ x: 86, y: 27, r: 4.2, d: 1.1 }, { x: 60, y: 25, r: 3, d: 1.4 }, { x: 40, y: 27, r: 3.2, d: 1.25 },
  { x: 50, y: 56, r: 3.4, d: 1.55 }, { x: 4, y: 33, r: 2.8, d: 1.7 }];
function spikePath({ edge, x, h, w }: (typeof spikes)[number]) {
  const half = w / 2;
  if (edge === "top") return `M${x - half} 0 L${x} ${h} L${x + half} 0 Z`;
  if (edge === "bottom") return `M${x - half} 63 L${x} ${63 - h} L${x + half} 63 Z`;
  if (edge === "left") return `M0 ${x - half} L${h} ${x} L0 ${x + half} Z`;
  return `M100 ${x - half} L${100 - h} ${x} L100 ${x + half} Z`;
}
const crystalPath = ({ x, y, r }: { x: number; y: number; r: number }) =>
  [0, 60, 120].map((a) => {
    const dx = Math.cos((a * Math.PI) / 180) * r, dy = Math.sin((a * Math.PI) / 180) * r;
    return `M${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)} L${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
  }).join(" ");
const origin: Record<(typeof spikes)[number]["edge"], string> = { top: "50% 0%", bottom: "50% 100%", left: "0% 50%", right: "100% 50%" };

// Freezing: the card cools, spikes grow from the edges, frost closes in from the borders, crystals pop.
function FrostOverlay({ delay, reduce }: { delay: number; reduce: boolean }) {
  const t = (at: number, duration: number) => ({ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay + at, ease: "easeOut" as const });
  return (
    <>
      <motion.span className="belo-card-chill" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.4, 0.6)} />
      <motion.span className="belo-card-frost" aria-hidden initial={{ opacity: 0, scale: 2.2 }} animate={{ opacity: 1, scale: 1 }} transition={t(0.9, 1.6)} />
      <svg className="belo-card-ice" viewBox="0 0 100 63" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="belo-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#d6f0ff" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {spikes.map((spike, i) => (
          <motion.path key={i} d={spikePath(spike)} fill="url(#belo-ice)" stroke="#a9dcff" strokeWidth="0.25"
            style={{ transformBox: "fill-box", transformOrigin: origin[spike.edge] }}
            initial={{ scaleY: spike.edge === "top" || spike.edge === "bottom" ? 0 : 1, scaleX: spike.edge === "left" || spike.edge === "right" ? 0 : 1 }}
            animate={{ scaleY: 1, scaleX: 1 }} transition={t(0.6 + spike.d * 1.6, 0.7)} />
        ))}
        {crystals.map((c, i) => (
          <motion.path key={`c${i}`} d={crystalPath(c)} stroke="#ffffff" strokeWidth="0.45" strokeLinecap="round" fill="none"
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
            initial={{ scale: 0, rotate: -40, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 0.9 }} transition={t(c.d, 0.6)} />
        ))}
      </svg>
    </>
  );
}

function BeloCard({ card, index }: { card: Card; index: number }) {
  const reduce = useReducedMotion();
  const failed = Boolean(card.error);
  const frozen = !failed && card.status === "frozen";
  const delay = reduce ? 0 : 0.15 + index * 0.45;
  return (
    <motion.li
      className={`belo-card${failed ? " failed" : ""}${frozen ? " frozen" : ""}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, rotate: -9, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={reduce ? { duration: 0.2, delay } : { type: "spring", stiffness: 170, damping: 17, delay }}
      aria-label={failed
        ? `Tarjeta de ${card.holder}: no se emitió. ${card.error}`
        : `Tarjeta de ${card.holder}, terminada en ${card.lastFour ?? "sin número"}, ${statusLabel[card.status] ?? card.status}`}
    >
      {frozen && <FrostOverlay delay={delay} reduce={Boolean(reduce)} />}
      {!failed && !frozen && !reduce && (
        <motion.span className="belo-card-shine" aria-hidden
          initial={{ x: "-120%" }} animate={{ x: "220%" }}
          transition={{ duration: 0.9, delay: delay + 0.35, ease: "easeInOut" }} />
      )}
      <div className="belo-card-top">
        <img src="/img/logo-belo.svg" alt="belo" className="belo-card-logo" />
        <span className="belo-card-type">Virtual</span>
      </div>
      <span className="belo-card-chip" aria-hidden />
      <motion.p className="belo-card-number" aria-hidden
        initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, delay: delay + 0.5 }}>
        {failed ? card.error : `•••• •••• •••• ${card.lastFour ?? "····"}`}
      </motion.p>
      <div className="belo-card-bottom">
        <div>
          <small>Titular</small>
          <strong>{card.holder}</strong>
        </div>
        <div className="belo-card-limit">
          <small>Tope Turi</small>
          <strong>{card.limitUsd ? `USD ${card.limitUsd}` : "Sin tope"}</strong>
        </div>
      </div>
      <motion.span className="belo-card-status"
        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: delay + (frozen ? 2.3 : 0.7) }}>
        {failed ? statusLabel.failed : `${frozen ? "❄" : "✓"} ${statusLabel[card.status] ?? card.status}`}
      </motion.span>
    </motion.li>
  );
}

export default function BeloCards({ widget }: { widget: Extract<ConversationWidget, { type: "cards" }> }) {
  const issued = widget.cards.filter((card) => !card.error).length;
  const allFrozen = widget.cards.every((card) => !card.error && card.status === "frozen");
  return (
    <section className="belo-cards" aria-label="Tarjetas de belo">
      <header>
        <strong>{allFrozen ? `${issued} tarjeta${issued === 1 ? "" : "s"} congelada${issued === 1 ? "" : "s"}` : issued === widget.cards.length ? `${issued} tarjeta${issued === 1 ? "" : "s"} lista${issued === 1 ? "" : "s"}` : `${issued} de ${widget.cards.length} tarjetas emitidas`}</strong>
        <span>El tope lo registra Turi, belo no lo aplica.</span>
      </header>
      <ul>{widget.cards.map((card, index) => <BeloCard key={`${card.holder}-${index}`} card={card} index={index} />)}</ul>
    </section>
  );
}
