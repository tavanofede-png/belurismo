import {
  categories,
  roundMoney,
  settleExpenses,
  today,
  type Expense,
  type Workspace,
} from "./domain";
import { postTripNoticeState } from "./posttrip";

export const conversationPanelKinds = [
  "summary", "daily", "group", "recap", "checklist", "post-trip-notice",
  "leftover", "price-review", "feedback", "next-trip",
] as const;
export type ConversationPanelKind = (typeof conversationPanelKinds)[number];

export const preTripChecks = [
  { id: "documents", label: "Documento vigente", description: "DNI o pasaporte. Verificá los requisitos oficiales de entrada para tu nacionalidad." },
  { id: "assistance", label: "Seguro o asistencia al viajero", description: "Revisá cobertura, exclusiones y teléfonos de asistencia." },
  { id: "connectivity", label: "Conectividad: eSIM o roaming", description: "Confirmá cómo vas a usar mapas, mensajería y Turi en destino." },
  { id: "payments", label: "Dinero y medios de pago", description: "Definí cuánto cambiar, cómo pagar y una alternativa de respaldo." },
  { id: "bookings", label: "Reservas confirmadas y guardadas", description: "Vuelo, alojamiento y traslados, con sus condiciones." },
  { id: "checkin", label: "Check-in del vuelo", description: "Revisá cuándo se habilita y qué te pide la aerolínea." },
  { id: "luggage", label: "Equipaje y cuidado personal", description: "Límites de equipaje, protector solar y repelente según el destino." },
  { id: "copies", label: "Copias digitales de documentos", description: "Guardá una copia segura por si perdés los originales." },
] as const;

export type CategoryPanelRow = {
  category: string;
  amount: number;
  share: number;
  budget: number | null;
  remaining: number | null;
};
export type DailyPanelRow = {
  date: string;
  day: number;
  amount: number;
  expenseCount: number;
  excess: number;
};
export type GroupTransfer = {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  amount: number;
};
export type ConversationPanels = {
  summary: {
    destination: string;
    currency: string;
    startDate: string;
    endDate: string;
    days: number;
    expenseCount: number;
    total: number;
    personalTotal: number;
    paidByMe: number;
    budget: number;
    returnReserve: number;
    availableBudget: number;
    remaining: number;
    availableRemaining: number;
    delta: number;
    ratio: number | null;
    dailyLimit: number | null;
    averageDaily: number | null;
    categories: CategoryPanelRow[];
    topCategory: CategoryPanelRow | null;
  };
  daily: {
    currency: string;
    dailyLimit: number | null;
    days: DailyPanelRow[];
    overDays: number[];
    totalExcess: number;
    largestDay: DailyPanelRow | null;
    recommendedDaily: number | null;
    recommendationNote: string;
    outsideTripAmount: number;
    outsideTripCount: number;
    truncated: boolean;
  };
  group: {
    currency: string;
    sharedTotal: number;
    sharedExpenses: {
      id: string;
      description: string;
      date: string;
      amount: number;
      payer: string;
      payerName: string;
      participants: { id: string; name: string; amount: number }[];
    }[];
    net: { memberId: string; name: string; amount: number }[];
    transfers: GroupTransfer[];
    mine: GroupTransfer[];
    totalToPay: number;
    totalToCollect: number;
    requiresPaymentEvidence: true;
  };
  recap: {
    destination: string;
    currency: string;
    startDate: string;
    endDate: string;
    days: number;
    sharedTotal: number;
    sharedExpenseCount: number;
    participantCount: number;
    topCategory: string | null;
    largestDay: { date: string; day: number; amount: number } | null;
    pendingTransfers: number;
    includesPersonalExpenses: false;
  };
  checklist: {
    items: { id: string; label: string; checked: false; available: boolean; description: string }[];
  };
  postTripNotice: { title: string; body: string; daysAfter: number; pendingDebts: number } | null;
  priceReview: {
    candidates: { id: string; description: string; date: string; amount: number; currency: string; homeAmount: number; category: string }[];
    requiresSource: true;
    hasVerifiedOvercharges: false;
  };
  leftover: { currency: string; balance: null; requiresBeloConnection: true };
  nextTrip: { currency: string; historicalDaily: number | null; suggestedDaily: number | null; suggestedTotal: number | null; days: number };
};

const DAY_MS = 86400000;
const MAX_DAILY_ROWS = 366;
const cents = (amount: number) => Math.round(amount * 100);
const sum = (expenses: Expense[]) => expenses.reduce((total, expense) => total + cents(expense.homeAmount), 0) / 100;

function ordinal(date: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) return;
  return timestamp / DAY_MS;
}

function tripRange(state: Workspace) {
  const start = ordinal(state.trip.startDate);
  const end = ordinal(state.trip.endDate);
  const valid = start !== undefined && end !== undefined && end >= start;
  return { start, end, days: valid ? end! - start! + 1 : 0 };
}

function categoryRows(expenses: Expense[], state: Workspace): CategoryPanelRow[] {
  const total = sum(expenses);
  return categories.map((category) => {
    const amount = sum(expenses.filter((expense) => expense.category === category));
    const budget = state.trip.categoryBudgets[category] ?? null;
    return { category, amount, share: total > 0 ? amount / total : 0, budget, remaining: budget === null ? null : roundMoney(budget - amount) };
  }).sort((a, b) => b.amount - a.amount);
}

/**
 * Adapted from tripSummary() in the supplied turi-posttrip.html.
 * Uses registered homeAmount (never demo rates), inclusive calendar dates and
 * keeps the return reserve separate from spending or any bank/wallet balance.
 */
function tripSummary(state: Workspace): ConversationPanels["summary"] {
  const days = tripRange(state).days;
  const total = sum(state.expenses);
  const budget = roundMoney(state.trip.budget);
  const returnReserve = roundMoney(state.trip.returnReserve);
  const availableBudget = Math.max(0, roundMoney(budget - returnReserve));
  const rows = categoryRows(state.expenses, state);
  const personalCents = state.expenses.reduce((value, expense) => value + (
    expense.shares.length
      ? expense.shares.filter((share) => share.memberId === "me").reduce((part, share) => part + cents(share.amount), 0)
      : expense.payer === "me" ? cents(expense.homeAmount) : 0
  ), 0);
  return {
    destination: state.trip.destination,
    currency: state.trip.currency,
    startDate: state.trip.startDate,
    endDate: state.trip.endDate,
    days,
    expenseCount: state.expenses.length,
    total,
    personalTotal: personalCents / 100,
    paidByMe: sum(state.expenses.filter((expense) => expense.payer === "me")),
    budget,
    returnReserve,
    availableBudget,
    remaining: roundMoney(budget - total),
    availableRemaining: roundMoney(availableBudget - total),
    delta: roundMoney(total - budget),
    ratio: budget > 0 ? total / budget : null,
    dailyLimit: days && budget > 0 ? roundMoney(availableBudget / days) : null,
    averageDaily: days ? roundMoney(total / days) : null,
    categories: rows,
    topCategory: rows.find((row) => row.amount > 0) ?? null,
  };
}

/** Original recommendedDaily heuristic: observed average +5%, rounded upward.
 * The HTML rounded ARS to the next 1,000; other currencies use one unit.
 * This is a planning margin over this trip's data, never a future price quote.
 */
export function recommendedDaily(average: number, currency: string): number {
  if (!Number.isFinite(average) || average <= 0) return 0;
  const step = currency === "ARS" ? 1000 : 1;
  return roundMoney(Math.ceil(roundMoney(average * 1.05) / step) * step);
}

function dailySummary(state: Workspace, summary: ConversationPanels["summary"]): ConversationPanels["daily"] {
  const range = tripRange(state);
  const amounts = new Map<string, { amount: number; expenseCount: number }>();
  for (const expense of state.expenses) {
    const previous = amounts.get(expense.date) ?? { amount: 0, expenseCount: 0 };
    amounts.set(expense.date, { amount: previous.amount + cents(expense.homeAmount), expenseCount: previous.expenseCount + 1 });
  }
  const dates = range.days
    ? Array.from({ length: Math.min(range.days, MAX_DAILY_ROWS) }, (_, index) => new Date((range.start! + index) * DAY_MS).toISOString().slice(0, 10))
    : [...amounts.keys()].sort().slice(0, MAX_DAILY_ROWS);
  const rows = dates.map((date, index) => {
    const entry = amounts.get(date);
    const amount = (entry?.amount ?? 0) / 100;
    return { date, day: index + 1, amount, expenseCount: entry?.expenseCount ?? 0,
      excess: summary.dailyLimit === null ? 0 : Math.max(0, roundMoney(amount - summary.dailyLimit)) };
  });
  const outside = range.days ? state.expenses.filter((expense) => expense.date < state.trip.startDate || expense.date > state.trip.endDate) : [];
  return {
    currency: state.trip.currency,
    dailyLimit: summary.dailyLimit,
    days: rows,
    overDays: rows.filter((row) => row.excess > 0).map((row) => row.day),
    totalExcess: roundMoney(rows.reduce((total, row) => total + row.excess, 0)),
    largestDay: rows.filter((row) => row.expenseCount > 0).sort((a, b) => b.amount - a.amount)[0] ?? null,
    recommendedDaily: summary.averageDaily !== null && state.expenses.length ? recommendedDaily(summary.averageDaily, state.trip.currency) : null,
    recommendationNote: "Margen orientativo: tu promedio registrado + 5%, redondeado hacia arriba. No incluye aumentos de precios ni una cotización futura.",
    outsideTripAmount: sum(outside),
    outsideTripCount: outside.length,
    truncated: (range.days || amounts.size) > MAX_DAILY_ROWS,
  };
}

/** Adaptation of settle() from the reference using the existing cent-exact
 * settleExpenses(): these are suggested transfers, not verified payments.
 */
function groupSummary(state: Workspace): ConversationPanels["group"] {
  const name = (id: string) => id === "me" ? "Vos" : state.members.find((member) => member.id === id)?.name || "Integrante";
  const expenses = state.expenses.filter((expense) => expense.shares.length > 0);
  const settlement = settleExpenses(expenses);
  const transfers = settlement.transfers.map((transfer) => ({ ...transfer, fromName: name(transfer.from), toName: name(transfer.to) }));
  const mine = transfers.filter((transfer) => transfer.from === "me" || transfer.to === "me");
  return {
    currency: state.trip.currency,
    sharedTotal: sum(expenses),
    sharedExpenses: expenses.map((expense) => ({
      id: expense.id, description: expense.description, date: expense.date,
      amount: expense.homeAmount, payer: expense.payer, payerName: name(expense.payer),
      participants: expense.shares.map((share) => ({ id: share.memberId, name: name(share.memberId), amount: share.amount })),
    })),
    net: Object.entries(settlement.net).map(([memberId, amount]) => ({ memberId, name: name(memberId), amount })),
    transfers,
    mine,
    totalToPay: roundMoney(mine.filter((transfer) => transfer.from === "me").reduce((total, transfer) => total + transfer.amount, 0)),
    totalToCollect: roundMoney(mine.filter((transfer) => transfer.to === "me").reduce((total, transfer) => total + transfer.amount, 0)),
    requiresPaymentEvidence: true,
  };
}

function groupRecap(state: Workspace, days: number): ConversationPanels["recap"] {
  // Only genuinely shared expenses enter the share preview. Personal spending,
  // wallet balances, member contacts and private daily peaks never leave it.
  const expenses = state.expenses.filter((expense) => expense.shares.length > 1);
  const byDate = new Map<string, number>();
  for (const expense of expenses) byDate.set(expense.date, (byDate.get(expense.date) ?? 0) + cents(expense.homeAmount));
  const largest = [...byDate].sort((a, b) => b[1] - a[1])[0];
  const start = ordinal(state.trip.startDate);
  const topCategory = categoryRows(expenses, state).find((row) => row.amount > 0)?.category ?? null;
  return {
    destination: state.trip.destination,
    currency: state.trip.currency,
    startDate: state.trip.startDate,
    endDate: state.trip.endDate,
    days,
    sharedTotal: sum(expenses),
    sharedExpenseCount: expenses.length,
    participantCount: new Set(expenses.flatMap((expense) => expense.shares.map((share) => share.memberId))).size,
    topCategory,
    largestDay: largest ? { date: largest[0], day: start === undefined ? 0 : ordinal(largest[0])! - start + 1, amount: largest[1] / 100 } : null,
    pendingTransfers: settleExpenses(expenses).transfers.length,
    includesPersonalExpenses: false,
  };
}

/** Adapted from shouldNotifyPostTrip(): opt-in, next calendar day through day14,
 * with real calculated debts or an explicitly reported remainder. The persistent
 * notice state also applies dismissal, prior delivery and an explicit snooze.
 */
export function shouldNotifyPostTrip(
  state: Workspace,
  date: string,
  pendingDebts = settleExpenses(state.expenses).transfers.length,
): ConversationPanels["postTripNotice"] {
  // Keep the old argument for callers; the notice always recalculates actual
  // recorded debts rather than trusting a supplied count or a wallet guess.
  void pendingDebts;
  const notice = postTripNoticeState(state, { date });
  if (!notice.eligible || notice.daysAfter === null || !notice.message) return null;
  return {
    title: "Tu viaje terminó",
    body: notice.message,
    daysAfter: notice.daysAfter,
    pendingDebts: notice.pendingDebts,
  };
}

export function buildConversationPanels(state: Workspace, options: { date?: string } = {}): ConversationPanels {
  const summary = tripSummary(state);
  const daily = dailySummary(state, summary);
  const group = groupSummary(state);
  const permittedMembers = state.members.length > 0 && state.members.every((member) => member.adultConfirmed && member.consentConfirmed);
  return {
    summary,
    daily,
    group,
    recap: groupRecap(state, summary.days),
    // The four conserve/reuse controls come from the HTML's template checklist.
    // All start unchecked: the UI must persist the user's own choices.
    checklist: { items: [
      { id: "itinerary", label: "Itinerario por días", checked: false, available: state.itinerary.length > 0, description: `${state.itinerary.length} actividades guardadas en tu viaje.` },
      { id: "favorites", label: "Lugares favoritos", checked: false, available: false, description: "Elegí qué lugares querés conservar; todavía no hay favoritos guardados." },
      { id: "category-budgets", label: "Presupuesto por categoría", checked: false, available: Object.values(state.trip.categoryBudgets).some((value) => value !== undefined && value > 0), description: "Conservar los topes que ya definiste, sin convertirlos en precios futuros." },
      { id: "members", label: "Integrantes del grupo (solo con su permiso)", checked: false, available: permittedMembers, description: permittedMembers ? `${state.members.length} integrantes con permiso confirmado.` : "Necesitás el permiso explícito de cada integrante adulto." },
    ] },
    postTripNotice: shouldNotifyPostTrip(state, options.date ?? today(state.trip.timeZone), group.transfers.length),
    priceReview: {
      candidates: [...state.expenses].sort((a, b) => b.homeAmount - a.homeAmount).slice(0, 8).map((expense) => ({
        id: expense.id, description: expense.description, date: expense.date, amount: expense.amount,
        currency: expense.currency, homeAmount: expense.homeAmount, category: expense.category,
      })),
      requiresSource: true,
      hasVerifiedOvercharges: false,
    },
    leftover: { currency: state.trip.destinationCurrency, balance: null, requiresBeloConnection: true },
    nextTrip: {
      currency: state.trip.currency,
      historicalDaily: state.expenses.length ? summary.averageDaily : null,
      suggestedDaily: daily.recommendedDaily,
      suggestedTotal: daily.recommendedDaily === null || !summary.days ? null : roundMoney(daily.recommendedDaily * summary.days),
      days: summary.days,
    },
  };
}

/** Adaptation of the reference route(): deterministic intent only, no DOM or
 * scripted demo answers. The panel values always come from buildConversationPanels.
 */
export function detectConversationPanel(text: string): ConversationPanelKind | undefined {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  // Today's spending during the trip is answered by the agent with trip_summary,
  // not by the post-trip panels. "Saldo" alone is the belo balance, not money left from the trip.
  // Where to eat within budget is a search for real places, answered with option cards.
  if (/\b(?:comer|como|cenar|almorzar|restaurantes?|comida|bares?)\b/.test(value) && /\b(?:donde|recomend|entren?|opciones|lugares?)/.test(value)) return;
  if (/\bhoy\b|\bdel dia\b|\bdiari[oa]\b/.test(value) && /saldo|gast|presupuesto|queda|vengo|viene|voy/.test(value)) return;
  if (/resumen para compartir|compartir (?:el |un |mi )?resumen|recap/.test(value)) return "recap";
  if (/cuentas pendientes|cuentas con (?:el |mi )?grupo|quien (?:le )?debe|me deben|\bdebo\b|dividir|belo air|repartir (?:los )?gastos|como quedaron las cuentas/.test(value)) return "group";
  if (/plantilla|reutiliz|que (?:quiero |puedo )?conservar|guardar (?:este |el |mi )?viaje|guarda (?:este |el |mi )?viaje|checklist|lista de pendientes/.test(value)) return "checklist";
  if (/cobraron de mas|cobro(?:s)? (?:indebido|abusivo)|pague de mas|sobreprecio|me estaf|cobros para revisar/.test(value)) return "price-review";
  if (/dia por dia|en que dias|gastos por dia|gaste por dia|que aprend|\binsights?\b|me pase/.test(value)) return "daily";
  if (/notificacion(?:es)? (?:del |al |de |fin |final)|aviso (?:al |de |del )|recordatorio (?:del |de |al )/.test(value)) return "post-trip-notice";
  if (/reales que (?:me )?sobr|remanente|reconvert|saldo (?:que (?:me )?(?:sobr|qued)|del viaje|restante)|(?:dolares|euros|pesos) que (?:me )?sobr/.test(value)) return "leftover";
  if (/mi opinion|dejar (?:una |mi )?(?:opinion|resena)|calificar|valorar (?:el |mi )?viaje|aporte anonimo/.test(value)) return "feedback";
  if (/proximo viaje|otro viaje|adonde (?:puedo ir |ir )?(?:la )?proxima|a donde (?:puedo ir |ir )?(?:la )?proxima/.test(value)) return "next-trip";
  if (/resumen|cuanto gaste|gastos|gastado|presupuesto/.test(value)) return "summary";
  return;
}
