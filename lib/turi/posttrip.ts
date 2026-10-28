import { z } from "zod";
import {
  archivedTripSchema, emptyWorkspace, localTimeToIso, postTripSchema,
  priceContributionSchema, reportedRemainderSchema, savedTripTemplateSchema,
  settleExpenses, templateFavoriteSchema, tripSchema, workspaceSchema,
  type ArchivedTrip, type PostTripState, type PriceContribution,
  type SavedTripTemplate, type Trip, type Workspace,
} from "./domain";
export type { ArchivedTrip, SavedTripTemplate, PriceContribution, PostTripState } from "./domain";

const DAY_MS = 86400000;
const dateValue = (value: string) => Date.parse(`${value}T00:00:00Z`);
const instant = (value = new Date().toISOString()) => z.iso.datetime().parse(value);
const postTrip = (state: Workspace): PostTripState => postTripSchema.parse(state.postTrip ?? {});
const commit = (state: Workspace, value: PostTripState): Workspace => workspaceSchema.parse({ ...state, postTrip: value });
const cleanText = (value: string, max: number) => {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > max || /[<>\u0000-\u001f\u007f]/.test(text)) throw new Error("Revisá el texto: no puede estar vacío ni contener etiquetas o caracteres de control.");
  return text;
};
const localDate = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const sameDestination = (a: string, b: string) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function setReportedRemainder(
  state: Workspace,
  input: { amount: number; currency: Trip["currency"]; status?: "undecided" | "keep" },
  now?: string,
): Workspace {
  const current = postTrip(state);
  const remainder = reportedRemainderSchema.parse({ ...input, status: input.status ?? "undecided", updatedAt: instant(now) });
  return commit(state, { ...current, remainder });
}

export function clearReportedRemainder(state: Workspace): Workspace {
  return commit(state, { ...postTrip(state), remainder: null });
}

export type PostTripNoticeStatus = "eligible" | "no-consent" | "not-ended" | "expired" | "nothing-pending" | "snoozed" | "dismissed" | "already-notified";
export type PostTripNoticeState = {
  status: PostTripNoticeStatus;
  eligible: boolean;
  pendingDebts: number;
  reportedRemainder: { amount: number; currency: string } | null;
  daysAfter: number | null;
  message: string | null;
};

/** Calendar-day window from the reference, extended only by an explicit snooze.
 * A user-reported remainder is labelled as such, never as a verified balance.
 */
export function postTripNoticeState(state: Workspace, options: { now?: string; date?: string } = {}): PostTripNoticeState {
  const now = instant(options.now);
  const current = postTrip(state);
  const date = options.date ?? localDate(now, state.trip.timeZone);
  const end = state.trip.endDate;
  const daysAfter = end && Number.isFinite(dateValue(end)) && Number.isFinite(dateValue(date))
    ? Math.floor((dateValue(date) - dateValue(end)) / DAY_MS) : null;
  const pendingDebts = settleExpenses(state.expenses).transfers.length;
  const reportedRemainder = current.remainder && current.remainder.amount > 0
    ? { amount: current.remainder.amount, currency: current.remainder.currency } : null;
  const result = (status: PostTripNoticeStatus): PostTripNoticeState => ({ status, eligible: status === "eligible", pendingDebts, reportedRemainder, daysAfter, message: null });
  if (!state.alertsConsent) return result("no-consent");
  if (daysAfter === null || daysAfter < 1) return result("not-ended");
  if (current.notice.dismissed) return result("dismissed");
  if (!pendingDebts && !reportedRemainder) return result("nothing-pending");
  if (current.notice.snoozedUntil && Date.parse(current.notice.snoozedUntil) > Date.parse(now)) return result("snoozed");
  const explicitSnoozeDay = current.notice.snoozedUntil
    ? Math.ceil((dateValue(localDate(current.notice.snoozedUntil, state.trip.timeZone)) - dateValue(end)) / DAY_MS) : 0;
  if (daysAfter > Math.max(14, explicitSnoozeDay)) return result("expired");
  if (current.notice.lastNotifiedAt) return result("already-notified");
  const parts = [
    pendingDebts ? `${pendingDebts} ${pendingDebts === 1 ? "cuenta calculada pendiente" : "cuentas calculadas pendientes"} con tu grupo` : "",
    reportedRemainder ? `${reportedRemainder.currency} ${reportedRemainder.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })} que informaste que te sobraron` : "",
  ].filter(Boolean);
  return { ...result("eligible"), message: `Te ${parts.length > 1 || pendingDebts !== 1 ? "quedan" : "queda"} ${parts.join(" y ")}. ¿Lo revisamos?` };
}

export function snoozePostTripNotice(state: Workspace, days = 2, now?: string): Workspace {
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error("Elegí entre 1 y 14 días para el recordatorio.");
  const value = postTrip(state);
  const at = instant(now);
  return commit(state, { ...value, notice: { dismissed: false, lastNotifiedAt: null, snoozedUntil: new Date(Date.parse(at) + days * DAY_MS).toISOString() } });
}

export function dismissPostTripNotice(state: Workspace): Workspace {
  const value = postTrip(state);
  return commit(state, { ...value, notice: { ...value.notice, dismissed: true, snoozedUntil: null } });
}

export function markPostTripNoticeSent(state: Workspace, now?: string): Workspace {
  const value = postTrip(state);
  return commit(state, { ...value, notice: { ...value.notice, lastNotifiedAt: instant(now) } });
}

/** Include the account id in the scheduler key; this is only the trip identity. */
export function postTripNoticeKey(state: Workspace): string {
  return JSON.stringify([postTrip(state).tripId, state.trip.destination, state.trip.startDate, state.trip.endDate]);
}

export function budgetAlertAllowed(state: Workspace, date: string): boolean {
  return !state.trip.endDate || date <= state.trip.endDate;
}

export type TripTemplateInput = {
  name: string;
  includeItinerary?: boolean;
  includeCategoryBudgets?: boolean;
  includeMembers?: boolean;
  favorites?: z.infer<typeof templateFavoriteSchema>[];
};
export function createTripTemplate(state: Workspace, input: TripTemplateInput, now?: string): SavedTripTemplate {
  const start = dateValue(state.trip.startDate);
  if (input.includeItinerary && state.itinerary.length && !Number.isFinite(start)) throw new Error("Definí el inicio del viaje antes de guardar un itinerario por días.");
  if (input.includeMembers && state.members.some((member) => !member.adultConfirmed || !member.consentConfirmed)) throw new Error("Cada integrante adulto debe dar permiso antes de conservar su nombre.");
  const itinerary = input.includeItinerary ? state.itinerary.map((item) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: state.trip.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(item.start)).map((part) => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    return { title: item.title, dayOffset: Math.round((dateValue(date) - start) / DAY_MS), startTime: `${parts.hour}:${parts.minute}`,
      durationMinutes: Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60000), location: item.location, notes: item.notes };
  }) : [];
  const end = dateValue(state.trip.endDate);
  return savedTripTemplateSchema.parse({
    id: crypto.randomUUID(), name: cleanText(input.name, 120), createdAt: instant(now),
    origin: { destination: state.trip.destination, startDate: state.trip.startDate, endDate: state.trip.endDate,
      timeZone: state.trip.timeZone, destinationCurrency: state.trip.destinationCurrency,
      days: Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / DAY_MS) + 1 : 0 },
    currency: state.trip.currency,
    categoryBudgets: input.includeCategoryBudgets ? state.trip.categoryBudgets : {},
    itinerary,
    members: input.includeMembers ? state.members.map(({ name }) => ({ name })) : [],
    favorites: input.favorites ?? [],
  });
}

export function saveTripTemplate(state: Workspace, template: SavedTripTemplate): Workspace {
  const value = postTrip(state);
  const parsed = savedTripTemplateSchema.parse(template);
  if (value.templates.some((item) => item.id === parsed.id)) throw new Error("Esta plantilla ya está guardada. No se sobrescribió.");
  if (value.templates.length >= 10) throw new Error("Podés conservar hasta 10 plantillas. Exportá y quitá alguna antes de guardar otra.");
  return commit(state, { ...value, templates: [...value.templates, parsed] });
}
export function removeTripTemplate(state: Workspace, id: string): Workspace {
  const value = postTrip(state);
  return commit(state, { ...value, templates: value.templates.filter((item) => item.id !== id) });
}

/** Explicit whitelist snapshots keep no auth tokens, contacts or Calendar IDs. */
export function archiveCurrentTrip(state: Workspace, options: { name?: string; now?: string } = {}): Workspace {
  const value = postTrip(state);
  const snapshot = archivedTripSchema.shape.snapshot.parse({
    trip: state.trip, expenses: state.expenses,
    members: state.members.map(({ id, name, adultConfirmed, consentConfirmed }) => ({ id, name, adultConfirmed, consentConfirmed })),
    itinerary: state.itinerary.map(({ id, title, start, end, location, notes, reminderMinutes }) => ({ id, title, start, end, location, notes, reminderMinutes })),
    reminders: state.reminders, rateAlerts: state.rateAlerts,
    assistantPreferences: state.assistantPreferences, remainder: value.remainder,
  });
  if (value.archivedTrips.some((item) => JSON.stringify(item.snapshot) === JSON.stringify(snapshot))) return state;
  if (value.archivedTrips.length >= 10) throw new Error("Podés conservar hasta 10 viajes archivados. Exportá y quitá uno antes de archivar otro.");
  const archive: ArchivedTrip = archivedTripSchema.parse({ id: crypto.randomUUID(), name: cleanText(options.name ?? (state.trip.destination || "Mi viaje"), 120), createdAt: instant(options.now), snapshot });
  return commit(state, { ...value, archivedTrips: [...value.archivedTrips, archive] });
}
/** Closing archives the trip as closed and starts a new one in planning.
 * The group, consents, templates and earlier archives carry over. */
export function closeCurrentTrip(state: Workspace, options: { now?: string } = {}): Workspace {
  if (!state.trip.destination) throw new Error("Elegí un destino antes de cerrar el viaje.");
  const archived = archiveCurrentTrip({ ...state, trip: { ...state.trip, status: "closed" } }, options);
  const fresh = emptyWorkspace();
  return workspaceSchema.parse({
    ...fresh,
    members: state.members,
    alertsConsent: state.alertsConsent,
    assistantPreferences: { ...fresh.assistantPreferences, anonymousPriceConsent: state.assistantPreferences.anonymousPriceConsent },
    postTrip: { ...postTrip(archived), tripId: crypto.randomUUID(), remainder: null, notice: fresh.postTrip.notice },
  });
}
/** A reviewed trip update that sets status closed goes through closeCurrentTrip. */
export function settleTripStatus(state: Workspace): Workspace {
  return state.trip.status === "closed" ? closeCurrentTrip(state) : state;
}
export function removeArchivedTrip(state: Workspace, id: string): Workspace {
  const value = postTrip(state);
  return commit(state, { ...value, archivedTrips: value.archivedTrips.filter((item) => item.id !== id) });
}

export type TripTemplateReference = Pick<SavedTripTemplate["origin"], "timeZone" | "destinationCurrency">;

/** Historical references for review, never defaults for a different destination.
 * Old templates can recover them from their exact archived trip or a current
 * trip with the same destination; callers must still submit reviewed values.
 */
export function tripTemplateReference(state: Workspace, template: SavedTripTemplate): TripTemplateReference {
  const archived = [...postTrip(state).archivedTrips].reverse().find(({ snapshot }) =>
    sameDestination(snapshot.trip.destination, template.origin.destination) &&
    snapshot.trip.startDate === template.origin.startDate && snapshot.trip.endDate === template.origin.endDate,
  )?.snapshot.trip;
  const current = sameDestination(state.trip.destination, template.origin.destination) ? state.trip : undefined;
  return {
    timeZone: template.origin.timeZone ?? archived?.timeZone ?? current?.timeZone,
    destinationCurrency: template.origin.destinationCurrency ?? archived?.destinationCurrency ?? current?.destinationCurrency,
  };
}

export type ReviewedTemplateTrip = Partial<Trip> & Pick<Trip, "destination" | "startDate" | "endDate" | "timeZone" | "destinationCurrency">;

export function startTripFromTemplate(
  state: Workspace,
  templateId: string,
  newTrip: ReviewedTemplateTrip,
  options: { approved: true; now?: string },
): Workspace {
  if (options.approved !== true) throw new Error("Revisá y aprobá archivar el viaje actual e iniciar el nuevo.");
  const template = postTrip(state).templates.find((item) => item.id === templateId);
  if (!template) throw new Error("La plantilla elegida ya no está disponible.");
  if (!newTrip.timeZone || !newTrip.destinationCurrency) throw new Error("Elegí y revisá la zona horaria y la moneda del destino del nuevo viaje. No se completan automáticamente.");
  const trip = tripSchema.parse(newTrip);
  if (!trip.destination.trim() || !trip.startDate || !trip.endDate || trip.endDate < trip.startDate || trip.returnReserve > trip.budget) throw new Error("Revisá destino, fechas y presupuesto del nuevo viaje.");
  const categoryBudgets = trip.currency === template.currency ? template.categoryBudgets : {};
  if (Object.values(categoryBudgets).reduce((sum, amount) => sum + (amount ?? 0), 0) > trip.budget - trip.returnReserve) throw new Error("El nuevo presupuesto no alcanza para los topes por categoría guardados. Ajustalos antes de iniciar.");
  const copyPlaces = sameDestination(trip.destination, template.origin.destination);
  const itinerary = copyPlaces ? template.itinerary.map((item) => {
    const date = new Date(dateValue(trip.startDate) + item.dayOffset * DAY_MS).toISOString().slice(0, 10);
    if (date < trip.startDate || date > trip.endDate) throw new Error("Hay actividades de la plantilla fuera de las nuevas fechas. Revisá la duración antes de iniciar.");
    const start = localTimeToIso(`${date}T${item.startTime}`, trip.timeZone);
    return { id: crypto.randomUUID(), title: item.title, start,
      end: new Date(Date.parse(start) + item.durationMinutes * 60000).toISOString(), location: item.location, notes: item.notes, reminderMinutes: 60 };
  }) : [];
  const archived = archiveCurrentTrip(state, { now: options.now });
  const previous = postTrip(archived);
  const initial = emptyWorkspace();
  return workspaceSchema.parse({
    ...initial, trip: { ...trip, categoryBudgets }, itinerary,
    members: template.members.map(({ name }) => ({ id: crypto.randomUUID(), name, email: "", belotag: "", adultConfirmed: true, consentConfirmed: false })),
    postTrip: { ...previous, tripId: crypto.randomUUID(), remainder: null, notice: { snoozedUntil: null, dismissed: false, lastNotifiedAt: null } },
  });
}

export type PriceContributionSelection = { expenseId: string; item: string; area: string; month?: string };
export type AnonymousPriceRecord = Pick<PriceContribution, "item" | "area" | "amount" | "currency" | "month">;
const safeObservationText = (value: string, max: number) => {
  const text = cleanText(value, max);
  if (/@|https?:|\b(?:\+?\d[\d\s()-]{7,}\d)\b/i.test(text)) throw new Error("Quitá nombres de cuenta, contactos, enlaces y teléfonos del aporte antes de exportarlo.");
  return text;
};
function selectedObservations(state: Workspace, selections: PriceContributionSelection[]): { selection: PriceContributionSelection; record: AnonymousPriceRecord }[] {
  if (!selections.length || selections.length > 20 || new Set(selections.map((item) => item.expenseId)).size !== selections.length) throw new Error("Elegí entre 1 y 20 gastos distintos para revisar.");
  return selections.map((selection) => {
    const expense = state.expenses.find((item) => item.id === selection.expenseId);
    if (!expense) throw new Error("Uno de los gastos elegidos ya no está en el viaje.");
    const record = priceContributionSchema.omit({ id: true, expenseId: true, createdAt: true }).parse({
      item: safeObservationText(selection.item, 100), area: safeObservationText(selection.area, 120),
      amount: expense.amount, currency: expense.currency, month: selection.month ?? expense.date.slice(0, 7),
    });
    return { selection, record };
  });
}
export function buildPriceContributionPreview(state: Workspace, selections: PriceContributionSelection[]) {
  return { records: selectedObservations(state, selections).map(({ record }) => record), canExport: state.assistantPreferences.anonymousPriceConsent };
}
export function savePriceContributions(state: Workspace, selections: PriceContributionSelection[], options: { consent: true; now?: string }): Workspace {
  if (options.consent !== true || !state.assistantPreferences.anonymousPriceConsent) throw new Error("Revisá los datos y activá el permiso de aporte antes de guardarlo o exportarlo.");
  const value = postTrip(state);
  const next = [...value.priceContributions];
  for (const { selection, record } of selectedObservations(state, selections)) {
    const existing = next.find((item) => item.expenseId === selection.expenseId);
    const draft = priceContributionSchema.parse({ ...record, expenseId: selection.expenseId, id: existing?.id ?? crypto.randomUUID(), createdAt: instant(options.now) });
    if (existing) next[next.indexOf(existing)] = draft;
    else next.push(draft);
  }
  if (next.length > 50) throw new Error("Podés conservar hasta 50 aportes locales. Exportá y quitá alguno antes de agregar otro.");
  return commit(state, { ...value, priceContributions: next });
}
export function exportPriceContributions(state: Workspace, ids?: string[]) {
  if (!state.assistantPreferences.anonymousPriceConsent) throw new Error("El permiso está desactivado. No se exportó ningún aporte.");
  const value = postTrip(state);
  const chosen = ids ? new Set(ids) : null;
  const records = value.priceContributions.filter((item) => !chosen || chosen.has(item.id)).map(({ item, area, amount, currency, month }) => ({ item, area, amount, currency, month }));
  if (!records.length) throw new Error("Elegí aportes guardados para exportar.");
  return { format: "turi.price-observations.v1" as const, published: false as const, records };
}
export function removePriceContributions(state: Workspace, ids: string[]): Workspace {
  const value = postTrip(state);
  const removed = new Set(ids);
  return commit(state, { ...value, priceContributions: value.priceContributions.filter((item) => !removed.has(item.id)) });
}
