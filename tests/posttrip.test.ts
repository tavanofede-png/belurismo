import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, equalShares, expenseSchema, workspaceSchema, type Workspace } from "../lib/turi/domain";
import {
  archiveCurrentTrip, budgetAlertAllowed, buildPriceContributionPreview,
  clearReportedRemainder, createTripTemplate, dismissPostTripNotice,
  exportPriceContributions, markPostTripNoticeSent, postTripNoticeKey,
  postTripNoticeState, removeArchivedTrip, removeTripTemplate,
  savePriceContributions, saveTripTemplate, setReportedRemainder,
  snoozePostTripNotice, startTripFromTemplate, tripTemplateReference,
} from "../lib/turi/posttrip";
import { shouldNotifyPostTrip } from "../lib/turi/conversation-panels";

const NOW = "2027-01-11T15:00:00.000Z";
function trip(): Workspace {
  const state = emptyWorkspace();
  state.trip = { ...state.trip, destination: "Florianópolis", startDate: "2027-01-05", endDate: "2027-01-10", timeZone: "America/Sao_Paulo", budget: 300000, categoryBudgets: { Comida: 50000 } };
  state.members = [{ id: "lu", name: "Lu", email: "private@example.com", belotag: "private-tag", adultConfirmed: true, consentConfirmed: true }];
  state.expenses = [expenseSchema.parse({ id: "meal", description: "Cena", amount: 100, currency: "BRL", homeAmount: 26000, date: "2027-01-06", category: "Comida", payer: "me", shares: equalShares(26000, ["me", "lu"]) })];
  state.itinerary = [{ id: "old-activity", title: "Paseo", start: "2027-01-06T13:00:00.000Z", end: "2027-01-06T15:00:00.000Z", location: "Centro", notes: "Revisar horario del operador", reminderMinutes: 60, calendarEventId: "old-calendar-event" }];
  return state;
}

test("old workspace data gets safe post-trip defaults without losing the existing trip", () => {
  const previous = { ...trip(), postTrip: undefined };
  const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(previous)));
  assert.equal(restored.trip.destination, "Florianópolis");
  assert.equal(restored.postTrip.remainder, null);
  assert.deepEqual(restored.postTrip.templates, []);
  assert.deepEqual(restored.postTrip.archivedTrips, []);
  assert.deepEqual(restored.postTrip.flightWatches, []);
});

test("a reported remainder is persisted as a declaration and never inferred from a budget", () => {
  const original = trip();
  const state = setReportedRemainder(original, { amount: 240.25, currency: "BRL", status: "keep" }, NOW);
  assert.deepEqual(state.postTrip.remainder, { amount: 240.25, currency: "BRL", status: "keep", updatedAt: NOW });
  assert.equal(original.postTrip.remainder, null);
  assert.equal(state.trip.budget, original.trip.budget);
  assert.equal(clearReportedRemainder(state).postTrip.remainder, null);
  assert.throws(() => setReportedRemainder(original, { amount: -1, currency: "BRL" }, NOW));
});

test("post-trip eligibility respects local next-day dates, consent and recorded debts or a declared remainder", () => {
  let state = trip();
  assert.equal(postTripNoticeState(state, { now: NOW }).status, "no-consent");
  state.alertsConsent = true;
  assert.equal(postTripNoticeState(state, { now: "2027-01-11T01:00:00.000Z" }).status, "not-ended", "it is still January10 in São Paulo");
  assert.equal(postTripNoticeState(state, { now: NOW }).pendingDebts, 1);
  assert.equal(postTripNoticeState(state, { now: NOW }).eligible, true);
  state.expenses = [];
  assert.equal(postTripNoticeState(state, { now: NOW }).status, "nothing-pending");
  state = setReportedRemainder(state, { amount: 240, currency: "BRL" }, NOW);
  const notice = postTripNoticeState(state, { now: NOW });
  assert.equal(notice.eligible, true);
  assert.equal(notice.pendingDebts, 0);
  assert.match(notice.message!, /informaste/);
  assert.doesNotMatch(notice.message!, /saldo confirmado|saldo de tu cuenta/);
  assert.equal(postTripNoticeState(state, { now: "2027-01-25T15:00:00.000Z" }).status, "expired");
  assert.ok(shouldNotifyPostTrip(state, "2027-01-11"), "the shared UI/cron helper includes a declared remainder without group debts");
});

test("snooze suppresses repeat notices for exactly two days and dismiss persists", () => {
  const state = trip();
  state.alertsConsent = true;
  const notified = markPostTripNoticeSent(state, NOW);
  assert.equal(postTripNoticeState(notified, { now: NOW }).status, "already-notified");
  const snoozed = snoozePostTripNotice(notified, 2, NOW);
  assert.equal(snoozed.postTrip.notice.snoozedUntil, "2027-01-13T15:00:00.000Z");
  assert.equal(postTripNoticeState(snoozed, { now: "2027-01-13T14:59:00.000Z" }).status, "snoozed");
  assert.equal(postTripNoticeState(snoozed, { now: "2027-01-13T15:00:00.000Z" }).status, "eligible");
  assert.equal(postTripNoticeState(dismissPostTripNotice(snoozed), { now: "2027-01-14T15:00:00.000Z" }).status, "dismissed");
  assert.throws(() => snoozePostTripNotice(state, 0, NOW));
});

test("notice identity changes for a new trip; budget alerts stop after the trip's local end date", () => {
  const state = trip();
  assert.equal(budgetAlertAllowed(state, "2027-01-10"), true);
  assert.equal(budgetAlertAllowed(state, "2027-01-11"), false);
  const newIdentity = { ...state, postTrip: { ...state.postTrip, tripId: "new-trip" } };
  assert.notEqual(postTripNoticeKey(state), postTripNoticeKey(newIdentity));
});

test("templates preserve local activity time, selected categories and permitted names without Calendar/contact data", () => {
  const state = trip();
  const template = createTripTemplate(state, { name: "Brasil en familia", includeItinerary: true, includeCategoryBudgets: true, includeMembers: true }, NOW);
  assert.equal(template.itinerary[0].dayOffset, 1);
  assert.equal(template.itinerary[0].startTime, "10:00");
  assert.equal(template.itinerary[0].durationMinutes, 120);
  assert.equal(template.origin.timeZone, "America/Sao_Paulo");
  assert.equal(template.origin.destinationCurrency, "BRL");
  assert.deepEqual(template.members, [{ name: "Lu" }]);
  assert.deepEqual(template.categoryBudgets, { Comida: 50000 });
  assert.doesNotMatch(JSON.stringify(template), /old-calendar-event|old-activity|private@example|private-tag/);
  const saved = saveTripTemplate(state, template);
  assert.equal(saved.postTrip.templates.length, 1);
  assert.equal(state.postTrip.templates.length, 0);
  assert.throws(() => saveTripTemplate(saved, template), /sobrescrib/);
  assert.equal(removeTripTemplate(saved, template.id).postTrip.templates.length, 0);
  state.members[0].consentConfirmed = false;
  assert.throws(() => createTripTemplate(state, { name: "Sin permiso", includeMembers: true }, NOW), /permiso/);
});

test("archiving is bounded, idempotent and keeps financial records while stripping connection identifiers", () => {
  const state = trip();
  const archived = archiveCurrentTrip(state, { now: NOW });
  assert.equal(archived.postTrip.archivedTrips.length, 1);
  assert.equal(archived.postTrip.archivedTrips[0].snapshot.expenses[0].homeAmount, 26000);
  assert.doesNotMatch(JSON.stringify(archived.postTrip.archivedTrips), /private@example|private-tag|old-calendar-event/);
  assert.equal(archiveCurrentTrip(archived, { now: NOW }).postTrip.archivedTrips.length, 1);
  assert.equal(removeArchivedTrip(archived, archived.postTrip.archivedTrips[0].id).postTrip.archivedTrips.length, 0);
  const full = { ...state, postTrip: { ...state.postTrip, archivedTrips: Array.from({ length: 10 }, (_, index) => ({ ...archived.postTrip.archivedTrips[0], id: `archive-${index}`, snapshot: { ...archived.postTrip.archivedTrips[0].snapshot, expenses: [] } })) } };
  assert.throws(() => archiveCurrentTrip(full, { now: NOW }), /10 viajes/);
});

test("starting a reviewed trip archives the original and regenerates IDs without old expenses or scheduled actions", () => {
  const original = trip();
  original.alertsConsent = true;
  original.reminders = [{ id: "old-reminder", title: "Recordatorio anterior", at: NOW, sent: false }];
  const template = createTripTemplate(original, { name: "Mismo destino", includeItinerary: true, includeCategoryBudgets: true, includeMembers: true }, NOW);
  const state = saveTripTemplate(original, template);
  const next = startTripFromTemplate(state, template.id, { destination: "Florianópolis", startDate: "2027-02-05", endDate: "2027-02-10", budget: 300000, currency: "ARS", timeZone: "America/Sao_Paulo", destinationCurrency: "BRL" }, { approved: true, now: NOW });
  assert.equal(next.postTrip.archivedTrips.length, 1);
  assert.equal(next.postTrip.archivedTrips[0].snapshot.trip.startDate, "2027-01-05");
  assert.equal(next.expenses.length, 0);
  assert.equal(next.reminders.length, 0);
  assert.equal(next.rateAlerts.length, 0);
  assert.equal(next.alertsConsent, false);
  assert.notEqual(next.postTrip.tripId, state.postTrip.tripId);
  assert.notEqual(next.itinerary[0].id, "old-activity");
  assert.equal(next.itinerary[0].start, "2027-02-06T13:00:00.000Z");
  assert.equal(next.itinerary[0].calendarEventId, undefined);
  assert.notEqual(next.members[0].id, "lu");
  assert.equal(next.members[0].consentConfirmed, false);
  assert.equal(original.expenses.length, 1, "the original is never mutated");
});

test("changing destination or currency does not transplant locations or silently convert old category budgets", () => {
  const state = trip();
  const template = createTripTemplate(state, { name: "Referencia", includeItinerary: true, includeCategoryBudgets: true }, NOW);
  const saved = saveTripTemplate(state, template);
  const next = startTripFromTemplate(saved, template.id, { destination: "Lisboa", startDate: "2027-02-05", endDate: "2027-02-10", budget: 1000, currency: "EUR", timeZone: "Europe/Lisbon", destinationCurrency: "EUR" }, { approved: true, now: NOW });
  assert.deepEqual(next.itinerary, []);
  assert.deepEqual(next.trip.categoryBudgets, {});
  assert.equal(next.postTrip.templates[0].itinerary.length, 1, "historical locations remain in the reference template");
  assert.throws(() => startTripFromTemplate(saved, template.id, { destination: "Florianópolis", startDate: "2027-02-05", endDate: "2027-02-10", budget: 100, currency: "ARS", timeZone: "America/Sao_Paulo", destinationCurrency: "BRL" }, { approved: true, now: NOW }), /topes por categor/);
});

test("legacy templates recover references only from their destination and still require explicit review", () => {
  const original = trip();
  const template = createTripTemplate(original, { name: "Anterior", includeItinerary: true }, NOW);
  delete template.origin.timeZone;
  delete template.origin.destinationCurrency;
  let saved = saveTripTemplate(original, template);
  const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.postTrip.templates[0].origin.timeZone, undefined, "old saved data must not receive a guessed default");
  assert.deepEqual(tripTemplateReference(restored, template), { timeZone: "America/Sao_Paulo", destinationCurrency: "BRL" });
  saved = archiveCurrentTrip(restored, { now: NOW });
  saved.trip = { ...saved.trip, destination: "Madrid", timeZone: "Europe/Madrid", destinationCurrency: "EUR" };
  assert.deepEqual(tripTemplateReference(saved, template), { timeZone: "America/Sao_Paulo", destinationCurrency: "BRL" }, "use the matching archived trip, never a different current destination");
  saved.postTrip.archivedTrips = [];
  assert.deepEqual(tripTemplateReference(saved, template), { timeZone: undefined, destinationCurrency: undefined });
  const unreviewed = { destination: "Lisboa", startDate: "2027-02-05", endDate: "2027-02-10", budget: 1000, currency: "EUR" };
  assert.throws(() => Reflect.apply(startTripFromTemplate, undefined, [saved, template.id, unreviewed, { approved: true, now: NOW }]), /zona horaria y la moneda/);
  assert.equal(saved.postTrip.archivedTrips.length, 0, "missing review must not archive or change the active trip");
});

test("reviewed non-Brazil templates retain local times across DST and use the chosen destination currency", () => {
  const original = trip();
  original.trip = { ...original.trip, destination: "Madrid", startDate: "2027-01-05", endDate: "2027-01-10", timeZone: "Europe/Madrid", destinationCurrency: "EUR" };
  original.itinerary = [{ ...original.itinerary[0], start: "2027-01-06T09:00:00.000Z", end: "2027-01-06T11:00:00.000Z" }];
  const template = createTripTemplate(original, { name: "Madrid", includeItinerary: true }, NOW);
  const saved = saveTripTemplate(original, template);
  assert.deepEqual(tripTemplateReference(saved, template), { timeZone: "Europe/Madrid", destinationCurrency: "EUR" });
  const reviewed = { destination: "Madrid", startDate: "2027-07-05", endDate: "2027-07-10", budget: 1000, currency: "EUR" as const, timeZone: "Europe/Madrid", destinationCurrency: "EUR" as const };
  const next = startTripFromTemplate(saved, template.id, reviewed, { approved: true, now: NOW });
  assert.equal(next.trip.timeZone, "Europe/Madrid");
  assert.equal(next.trip.destinationCurrency, "EUR");
  assert.equal(next.itinerary[0].start, "2027-07-06T08:00:00.000Z", "10:00 Madrid in summer differs from the original UTC+1 winter offset");
  assert.throws(() => startTripFromTemplate(saved, template.id, { ...reviewed, timeZone: "Bogus/Unknown" }, { approved: true, now: NOW }), /Zona horaria/);
  assert.throws(() => Reflect.apply(startTripFromTemplate, undefined, [saved, template.id, { ...reviewed, destinationCurrency: undefined }, { approved: true, now: NOW }]), /zona horaria y la moneda/);
});

test("anonymous contribution previews use original currency and only explicitly selected records", () => {
  const state = trip();
  const selections = [{ expenseId: "meal", item: "Cena", area: "Centro" }];
  const preview = buildPriceContributionPreview(state, selections);
  assert.equal(preview.canExport, false);
  assert.deepEqual(preview.records, [{ item: "Cena", area: "Centro", amount: 100, currency: "BRL", month: "2027-01" }]);
  assert.throws(() => savePriceContributions(state, selections, { consent: true, now: NOW }), /permiso/);
  state.assistantPreferences.anonymousPriceConsent = true;
  const saved = savePriceContributions(state, selections, { consent: true, now: NOW });
  const again = savePriceContributions(saved, selections, { consent: true, now: NOW });
  assert.equal(again.postTrip.priceContributions.length, 1);
  assert.equal(again.postTrip.priceContributions[0].id, saved.postTrip.priceContributions[0].id);
  const result = exportPriceContributions(saved, [saved.postTrip.priceContributions[0].id]);
  assert.equal(result.published, false);
  assert.doesNotMatch(JSON.stringify(result), /expenseId|createdAt|meal|private@example|private-tag|Lu|26000/);
  saved.assistantPreferences.anonymousPriceConsent = false;
  assert.throws(() => exportPriceContributions(saved), /desactivado/);
  assert.throws(() => buildPriceContributionPreview(state, [{ expenseId: "meal", item: "Cena", area: "private@example.com" }]), /contactos/);
});

test("unselected old contributions never enter a new selective export", () => {
  let state = trip();
  state.assistantPreferences.anonymousPriceConsent = true;
  state.expenses.push(expenseSchema.parse({ ...state.expenses[0], id: "taxi", description: "Taxi", category: "Transporte" }));
  state = savePriceContributions(state, [{ expenseId: "meal", item: "Cena", area: "Centro" }], { consent: true, now: NOW });
  state = savePriceContributions(state, [{ expenseId: "taxi", item: "Traslado", area: "Aeropuerto" }], { consent: true, now: NOW });
  const selectedId = state.postTrip.priceContributions.find((item) => item.expenseId === "taxi")!.id;
  assert.deepEqual(exportPriceContributions(state, [selectedId]).records.map((item) => item.item), ["Traslado"]);
});

test("unbacked flight watches remain bounded interests with no claim of an active provider", () => {
  const state = trip();
  state.postTrip.flightWatches = [{ id: "watch", destination: "Lisboa", maxPrice: 700, currency: "USD", createdAt: NOW }];
  const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.postTrip.flightWatches[0].maxPrice, 700);
  assert.equal("active" in restored.postTrip.flightWatches[0], false);
});

test("cerrar el viaje lo archiva como cerrado y arranca uno nuevo con el mismo grupo", async () => {
  const { closeCurrentTrip, settleTripStatus } = await import("../lib/turi/posttrip");
  const { emptyWorkspace, applyLocalAction } = await import("../lib/turi/domain");
  const base = emptyWorkspace();
  const state = { ...base, trip: { ...base.trip, destination: "Río", status: "in_progress" as const },
    members: [{ id: "ana", name: "Ana", belotag: "", email: "", adultConfirmed: true, consentConfirmed: true }] };
  const closed = closeCurrentTrip(state, { now: "2026-10-28T12:00:00.000Z" });
  assert.equal(closed.trip.destination, "");
  assert.equal(closed.trip.status, "planning");
  assert.deepEqual(closed.members.map((m) => m.name), ["Ana"]);
  assert.equal(closed.postTrip.archivedTrips.length, 1);
  assert.equal(closed.postTrip.archivedTrips[0].snapshot.trip.status, "closed");
  assert.throws(() => closeCurrentTrip(base), /destino/);
  const viaProposal = settleTripStatus(applyLocalAction(state, { type: "trip", label: "Cerrar", data: { status: "closed" } }));
  assert.equal(viaProposal.postTrip.archivedTrips[0].name, "Río");
  assert.equal(settleTripStatus(state), state);
});
