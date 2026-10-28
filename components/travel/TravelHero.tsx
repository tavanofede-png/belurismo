"use client";

import dynamic from "next/dynamic";
import { ArrowRightIcon, ArrowUpRightIcon, MapPinIcon } from "@phosphor-icons/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { EXAMPLE_TRIPS, readGlobeTrips } from "@/lib/travel/globe-trips";
import "./travel-hero.css";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false, loading: () => <div className="travel-globe-module-loading" role="status"><span className="travel-globe-skeleton" />Preparando tu mundo…</div> });
const TripDrawer = dynamic(() => import("./TripDrawer"));
const TripArchive = dynamic(() => import("./TripArchive"));
const STORAGE_KEY = "turi.workspace.v1";
function readWorkspace() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
function subscribeWorkspace(callback: () => void) {
  const storageChanged = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) callback(); };
  window.addEventListener("storage", storageChanged); window.addEventListener("turi:workspace-updated", callback);
  return () => { window.removeEventListener("storage", storageChanged); window.removeEventListener("turi:workspace-updated", callback); };
}
function subscribeClock(callback: () => void) { const timer = setInterval(callback, 60000); return () => clearInterval(timer); }
const clockSnapshot = () => Math.floor(Date.now() / 60000);
const serverClock = () => 0;
const serverWorkspace = () => null;

export default function TravelHero() {
  const workspace = useSyncExternalStore(subscribeWorkspace, readWorkspace, serverWorkspace);
  const minute = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const realTrips = useMemo(() => readGlobeTrips(workspace, new Date(minute * 60000)), [workspace, minute]);
  const [mode, setMode] = useState<"auto" | "examples" | "mine">("auto");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const examples = mode === "examples" || (mode === "auto" && realTrips.length === 0);
  const trips = examples ? EXAMPLE_TRIPS : realTrips;
  const selected = trips.find((trip) => trip.id === selectedId);
  const openTuri = () => window.dispatchEvent(new Event("turi:open"));

  return (
    <section className="travel-hero" aria-labelledby="travel-hero-title" id="mi-mundo">
      <div className="travel-hero-layout">
        <div className="travel-hero-copy">
          <h1 id="travel-hero-title">Tu mundo,<br /><span>un viaje a la vez.</span></h1>
          <p>Los que viviste. El que estás viviendo. Los que vienen.<br className="travel-desktop-break" /> Todos tus viajes, en un mismo lugar.</p>
          <button className="travel-primary-cta" aria-label="Planeá tu próximo viaje" onClick={openTuri}>Planeá tu próximo viaje<span><ArrowUpRightIcon size={21} /></span></button>
          <div className="travel-hero-passport">
            <div className="travel-passport-symbol"><MapPinIcon size={25} weight="duotone" /></div>
            <div><strong>Cada pin, una historia tuya.</strong><span>Tocá un destino y abrí su viaje.</span></div>
          </div>
        </div>
        <div className="travel-world">
          <div className="travel-world-topline"><button aria-label="Ver mis viajes" aria-haspopup="dialog" onClick={() => { setSelectedId(null); setArchiveOpen(true); }}>{examples ? "Vista de ejemplo" : "Mis viajes"}<span>Ver mis viajes<ArrowRightIcon size={12} /></span></button></div>
          <GlobeCanvas trips={trips} selectedId={selectedId} onSelect={(trip) => setSelectedId(trip.id)} />
        </div>
      </div>
      {archiveOpen && <TripArchive trips={realTrips} onClose={() => setArchiveOpen(false)} onSelect={(trip) => { setMode("mine"); setArchiveOpen(false); setSelectedId(trip.id); }} onExploreExamples={() => { setMode("examples"); setArchiveOpen(false); }} onPlanTrip={() => { setArchiveOpen(false); openTuri(); }} />}
      {selected && <TripDrawer key={selected.id} trip={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}
