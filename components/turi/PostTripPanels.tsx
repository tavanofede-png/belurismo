"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRightIcon, CheckIcon, CopyIcon, DownloadSimpleIcon, ShareNetworkIcon, StarIcon } from "@phosphor-icons/react";
import { currencies, today, type Trip } from "@/lib/turi/domain";
import { buildConversationPanels } from "@/lib/turi/conversation-panels";
import {
  buildPriceContributionPreview,
  createTripTemplate,
  dismissPostTripNotice,
  exportPriceContributions,
  postTripNoticeState,
  removeArchivedTrip,
  removeTripTemplate,
  savePriceContributions,
  saveTripTemplate,
  snoozePostTripNotice,
  startTripFromTemplate,
  tripTemplateReference,
} from "@/lib/turi/posttrip";
import type { TuriController } from "./useTuri";
import "./post-trip.css";

export type PostTripPanelKind = "post-trip-overview" | "post-trip-notice" | "template" | "feedback" | "recap";
type Props = { kind: PostTripPanelKind; turi: TuriController; onSend: (text: string) => void; disabled?: boolean };
type Selection = { expenseId: string; item: string; area: string; month?: string };
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(amount);
const dateLabel = (date: string) => new Intl.DateTimeFormat("es-AR", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(date));
const messageOf = (error: unknown) => error instanceof Error ? error.message : "No pude completar esta acción. Revisá los datos e intentá otra vez.";
const matchesDestination = (left: string, right: string) => left.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
  === right.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function validTimeZone(value: string) {
  if (!value || value.length > 80) return false;
  try { new Intl.DateTimeFormat("es-AR", { timeZone: value }); return true; }
  catch { return false; }
}

function Surface({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="turi-post-panel" aria-label={title}>
    <h3>{title}</h3>{description && <p className="turi-post-description">{description}</p>}{children}
  </section>;
}
function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const scenarios = [
  { title: "Aviso de cierre", hint: "Revisar o posponer", text: "Mostrame el aviso al terminar el viaje y las opciones para posponerlo." },
  { title: "Resumen de gastos", hint: "Total y categorías", text: "Mostrame el resumen de gastos del viaje." },
  { title: "Día por día", hint: "Topes y aprendizajes", text: "Mostrame día por día en qué gasté y qué puedo aprender para el próximo viaje." },
  { title: "Cuentas del grupo", hint: "Quién debe a quién", text: "¿Cómo quedaron las cuentas con el grupo?" },
  { title: "Lo que sobró", hint: "Comparar o conservar", text: "¿Qué hago con los reales que me sobraron?" },
  { title: "Revisar cobros", hint: "Comparar con fuentes", text: "Quiero revisar si me cobraron de más en algún gasto del viaje." },
  { title: "Resumen para compartir", hint: "Sólo datos comunes", text: "Armame un resumen para compartir con el grupo." },
  { title: "Guardar una plantilla", hint: "Conservar y reutilizar", text: "Guardar este viaje como plantilla y mostrar mi biblioteca." },
  { title: "Mi opinión", hint: "Puntajes y aporte opcional", text: "Quiero dejar mi opinión del viaje y revisar un aporte anónimo opcional." },
  { title: "El próximo viaje", hint: "Nuevos destinos y presupuesto", text: "¿Adónde puedo ir en mi próximo viaje?" },
];
function Overview({ turi, onSend, disabled }: Props) {
  return <Surface title="Después del viaje" description={turi.state.trip.destination
    ? `Cerramos el viaje a ${turi.state.trip.destination}. Elegí qué querés revisar.`
    : "Revisemos tus gastos, las cuentas y lo que querés conservar."}>
    <div className="turi-post-shortcuts">{scenarios.map((scenario, index) => <button type="button" key={scenario.title} disabled={disabled} onClick={() => onSend(scenario.text)}>
      <span className="turi-post-shortcut-number" aria-hidden="true">{index + 1}</span>
      <span><strong>{scenario.title}</strong><small>{scenario.hint}</small></span>
      <ArrowUpRightIcon size={15} aria-hidden="true" />
    </button>)}</div>
  </Surface>;
}

function Notice({ turi, onSend, disabled }: Props) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const notice = postTripNoticeState(turi.state, { now });
  const [status, setStatus] = useState("");
  const snoozedUntil = turi.state.postTrip.notice.snoozedUntil;
  const snoozed = !!snoozedUntil && Date.parse(snoozedUntil) > Date.parse(now);
  useEffect(() => {
    if (!snoozedUntil) return;
    const timer = setTimeout(() => setNow(new Date().toISOString()), Math.min(2_000_000_000, Math.max(0, Date.parse(snoozedUntil) - Date.now() + 10)));
    return () => clearTimeout(timer);
  }, [snoozedUntil]);
  const snoozeLabel = snoozedUntil ? new Intl.DateTimeFormat("es-AR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: turi.state.trip.timeZone,
  }).format(new Date(snoozedUntil)) : "";
  const description = notice.message || {
    "eligible": "Revisemos lo que quedó pendiente del viaje.",
    "no-consent": "Los avisos están desactivados. Podés revisar el cierre cuando quieras.",
    "not-ended": "Todavía no hay un viaje finalizado con fechas válidas para este aviso.",
    "expired": "Ya pasó la ventana del aviso automático. El resumen sigue disponible.",
    "nothing-pending": "No hay cuentas calculadas ni remanentes informados pendientes.",
    "snoozed": "Guardamos tu pausa. Podés revisar el viaje antes si querés.",
    "dismissed": "Este aviso quedó descartado. El historial del viaje sigue disponible.",
    "already-notified": "Ya te mostramos el aviso de este viaje. Podés seguir con la revisión.",
  }[notice.status];
  return <Surface title="El cierre de tu viaje" description={description}>
    <div className="turi-post-notice-state">
      {notice.pendingDebts > 0 && <span>{notice.pendingDebts} {notice.pendingDebts === 1 ? "cuenta por revisar" : "cuentas por revisar"}</span>}
      {notice.reportedRemainder && <span>Remanente informado: {money(notice.reportedRemainder.amount, notice.reportedRemainder.currency)}</span>}
      {snoozed && <span>Pospuesto hasta {snoozeLabel}</span>}
      {turi.state.postTrip.notice.dismissed && <span>Aviso descartado para este viaje</span>}
    </div>
    <div className="turi-post-actions">
      <button type="button" disabled={disabled} onClick={() => onSend("Mostrame el resumen de gastos del viaje y las cuentas pendientes con el grupo.")}>Revisar el viaje</button>
      <button type="button" className="secondary" disabled={disabled || notice.daysAfter === null || notice.daysAfter < 1} onClick={() => {
        try {
          const at = new Date().toISOString();
          setNow(at);
          turi.setState(snoozePostTripNotice(turi.state, 2, at));
          setStatus("Pausa de dos días guardada. El aviso no vuelve a aparecer antes de esa fecha.");
        } catch (error) { turi.setError(messageOf(error)); }
      }}>Volver a mostrar en 2 días</button>
      <button type="button" className="text" disabled={disabled || turi.state.postTrip.notice.dismissed} onClick={() => {
        try {
          turi.setState(dismissPostTripNotice(turi.state));
          setStatus("Aviso descartado para este viaje. Podés seguir revisando el cierre desde el chat.");
        } catch (error) { turi.setError(messageOf(error)); }
      }}>Descartar este aviso</button>
    </div>
    <label className="turi-post-check"><input type="checkbox" checked={turi.state.alertsConsent} disabled={disabled} onChange={event => {
      const consent = event.target.checked;
      setNow(new Date().toISOString());
      turi.setState(previous => ({ ...previous, alertsConsent: consent }));
    }} /><span>Permitir avisos del viaje<small>Para recibirlos afuera de Turi también necesitás un canal vinculado y activo.</small></span></label>
    <p className="turi-post-note">La pausa se conserva en esta sesión. Los avisos externos requieren consentimiento, un canal vinculado y el planificador configurado.</p>
    {status && <p className="turi-post-status" role="status">{status}</p>}
  </Surface>;
}

function Templates({ turi, disabled }: Props) {
  const state = turi.state;
  const [name, setName] = useState(state.trip.destination ? `Viaje a ${state.trip.destination}` : "Mi viaje");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [deleteArchiveId, setDeleteArchiveId] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<Trip["currency"]>(state.trip.currency);
  const [destinationCurrency, setDestinationCurrency] = useState<Trip["destinationCurrency"] | "">("");
  const [timeZone, setTimeZone] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [approved, setApproved] = useState(false);
  const choices = state.assistantPreferences.checklist;
  const templates = state.postTrip.templates;
  const selected = templates.find(template => template.id === selectedId);
  // Templates keep place references, never the quoted prices or payment details.
  // Belo hotel IDs stay stable when the same hotel appears in several searches.
  const options = [...new Map(turi.messages.flatMap(message => [
    ...(message.options || []).map(({ id, name, kind, location, summary, sourceUrl }) => ({ id, name, kind, location, summary, sourceUrl })),
    ...(message.widgets || []).flatMap(widget => widget.type === "belo-hotels"
      ? widget.hotels.map(hotel => ({
        id: `belo-hotel:${hotel.id}`, name: hotel.name, kind: "hotel" as const, location: hotel.address,
        summary: "Hotel consultado en Belo Travel. Tarifas y disponibilidad a confirmar para un nuevo viaje.",
        sourceUrl: hotel.url,
      })) : []),
  ]).map(option => [option.id, option])).values()];
  const includeItinerary = state.itinerary.length > 0 && !!choices["template:itinerary"];
  const includeCategories = Object.values(state.trip.categoryBudgets).some(value => value !== undefined && value > 0) && !!choices["template:category-budgets"];
  const membersPermitted = state.members.length > 0 && state.members.every(member => member.adultConfirmed && member.consentConfirmed);
  const includeMembers = membersPermitted && !!choices["template:members"];
  const includeFavorites = !!choices["template:favorites"];
  const favorites = includeFavorites ? options.filter(option => choices[`template-favorite:${option.id}`]) : [];
  const hasSelection = includeItinerary || includeCategories || includeMembers || favorites.length > 0;
  const timeZoneValid = validTimeZone(timeZone.trim());
  const dateTimeZone = timeZoneValid ? timeZone.trim() : state.trip.timeZone;
  const newTripValid = !!destination.trim() && !!startDate && !!endDate && endDate >= startDate && Number(budget) > 0
    && !!destinationCurrency && timeZoneValid
    && Number(budget) <= 1e9 && Number.isInteger(Number(travelers)) && Number(travelers) >= 1 && Number(travelers) <= 50;
  const toggle = (key: string, checked: boolean) => {
    setStatus("");
    turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences,
      checklist: { ...previous.assistantPreferences.checklist, [key]: checked } } }));
  };
  const sections = [
    { id: "itinerary", label: "Itinerario por días", available: state.itinerary.length > 0, detail: `${state.itinerary.length} actividades como referencia, sin reservas ni vínculos de calendario.` },
    { id: "favorites", label: "Lugares favoritos", available: options.length > 0, detail: options.length ? "Elegí cuáles de las opciones consultadas querés conservar." : "Todavía no hay lugares consultados para seleccionar." },
    { id: "category-budgets", label: "Presupuesto por categoría", available: Object.values(state.trip.categoryBudgets).some(value => value !== undefined && value > 0), detail: "Los topes son históricos y se revisan para el nuevo viaje." },
    { id: "members", label: "Integrantes del grupo con permiso", available: membersPermitted, detail: "Sólo sus nombres, si cada adulto confirmó su consentimiento. No se guardan contactos." },
  ];
  return <div className="turi-post-stack"><Surface title="Guardar este viaje como plantilla" description="Elegí qué querés conservar. Guardar una plantilla no archiva ni cambia el viaje actual.">
    <label className="turi-post-field">Nombre de la plantilla<input maxLength={120} value={name} disabled={disabled} onChange={event => setName(event.target.value)} /></label>
    {sections.map(section => <div key={section.id}><label className="turi-post-check"><input type="checkbox" checked={section.available && !!choices[`template:${section.id}`]} disabled={disabled || !section.available} onChange={event => toggle(`template:${section.id}`, event.target.checked)} /><span><strong>{section.label}</strong><small>{section.detail}</small></span></label>
      {section.id === "favorites" && includeFavorites && <div className="turi-post-nested-list"><p className="turi-post-note">Elegí hasta 12 lugares por plantilla.</p>{options.map(option => <label className="turi-post-check" key={option.id}><input type="checkbox" checked={!!choices[`template-favorite:${option.id}`]} disabled={disabled || (!choices[`template-favorite:${option.id}`] && favorites.length >= 12)} onChange={event => toggle(`template-favorite:${option.id}`, event.target.checked)} /><span>{option.name}<small>{option.location}</small></span></label>)}</div>}
    </div>)}
    <div className="turi-post-actions"><button type="button" disabled={disabled || !name.trim() || !hasSelection} onClick={() => {
      try {
        const template = createTripTemplate(turi.state, { name, includeItinerary, includeCategoryBudgets: includeCategories, includeMembers,
          favorites: favorites.map(({ name: placeName, kind, location, summary, sourceUrl }) => ({ name: placeName, kind, location, summary, sourceUrl })) });
        turi.setState(saveTripTemplate(turi.state, template));
        setStatus(`“${template.name}” se guardó en tu biblioteca de esta sesión.`);
      } catch (error) { turi.setError(messageOf(error)); }
    }}><CheckIcon size={15} aria-hidden="true" />Guardar en biblioteca</button></div>
    {status && <p className="turi-post-status" role="status">{status}</p>}
  </Surface>
    <Surface title="Tu biblioteca" description={`${templates.length} de 10 plantillas guardadas. Podés exportarlas o revisar una para otro viaje.`}>
      {!templates.length && <p className="turi-post-note">Todavía no guardaste plantillas.</p>}
      <div className="turi-post-library">{templates.map(template => <article className={`turi-post-library-item ${selectedId === template.id ? "selected" : ""}`} key={template.id}>
        <strong>{template.name}</strong><small>{template.origin.destination || "Destino sin definir"} · {dateLabel(template.createdAt)}</small>
        <p>{template.itinerary.length} actividades · {template.favorites.length} favoritos · {template.members.length} integrantes</p>
        <div className="turi-post-actions"><button type="button" disabled={disabled} onClick={() => {
          const reference = tripTemplateReference(state, template);
          setSelectedId(template.id); setDestination(template.origin.destination); setStartDate(""); setEndDate("");
          setBudget(""); setCurrency(template.currency); setTravelers("1"); setApproved(false); setStatus("");
          setTimeZone(reference.timeZone || ""); setDestinationCurrency(reference.destinationCurrency || "");
        }}>Revisar para reutilizar</button><button type="button" className="secondary" onClick={() => {
          try { downloadJson({ format: "turi.trip-template.v2", importReview: true, template }, "turi-plantilla-viaje.json"); setStatus("Descarga iniciada. La plantilla también sigue en tu biblioteca."); }
          catch (error) { turi.setError(messageOf(error)); }
        }}><DownloadSimpleIcon size={15} aria-hidden="true" />Exportar</button><button type="button" className="text" disabled={disabled} onClick={() => setDeleteId(template.id)}>Quitar</button></div>
        {deleteId === template.id && <div className="turi-post-confirm"><p>¿Quitar “{template.name}” de la biblioteca? El viaje actual y sus archivos no se modifican.</p><div className="turi-post-actions"><button type="button" disabled={disabled} onClick={() => {
          try { turi.setState(removeTripTemplate(turi.state, template.id)); setDeleteId(""); if (selectedId === template.id) setSelectedId(""); }
          catch (error) { turi.setError(messageOf(error)); }
        }}>Quitar esta plantilla</button><button type="button" className="secondary" onClick={() => setDeleteId("")}>Cancelar</button></div></div>}
      </article>)}</div>
      {selected && <form className="turi-post-reuse" onSubmit={event => {
        event.preventDefault();
        if (!approved || !newTripValid || disabled) return;
        try {
          const next = startTripFromTemplate(turi.state, selected.id, { destination: destination.trim(), startDate, endDate, budget: Number(budget), currency, destinationCurrency: destinationCurrency as Trip["destinationCurrency"], timeZone: timeZone.trim(), travelers: Number(travelers) }, { approved: true });
          turi.setState(next); turi.setProposals([]); turi.setBeloProposals([]);
          turi.setMessages([{ id: crypto.randomUUID(), role: "assistant", text: `Archivamos el viaje anterior e iniciamos uno nuevo a ${next.trip.destination}, del ${next.trip.startDate} al ${next.trip.endDate}, para ${next.trip.travelers} ${next.trip.travelers === 1 ? "persona" : "personas"}, con presupuesto total de ${money(next.trip.budget, next.trip.currency)}. Zona horaria: ${next.trip.timeZone}. Moneda del destino: ${next.trip.destinationCurrency}. Los gastos y las cuentas del viaje anterior quedaron en su archivo. ¿Qué querés planificar primero?` }]);
        } catch (error) { turi.setError(messageOf(error)); }
      }}>
        <h4>Revisá el próximo viaje</h4><p className="turi-post-note">Plantilla: {selected.name}. Revisá destino, fechas, presupuesto, zona horaria y moneda local antes de iniciar.</p>
        <div className="turi-post-form-grid"><label className="turi-post-field">Destino<input value={destination} maxLength={120} required disabled={disabled} onChange={event => {
          const nextDestination = event.target.value;
          setDestination(nextDestination); setApproved(false);
          const reference = matchesDestination(nextDestination, selected.origin.destination) ? tripTemplateReference(state, selected) : {};
          setTimeZone(reference.timeZone || ""); setDestinationCurrency(reference.destinationCurrency || "");
        }} /></label>
          <label className="turi-post-field">Viajeros<input type="number" min={1} max={50} step={1} required value={travelers} disabled={disabled} onChange={event => { setTravelers(event.target.value); setApproved(false); }} /></label>
          <label className="turi-post-field">Inicio<input type="date" min={today(dateTimeZone)} required value={startDate} disabled={disabled} onChange={event => { setStartDate(event.target.value); setApproved(false); }} /></label>
          <label className="turi-post-field">Fin<input type="date" min={startDate || today(dateTimeZone)} required value={endDate} disabled={disabled} onChange={event => { setEndDate(event.target.value); setApproved(false); }} /></label>
          <label className="turi-post-field">Moneda del presupuesto<select value={currency} disabled={disabled} onChange={event => { setCurrency(event.target.value as Trip["currency"]); setApproved(false); }}>{currencies.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
          <label className="turi-post-field">Presupuesto total<input type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" required value={budget} disabled={disabled} onChange={event => { setBudget(event.target.value); setApproved(false); }} /></label>
          <label className="turi-post-field">Moneda del destino<select value={destinationCurrency} required disabled={disabled} onChange={event => { setDestinationCurrency(event.target.value as Trip["destinationCurrency"] | ""); setApproved(false); }}><option value="">Elegí la moneda local</option>{currencies.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
          <label className="turi-post-field turi-post-field-wide">Zona horaria IANA<input value={timeZone} maxLength={80} required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Ej.: Europe/Madrid" aria-invalid={!!timeZone && !timeZoneValid} disabled={disabled} onChange={event => { setTimeZone(event.target.value); setApproved(false); }} /><small>{timeZone && !timeZoneValid ? "Ingresá una zona IANA válida, por ejemplo Europe/Madrid." : "Revisá la zona de tu destino. Para un destino nuevo, completá este dato y la moneda local."}</small></label>
        </div>
        <p className="turi-post-note">Si cambiás de destino, el itinerario y los favoritos quedan sólo en la plantilla histórica. Si cambiás de moneda, no se trasladan sus topes sin conversión. Las reservas no se copian.</p>
        <label className="turi-post-check emphasized"><input type="checkbox" checked={approved} disabled={disabled || !newTripValid} onChange={event => setApproved(event.target.checked)} /><span>Revisé estos datos y quiero archivar el viaje actual e iniciar uno nuevo, sin mezclar gastos ni cuentas.</span></label>
        <div className="turi-post-actions"><button type="submit" disabled={disabled || !approved || !newTripValid}>Archivar e iniciar nuevo viaje</button><button type="button" className="secondary" onClick={() => { setSelectedId(""); setApproved(false); }}>Cancelar reutilización</button></div>
      </form>}
      {state.postTrip.archivedTrips.length > 0 && <details className="turi-post-archives"><summary>{state.postTrip.archivedTrips.length} de 10 viajes archivados</summary>{state.postTrip.archivedTrips.map(archive => <div key={archive.id}><strong>{archive.name}</strong><small>{dateLabel(archive.createdAt)} · {archive.snapshot.expenses.length} gastos conservados</small>
        <div className="turi-post-actions"><button type="button" className="secondary" onClick={() => {
          try { downloadJson({ format: "turi.trip-archive.v1", archive }, "turi-viaje-archivado.json"); setStatus("Descarga del archivo iniciada. Incluye los datos privados del viaje archivado para tu resguardo."); }
          catch (error) { turi.setError(messageOf(error)); }
        }}><DownloadSimpleIcon size={15} aria-hidden="true" />Exportar archivo privado</button><button type="button" className="text" disabled={disabled} onClick={() => setDeleteArchiveId(archive.id)}>Quitar copia archivada</button></div>
        {deleteArchiveId === archive.id && <div className="turi-post-confirm"><p>¿Quitar esta copia archivada? Exportala antes si querés conservarla fuera de Turi. El viaje activo no se modifica.</p><div className="turi-post-actions"><button type="button" disabled={disabled} onClick={() => {
          try { turi.setState(removeArchivedTrip(turi.state, archive.id)); setDeleteArchiveId(""); }
          catch (error) { turi.setError(messageOf(error)); }
        }}>Quitar este archivo</button><button type="button" className="secondary" onClick={() => setDeleteArchiveId("")}>Cancelar</button></div></div>}
      </div>)}</details>}
    </Surface>
  </div>;
}

function Feedback({ turi, disabled }: Props) {
  const [newPlace, setNewPlace] = useState("");
  const [addedPlaces, setAddedPlaces] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [reviewed, setReviewed] = useState<Selection[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedRecords, setConfirmedRecords] = useState("");
  const [status, setStatus] = useState("");
  const state = turi.state;
  const ratings = state.assistantPreferences.ratings;
  const suggestions = [...new Set([...state.itinerary.map(item => item.title), ...state.expenses.filter(item => ["Comida", "Alojamiento", "Actividades"].includes(item.category)).map(item => item.description)])].slice(0, 8);
  const places = [...new Set([...Object.keys(ratings), ...addedPlaces, ...suggestions])];
  const candidates = state.expenses.filter(expense => expense.amount > 0 && (!query || expense.description.toLowerCase().includes(query.toLowerCase()))).slice(0, 50);
  const previewResult = useMemo(() => {
    if (!reviewed) return { data: null, error: "" };
    try { return { data: buildPriceContributionPreview(state, reviewed), error: "" }; }
    catch (error) { return { data: null, error: messageOf(error) }; }
  }, [state, reviewed]);
  const preview = previewResult.data;
  const previewKey = JSON.stringify(preview?.records || []);
  const confirmedCurrent = confirmed && confirmedRecords === previewKey;
  const selectionsValid = selections.length > 0 && selections.length <= 20 && selections.every(item => item.item.trim() && item.area.trim() && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.month || ""));
  const editSelections = (next: Selection[]) => { setSelections(next); setReviewed(null); setConfirmed(false); setStatus(""); };
  const editSelection = (expenseId: string, patch: Partial<Selection>) => editSelections(selections.map(item => item.expenseId === expenseId ? { ...item, ...patch } : item));
  return <div className="turi-post-stack"><Surface title="Tu opinión del viaje" description="Calificá los lugares o actividades que visitaste. Tus puntajes se guardan para vos en este viaje.">
    {places.map(place => <div className="turi-post-rating" key={place}><strong>{place}</strong><div className="turi-post-stars" role="group" aria-label={`Puntaje para ${place}`}>
      {[1, 2, 3, 4, 5].map(value => <button type="button" key={value} disabled={disabled} aria-pressed={ratings[place] === value} aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"} para ${place}`} className={value <= (ratings[place] || 0) ? "selected" : ""} onClick={() => turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, ratings: { ...previous.assistantPreferences.ratings, [place]: value } } }))}><StarIcon size={18} weight={value <= (ratings[place] || 0) ? "fill" : "regular"} aria-hidden="true" /></button>)}
      <small>{ratings[place] ? `${ratings[place]}/5` : "Sin puntaje"}</small></div></div>)}
    <form className="turi-post-inline-form" onSubmit={event => { event.preventDefault(); if (newPlace.trim()) { setAddedPlaces(previous => [...new Set([...previous, newPlace.trim()])]); setNewPlace(""); } }}>
      <label className="turi-post-field">Otro lugar que visitaste<input maxLength={160} value={newPlace} disabled={disabled} placeholder="Nombre del lugar o actividad" onChange={event => setNewPlace(event.target.value)} /></label><button type="submit" disabled={disabled || !newPlace.trim()}>Agregar</button>
    </form>
  </Surface><Surface title="Aporte anónimo de precios" description="Es opcional y separado de tus opiniones. Primero elegí los gastos y revisá exactamente qué saldría del viaje.">
    <label className="turi-post-check emphasized"><input type="checkbox" checked={state.assistantPreferences.anonymousPriceConsent} disabled={disabled} onChange={event => {
      const consent = event.target.checked;
      turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, anonymousPriceConsent: consent } }));
      setConfirmed(false); setStatus("");
    }} /><span><strong>Permito preparar y exportar el aporte anónimo que revise</strong><small>Podés revocarlo acá. No se publica ni se envía a un servicio externo automáticamente.</small></span></label>
    {!state.expenses.length ? <p className="turi-post-note">Todavía no hay gastos registrados para preparar un aporte.</p> : <>
      <label className="turi-post-field">Buscar un gasto<input value={query} placeholder="Concepto registrado" onChange={event => setQuery(event.target.value)} /></label>
      {!candidates.length && <p className="turi-post-note">No hay gastos con importe positivo que coincidan con esta búsqueda.</p>}
      <div className="turi-post-contribution-list">{candidates.map(expense => {
        const selected = selections.find(item => item.expenseId === expense.id);
        return <div className="turi-post-contribution-item" key={expense.id}><label className="turi-post-check"><input type="checkbox" checked={!!selected} disabled={disabled || (!selected && selections.length >= 20)} onChange={event => editSelections(event.target.checked
          ? [...selections, { expenseId: expense.id, item: "", area: "", month: expense.date.slice(0, 7) }]
          : selections.filter(item => item.expenseId !== expense.id))} /><span><strong>{expense.description}</strong><small>{expense.date} · {money(expense.amount, expense.currency)}</small></span></label>
          {selected && <div className="turi-post-contribution-fields"><label className="turi-post-field">Qué fue, sin datos personales<input maxLength={100} required value={selected.item} disabled={disabled} onChange={event => editSelection(expense.id, { item: event.target.value })} /></label><label className="turi-post-field">Zona o ciudad<input maxLength={120} required value={selected.area} disabled={disabled} onChange={event => editSelection(expense.id, { area: event.target.value })} /></label><label className="turi-post-field">Mes observado<input type="month" required value={selected.month} disabled={disabled} onChange={event => editSelection(expense.id, { month: event.target.value })} /></label></div>}
        </div>;
      })}</div>
      <p className="turi-post-note">Elegí hasta 20 registros por aporte y completá concepto y zona sin nombres, direcciones privadas ni datos de cuenta. Se conserva el importe y la moneda originales; no se convierten a reales sin una equivalencia comprobada.</p>
      <div className="turi-post-actions"><button type="button" disabled={disabled || !selectionsValid} onClick={() => {
        try { buildPriceContributionPreview(state, selections); setReviewed(selections.map(item => ({ ...item }))); setConfirmed(false); setStatus(""); }
        catch (error) { turi.setError(messageOf(error)); }
      }}>Revisar vista previa</button><button type="button" className="secondary" disabled={disabled || (!selections.length && !reviewed)} onClick={() => editSelections([])}>Cancelar selección</button></div>
    </>}
    {previewResult.error && <p className="turi-post-note" role="alert">Revisá la selección nuevamente: {previewResult.error}</p>}
    {preview && <div className="turi-post-contribution-preview"><h4>Esto es lo que vas a exportar</h4>
      {preview.records.map((record, index) => <article key={index}><strong>{record.item}</strong><span>{record.area} · {record.month}</span><b>{money(record.amount, record.currency)}</b></article>)}
      <p className="turi-post-note">Sólo concepto, zona, importe, moneda y mes. El archivo no lleva identificadores de gastos, nombres de integrantes, contactos ni credenciales.</p>
      <label className="turi-post-check"><input type="checkbox" checked={confirmedCurrent} disabled={disabled || !state.assistantPreferences.anonymousPriceConsent || !preview.canExport} onChange={event => { setConfirmed(event.target.checked); setConfirmedRecords(previewKey); }} /><span>Revisé estos registros y confirmo que quiero guardar este aporte y descargar su JSON.</span></label>
      <div className="turi-post-actions"><button type="button" disabled={disabled || !confirmedCurrent || !preview.canExport || !state.assistantPreferences.anonymousPriceConsent} onClick={() => {
        if (!reviewed) return;
        try {
          const saved = savePriceContributions(turi.state, reviewed, { consent: true });
          const ids = saved.postTrip.priceContributions.filter(draft => reviewed.some(selection => selection.expenseId === draft.expenseId)).map(draft => draft.id);
          const payload = exportPriceContributions(saved, ids);
          downloadJson(payload, "turi-aporte-precios-anonimo.json"); turi.setState(saved);
          setConfirmed(false); setStatus("Aporte guardado y descarga iniciada. No se publicó ni envió a ningún servicio externo.");
        } catch (error) { turi.setError(messageOf(error)); }
      }}><DownloadSimpleIcon size={15} aria-hidden="true" />Confirmar y exportar JSON</button></div>
    </div>}
    {status && <p className="turi-post-status" role="status">{status}</p>}
  </Surface></div>;
}

export default function PostTripPanels(props: Props) {
  switch (props.kind) {
    case "post-trip-overview": return <Overview {...props} />;
    case "post-trip-notice": return <Notice {...props} />;
    case "template": return <Templates {...props} />;
    case "feedback": return <Feedback {...props} />;
    case "recap": return <Recap {...props} />;
  }
}

function Recap({ turi }: Props) {
  const recap = useMemo(() => buildConversationPanels(turi.state).recap, [turi.state]);
  const ratedPlaces = Object.entries(turi.state.assistantPreferences.ratings).sort((a, b) => b[1] - a[1]);
  const [includeFavorite, setIncludeFavorite] = useState(false);
  const [favorite, setFavorite] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [copiedText, setCopiedText] = useState("");
  const [status, setStatus] = useState("");
  const chosenFavorite = favorite || ratedPlaces[0]?.[0];
  const content = [
    `Resumen del viaje${recap.destination ? ` a ${recap.destination}` : ""}`,
    recap.startDate && recap.endDate ? `${recap.startDate} al ${recap.endDate} · ${recap.days} días` : "Fechas sin definir",
    `Gastos comunes: ${money(recap.sharedTotal, recap.currency)} · ${recap.sharedExpenseCount} registros`,
    `${recap.participantCount} participantes en gastos comunes`,
    recap.topCategory ? `Categoría principal en comunes: ${recap.topCategory}` : "",
    recap.largestDay ? `Día de mayor gasto común: ${dateLabel(`${recap.largestDay.date}T00:00:00Z`)} · ${money(recap.largestDay.amount, recap.currency)}` : "",
    `Transferencias calculadas por revisar: ${recap.pendingTransfers}`,
    includeFavorite && chosenFavorite ? `Lo mejor del viaje, elegido por mí: ${chosenFavorite}` : "",
  ].filter(Boolean).join("\n");
  return <Surface title="Resumen para compartir" description="Primero revisá qué querés mostrar. Los importes son sólo de gastos comunes.">
    {cancelled ? <><p className="turi-post-note">Preparación cerrada. Podés armar otra vista previa cuando quieras.</p><div className="turi-post-actions"><button type="button" onClick={() => { setCancelled(false); setStatus(""); }}>Preparar de nuevo</button></div></> : <>
      {ratedPlaces.length > 0 && <div className="turi-post-optional-favorite"><label className="turi-post-check"><input type="checkbox" checked={includeFavorite} onChange={event => { setIncludeFavorite(event.target.checked); setStatus(""); }} /><span>Incluir un lugar favorito de mis opiniones</span></label>
        {includeFavorite && <label className="turi-post-field">Lugar que quiero compartir<select value={chosenFavorite} onChange={event => { setFavorite(event.target.value); setStatus(""); }}>{ratedPlaces.map(([place, rating]) => <option key={place} value={place}>{place} · {rating}/5</option>)}</select></label>}
      </div>}
      <div className="turi-post-share-preview">{content}</div>
      <p className="turi-post-note">No incluye gastos personales, saldo, contactos ni presupuesto privado. El favorito sólo aparece si lo elegís arriba.</p>
      <div className="turi-post-actions"><button type="button" disabled={!recap.sharedExpenseCount} onClick={async () => {
        try { await navigator.clipboard.writeText(content); setCopiedText(content); setStatus("Resumen copiado. Vos elegís dónde pegarlo."); }
        catch { turi.setError("No pude copiarlo. Podés seleccionar el texto de la vista previa y copiarlo."); }
      }}><CopyIcon size={15} aria-hidden="true" />{copiedText === content ? "Copiado" : "Copiar resumen"}</button>
        <button type="button" className="secondary" disabled={!recap.sharedExpenseCount} onClick={async () => {
          if (!navigator.share) { setStatus("Este navegador no ofrece compartir directamente. Usá Copiar resumen para elegir dónde pegarlo."); return; }
          try { await navigator.share({ title: "Resumen de viaje con Turi", text: content }); setStatus("El resumen se pasó a la opción de compartir elegida."); }
          catch (error) { setStatus(error instanceof Error && error.name === "AbortError" ? "No se compartió el resumen." : "No pude abrir la opción de compartir. Podés copiar la vista previa."); }
        }}><ShareNetworkIcon size={15} aria-hidden="true" />Compartir</button>
        <button type="button" className="text" onClick={() => { setCancelled(true); setIncludeFavorite(false); setCopiedText(""); setStatus(""); }}>Cancelar preparación</button>
      </div>
      {status && <p className="turi-post-status" role="status">{status}</p>}
    </>}
  </Surface>;
}
