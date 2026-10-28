import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, expenseSchema, equalShares, type Expense } from "../lib/turi/domain";
import {
  buildConversationPanels,
  detectConversationPanel,
  recommendedDaily,
  shouldNotifyPostTrip,
} from "../lib/turi/conversation-panels";

function expense(id: string, amount: number, date = "2027-01-05", extra: Partial<Expense> = {}): Expense {
  return expenseSchema.parse({ id, amount, homeAmount: amount, date, description: id, category: "Comida", currency: "ARS", ...extra });
}

function trip() {
  const state = emptyWorkspace();
  state.trip = { ...state.trip, destination: "Florianópolis", startDate: "2027-01-05", endDate: "2027-01-10", budget: 300000, returnReserve: 30000 };
  return state;
}

test("post-trip summary uses stored home amounts, cent-exact categories and an unspent return reserve", () => {
  const state = trip();
  state.trip.categoryBudgets = { Comida: 10000, Transporte: 20000 };
  state.expenses = [
    expense("almuerzo", 1000.1), expense("cena", 2000.2),
    expense("traslado", 100, "2027-01-06", { currency: "BRL", homeAmount: 10000.3, category: "Transporte" }),
  ];
  const { summary, daily, leftover } = buildConversationPanels(state, { date: "2027-01-11" });
  assert.equal(summary.total, 13000.6);
  assert.equal(summary.days, 6);
  assert.equal(summary.availableBudget, 270000);
  assert.equal(summary.dailyLimit, 45000);
  assert.equal(summary.remaining, 286999.4);
  assert.equal(summary.availableRemaining, 256999.4);
  assert.equal(summary.categories.find((row) => row.category === "Comida")?.amount, 3000.3);
  assert.equal(summary.categories.find((row) => row.category === "Comida")?.remaining, 6999.7);
  assert.equal(summary.topCategory?.category, "Transporte");
  assert.equal(daily.days.reduce((value, row) => value + Math.round(row.amount * 100), 0), 1300060);
  assert.equal(leftover.balance, null, "remaining budget is never presented as a real wallet balance");
});

test("daily panels include zero-spend calendar days across DST and separate out-of-trip bookings", () => {
  const state = trip();
  state.trip = { ...state.trip, startDate: "2026-03-28", endDate: "2026-03-30", timeZone: "Europe/Madrid", budget: 300, returnReserve: 0, currency: "EUR" };
  state.expenses = [
    expense("hotel prepago", 60, "2026-03-01", { currency: "EUR", category: "Alojamiento" }),
    expense("comida", 80, "2026-03-28", { currency: "EUR" }),
    expense("actividad", 140, "2026-03-30", { currency: "EUR", category: "Actividades" }),
  ];
  const { summary, daily } = buildConversationPanels(state, { date: "2026-03-31" });
  assert.equal(summary.days, 3);
  assert.deepEqual(daily.days.map((row) => [row.date, row.day, row.amount]), [
    ["2026-03-28", 1, 80], ["2026-03-29", 2, 0], ["2026-03-30", 3, 140],
  ]);
  assert.equal(daily.dailyLimit, 100);
  assert.deepEqual(daily.overDays, [3]);
  assert.equal(daily.totalExcess, 40);
  assert.equal(daily.largestDay?.date, "2026-03-30");
  assert.equal(daily.outsideTripAmount, 60);
  assert.equal(daily.outsideTripCount, 1);
  assert.equal(summary.total, 280, "prepaid reservations still count toward the full trip budget");
});

test("group settlement preserves every cent and distinguishes the user's share from money paid", () => {
  const state = trip();
  state.members = ["lu", "marcos"].map((id) => ({ id, name: id === "lu" ? "Lu" : "Marcos", belotag: "", email: "", adultConfirmed: true, consentConfirmed: true }));
  state.expenses = [
    expense("cena grupal", 120, "2027-01-05", { payer: "lu", shares: equalShares(120, ["me", "lu", "marcos"]) }),
    expense("taxi", 60, "2027-01-06", { payer: "me", category: "Transporte", shares: equalShares(60, ["me", "lu"]) }),
    expense("cafe personal", 10, "2027-01-07"),
  ];
  const { summary, group } = buildConversationPanels(state);
  assert.equal(summary.total, 190);
  assert.equal(summary.personalTotal, 80);
  assert.equal(summary.paidByMe, 70);
  assert.equal(group.sharedTotal, 180);
  assert.equal(group.totalToPay, 10);
  assert.equal(group.totalToCollect, 0);
  assert.deepEqual(group.mine, [{ from: "me", to: "lu", fromName: "Vos", toName: "Lu", amount: 10 }]);
  const balances = Object.fromEntries(group.net.map((row) => [row.memberId, Math.round(row.amount * 100)]));
  for (const transfer of group.transfers) {
    balances[transfer.from] += Math.round(transfer.amount * 100);
    balances[transfer.to] -= Math.round(transfer.amount * 100);
  }
  assert.ok(Object.values(balances).every((value) => value === 0));
  assert.equal(group.requiresPaymentEvidence, true);
});

test("the share preview excludes private amounts, descriptions, contacts and personal expense peaks", () => {
  const state = trip();
  state.members = [{ id: "lu", name: "Lu", email: "private@example.com", belotag: "private-tag", adultConfirmed: true, consentConfirmed: true }];
  state.expenses = [
    expense("cena de todos", 100, "2027-01-05", { shares: equalShares(100, ["me", "lu"]) }),
    expense("compra privada confidencial", 99999, "2027-01-06", { category: "Compras" }),
    expense("asignacion privada", 5, "2027-01-07", { shares: equalShares(5, ["me"]) }),
  ];
  const { recap } = buildConversationPanels(state);
  assert.equal(recap.sharedTotal, 100);
  assert.equal(recap.sharedExpenseCount, 1);
  assert.equal(recap.participantCount, 2);
  assert.equal(recap.topCategory, "Comida");
  assert.equal(recap.largestDay?.date, "2027-01-05");
  assert.equal(recap.largestDay?.amount, 100);
  assert.equal(recap.includesPersonalExpenses, false);
  assert.doesNotMatch(JSON.stringify(recap), /99999|confidencial|private@example|private-tag|asignacion/);
});

test("post-trip notifications require consent, an actual debt and the next-day through day14 window", () => {
  const state = trip();
  state.expenses = [expense("cena", 100, "2027-01-05", { shares: equalShares(100, ["me", "lu"]) })];
  assert.equal(shouldNotifyPostTrip(state, "2027-01-11"), null);
  state.alertsConsent = true;
  assert.equal(shouldNotifyPostTrip(state, "2027-01-10"), null);
  assert.equal(shouldNotifyPostTrip(state, "2027-01-11")?.daysAfter, 1);
  assert.equal(shouldNotifyPostTrip(state, "2027-01-24")?.daysAfter, 14);
  assert.equal(shouldNotifyPostTrip(state, "2027-01-25"), null);
  state.expenses = [];
  assert.equal(shouldNotifyPostTrip(state, "2027-01-11"), null);
});

test("empty or incomplete trips do not manufacture prices, averages, debts or finite budget ratios", () => {
  const state = emptyWorkspace();
  const panels = buildConversationPanels(state, { date: "2026-10-28" });
  assert.equal(panels.summary.days, 0);
  assert.equal(panels.summary.total, 0);
  assert.equal(panels.summary.ratio, null);
  assert.equal(panels.summary.averageDaily, null);
  assert.equal(panels.summary.dailyLimit, null);
  assert.equal(panels.summary.topCategory, null);
  assert.deepEqual(panels.group.transfers, []);
  assert.deepEqual(panels.daily.days, []);
  assert.equal(panels.daily.recommendedDaily, null);
  assert.equal(panels.recap.largestDay, null);
  assert.equal(panels.nextTrip.suggestedTotal, null);
  assert.equal(panels.priceReview.requiresSource, true);
  assert.equal(panels.priceReview.hasVerifiedOvercharges, false);
  assert.deepEqual(panels.priceReview.candidates, []);
  assert.doesNotMatch(JSON.stringify(panels), /NaN|Infinity/);
});

test("template controls start unchecked and member reuse depends on every person's permission", () => {
  const state = trip();
  state.members = [{ id: "lu", name: "Lu", email: "", belotag: "", adultConfirmed: true, consentConfirmed: false }];
  const before = JSON.stringify(state);
  const { checklist } = buildConversationPanels(state);
  assert.ok(checklist.items.every((item) => item.checked === false));
  assert.equal(checklist.items.find((item) => item.id === "members")?.available, false);
  assert.equal(checklist.items.find((item) => item.id === "favorites")?.available, false);
  assert.equal(JSON.stringify(state), before, "building panels is read-only");
  state.members[0].consentConfirmed = true;
  assert.equal(buildConversationPanels(state).checklist.items.find((item) => item.id === "members")?.available, true);
});

test("historical planning margin adapts the reference heuristic to the budget currency", () => {
  assert.equal(recommendedDaily(10000, "ARS"), 11000);
  assert.equal(recommendedDaily(10, "USD"), 11);
  assert.equal(recommendedDaily(0, "ARS"), 0);
  assert.equal(recommendedDaily(NaN, "USD"), 0);
  const state = trip();
  state.trip.currency = "USD";
  state.trip.budget = 120;
  state.trip.returnReserve = 0;
  state.expenses = [expense("gastos", 60, "2027-01-05", { currency: "USD" })];
  const { nextTrip } = buildConversationPanels(state);
  assert.deepEqual(nextTrip, { currency: "USD", historicalDaily: 10, suggestedDaily: 11, suggestedTotal: 66, days: 6 });
});

test("unreasonably long date ranges cannot allocate an unbounded daily chart", () => {
  const state = trip();
  state.trip.startDate = "2020-01-01";
  state.trip.endDate = "2040-01-01";
  const { daily } = buildConversationPanels(state);
  assert.equal(daily.days.length, 366);
  assert.equal(daily.truncated, true);
});

test("panel intents follow the reference scenarios with accent-insensitive, precise priorities", () => {
  const cases = [
    ["Mostrame el resumen de gastos del viaje", "summary"],
    ["¿En qué días me pasé y qué aprendí?", "daily"],
    ["¿Cómo quedaron las cuentas con el grupo?", "group"],
    ["Armame un resumen para compartir", "recap"],
    ["Guardá este viaje para el próximo", "checklist"],
    ["¿Qué hago con los reales que me sobraron?", "leftover"],
    ["¿Me cobraron de más?", "price-review"],
    ["Quiero dejar mi opinión del viaje", "feedback"],
    ["¿Adónde puedo ir la próxima?", "next-trip"],
    ["Notificación del fin del viaje", "post-trip-notice"],
  ] as const;
  for (const [text, panel] of cases) assert.equal(detectConversationPanel(text), panel, text);
  assert.equal(detectConversationPanel("Hola, Turi"), undefined);
  for (const text of ["¿Dónde como según mi presupuesto?", "restaurantes que entren en mi presupuesto", "como viene mi saldo de hoy?", "¿Cuánto gasté hoy?", "¿Cómo vengo con el presupuesto diario?", "¿Cuánto me queda para hoy?"])
    assert.equal(detectConversationPanel(text), undefined, text);
  assert.equal(detectConversationPanel("Buscá hoteles frente al mar"), undefined);
});

test("saldo alone is the belo balance, not the leftover panel", () => {
  for (const text of ["¿Cuál es mi saldo?", "quiero ver mi saldo en belo"]) assert.equal(detectConversationPanel(text), undefined, text);
  assert.equal(detectConversationPanel("¿Qué hago con el saldo que me sobró?"), "leftover");
});
