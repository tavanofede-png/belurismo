"use client";

import { ArrowUpRightIcon, CheckIcon, MapPinIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { formatTripDate, TRIP_STATUS, type GlobeTrip, type TripStatus } from "@/lib/travel/globe-trips";

type Props = {
  trips: GlobeTrip[];
  onClose: () => void;
  onSelect: (trip: GlobeTrip) => void;
  onExploreExamples: () => void;
  onPlanTrip: () => void;
};

const FILTERS: { id: "all" | TripStatus; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "completed", label: "Vividos" },
  { id: "active", label: "En curso" },
  { id: "upcoming", label: "Próximos" },
];

export default function TripArchive({ trips, onClose, onSelect, onExploreExamples, onPlanTrip }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const realTrips = trips.filter(trip => trip.source !== "example");
  const visibleTrips = realTrips.filter(trip => filter === "all" || trip.status === filter);

  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    if (node && !node.open) node.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} className="travel-trip-dialog travel-archive-dialog" aria-labelledby="travel-archive-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === dialog.current) onClose(); }}>
      <article className="travel-trip-panel travel-archive-panel">
        <header className="travel-trip-topline">
          <h2 id="travel-archive-title">Mis viajes</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar mis viajes" autoFocus><XIcon size={21} aria-hidden="true" /></button>
        </header>

        <div className="travel-trip-content travel-archive-content">
          <div className="travel-passport">
            <div className="travel-passport-heading">
              <span className="travel-passport-title">Tu pasaporte de viajes</span>
              <div className="travel-trip-filters" role="group" aria-label="Filtrar viajes">
                {FILTERS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                  {item.label}<span>{item.id === "all" ? realTrips.length : realTrips.filter(trip => trip.status === item.id).length}</span>
                </button>)}
              </div>
            </div>

            {visibleTrips.length ? <ul className="travel-destination-list">
              {visibleTrips.map(trip => <li key={trip.id}>
                <button type="button" onClick={() => onSelect(trip)} aria-haspopup="dialog" className="travel-destination" data-status={trip.status}>
                  <span className="travel-destination-icon" aria-hidden="true">
                    {trip.status === "completed" ? <CheckIcon size={17} weight="bold" /> : <MapPinIcon size={19} weight={trip.status === "active" ? "fill" : "regular"} />}
                  </span>
                  <span>
                    <strong>{trip.destination}</strong>
                    <small>{TRIP_STATUS[trip.status].label}{trip.country ? ` · ${trip.country}` : ""}</small>
                    <small>{trip.startDate ? `${formatTripDate(trip.startDate)}${trip.endDate ? ` al ${formatTripDate(trip.endDate)}` : ""}` : "Fechas por definir"}</small>
                  </span>
                  <ArrowUpRightIcon className="travel-destination-arrow" size={17} aria-hidden="true" />
                </button>
              </li>)}
            </ul> : <div className="travel-passport-empty">
              <MapPinIcon size={26} weight="duotone" aria-hidden="true" />
              <div>
                <strong>{realTrips.length ? "Todavía no hay viajes en esta etapa." : "Tu primer pin empieza con un plan."}</strong>
                <p>Los viajes que planifiques y archives con Turi van a aparecer acá.</p>
              </div>
              <button type="button" onClick={onPlanTrip}>Planear con Turi<ArrowUpRightIcon size={17} aria-hidden="true" /></button>
            </div>}

            <div className="travel-passport-footnote"><span>Tus viajes guardados con Turi en este dispositivo, también los que no tienen pin en el mapa.</span></div>
          </div>
        </div>

        <footer className="travel-trip-footer travel-archive-footer">
          <button type="button" className="travel-archive-examples" onClick={onExploreExamples}>Ver destinos de ejemplo</button>
          <button type="button" className="travel-archive-plan" onClick={onPlanTrip}>Planear viaje<ArrowUpRightIcon size={18} aria-hidden="true" /></button>
        </footer>
      </article>
    </dialog>
  );
}
