import { z } from "zod";
import { travelOptionSchema } from "./travel-options";
import { conversationWidgetSchema } from "./conversation-widgets";

export const currencies = [
  "ARS",
  "BRL",
  "USD",
  "EUR",
  "UYU",
  "CLP",
  "MXN",
] as const;
export const categories = [
  "Comida",
  "Alojamiento",
  "Transporte",
  "Actividades",
  "Compras",
  "Otros",
] as const;
const amount = z.number().finite().min(0).max(1_000_000_000);
export const timeZoneSchema = z.string().max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat("es", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Zona horaria no válida");
export const tripStatuses = ["planning", "in_progress", "closed"] as const;
export const tripStatusLabel: Record<(typeof tripStatuses)[number], string> = {
  planning: "Planificando",
  in_progress: "En viaje",
  closed: "Cerrado",
};
export const tripSchema = z.object({
  status: z.enum(tripStatuses).default("planning"),
  destination: z.string().max(120).default(""),
  startDate: z.union([z.literal(""), z.iso.date()]).default(""),
  endDate: z.union([z.literal(""), z.iso.date()]).default(""),
  timeZone: timeZoneSchema.default("America/Argentina/Buenos_Aires"),
  travelers: z.number().int().min(1).max(50).default(1),
  currency: z.enum(currencies).default("ARS"),
  destinationCurrency: z.enum(currencies).default("BRL"),
  budget: amount.default(0),
  returnReserve: amount.default(0),
  preferences: z.string().max(1000).default(""),
  categoryBudgets: z.partialRecord(z.enum(categories), amount).default({}),
});
export const memberSchema = z.object({
  id: z.string().max(80),
  name: z.string().min(1).max(60),
  belotag: z.string().max(80).default(""),
  email: z.string().max(200).default(""),
  adultConfirmed: z.boolean(),
  consentConfirmed: z.boolean(),
});
export const expenseSchema = z.object({
  id: z.string().max(80),
  description: z.string().min(1).max(180),
  amount,
  currency: z.enum(currencies),
  homeAmount: amount,
  date: z.iso.date(),
  category: z.enum(categories),
  payer: z.string().max(80).default("me"),
  shares: z
    .array(z.object({ memberId: z.string().max(80), amount }))
    .max(50)
    .default([]),
});
export const itinerarySchema = z.object({
  id: z.string().max(80),
  title: z.string().min(1).max(160),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  location: z.string().max(250).default(""),
  notes: z.string().max(2000).default(""),
  calendarEventId: z.string().max(300).optional(),
  reminderMinutes: z.number().int().min(0).max(10080).default(60),
});
export const reminderSchema = z.object({
  id: z.string().max(80),
  title: z.string().min(1).max(180),
  at: z.iso.datetime({ offset: true }),
  sent: z.boolean().default(false),
});
export const assistantPreferencesSchema = z.object({
  checklist: z.record(z.string(), z.boolean()).default({}),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)).default({}),
  anonymousPriceConsent: z.boolean().default(false),
});
export const reportedRemainderSchema = z.object({
  amount,
  currency: z.enum(currencies),
  status: z.enum(["undecided", "keep"]),
  updatedAt: z.iso.datetime(),
});
export const templateFavoriteSchema = z.object({
  name: z.string().min(1).max(140),
  kind: z.enum(["hotel", "restaurant", "activity", "beach", "place"]),
  location: z.string().max(180),
  summary: z.string().max(360),
  sourceUrl: z.url().max(2000).refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }),
});
export const savedTripTemplateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  createdAt: z.iso.datetime(),
  origin: z.object({
    destination: z.string().max(120),
    startDate: z.union([z.literal(""), z.iso.date()]),
    endDate: z.union([z.literal(""), z.iso.date()]),
    days: z.number().int().min(0).max(36600),
    // Optional for saved templates created before these references were recorded.
    timeZone: timeZoneSchema.optional(),
    destinationCurrency: z.enum(currencies).optional(),
  }),
  currency: z.enum(currencies),
  categoryBudgets: z.partialRecord(z.enum(categories), amount),
  itinerary: z.array(z.object({
    title: z.string().min(1).max(160),
    dayOffset: z.number().int().min(-365).max(365),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.number().int().min(1).max(525600),
    location: z.string().max(250),
    notes: z.string().max(2000),
  })).max(80),
  members: z.array(z.object({ name: z.string().min(1).max(60) })).max(50),
  favorites: z.array(templateFavoriteSchema).max(12),
});
export const priceContributionSchema = z.object({
  id: z.string().min(1).max(80),
  expenseId: z.string().min(1).max(80),
  item: z.string().min(1).max(100),
  area: z.string().min(1).max(120),
  amount: amount.refine((value) => value > 0),
  currency: z.enum(currencies),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  createdAt: z.iso.datetime(),
});
const archivedTripSnapshotSchema = z.object({
  trip: tripSchema,
  expenses: z.array(expenseSchema).max(1000),
  members: z.array(memberSchema.omit({ email: true, belotag: true })).max(50),
  itinerary: z.array(itinerarySchema.omit({ calendarEventId: true })).max(300),
  reminders: z.array(reminderSchema).max(100),
  rateAlerts: z.array(z.object({
    id: z.string().max(80), from: z.enum(currencies), to: z.enum(currencies),
    threshold: z.number().positive().max(1e9), direction: z.enum(["below", "above"]), sent: z.boolean(),
  })).max(20),
  assistantPreferences: assistantPreferencesSchema,
  remainder: reportedRemainderSchema.nullable(),
});
export const archivedTripSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  createdAt: z.iso.datetime(),
  snapshot: archivedTripSnapshotSchema,
});
export const postTripSchema = z.object({
  tripId: z.string().min(1).max(80).default("current"),
  remainder: reportedRemainderSchema.nullable().default(null),
  notice: z.object({
    snoozedUntil: z.iso.datetime().nullable().default(null),
    dismissed: z.boolean().default(false),
    lastNotifiedAt: z.iso.datetime().nullable().default(null),
  }).default({ snoozedUntil: null, dismissed: false, lastNotifiedAt: null }),
  templates: z.array(savedTripTemplateSchema).max(10).default([]),
  archivedTrips: z.array(archivedTripSchema).max(10).default([]),
  priceContributions: z.array(priceContributionSchema).max(50).default([]),
  flightWatches: z.array(z.object({
    id: z.string().min(1).max(80), destination: z.string().min(1).max(120),
    currency: z.enum(currencies), maxPrice: amount.refine((value) => value > 0), createdAt: z.iso.datetime(),
  })).max(10).default([]),
}).superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 250000)
    context.addIssue({ code: "custom", message: "Los datos de cierre ocupan demasiado. Exportá y quitá una plantilla o archivo antes de agregar otro." });
});
export type SavedTripTemplate = z.infer<typeof savedTripTemplateSchema>;
export type ArchivedTrip = z.infer<typeof archivedTripSchema>;
export type PriceContribution = z.infer<typeof priceContributionSchema>;
export type PostTripState = z.infer<typeof postTripSchema>;
export const workspaceSchema = z.object({
  trip: tripSchema,
  expenses: z.array(expenseSchema).max(1000).default([]),
  members: z.array(memberSchema).max(50).default([]),
  itinerary: z.array(itinerarySchema).max(300).default([]),
  reminders: z.array(reminderSchema).max(100).default([]),
  alertsConsent: z.boolean().default(false),
  assistantPreferences: assistantPreferencesSchema.default({ checklist: {}, ratings: {}, anonymousPriceConsent: false }),
  postTrip: postTripSchema.default(() => postTripSchema.parse({})),
  rateAlerts: z
    .array(
      z.object({
        id: z.string().max(80),
        from: z.enum(currencies),
        to: z.enum(currencies),
        threshold: z.number().positive().max(1e9),
        direction: z.enum(["below", "above"]),
        sent: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
});
export type Trip = z.infer<typeof tripSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Member = z.infer<typeof memberSchema>;
export type ItineraryItem = z.infer<typeof itinerarySchema>;
export type Attachment = {
  name: string;
  type: string;
  data: string;
  size: number;
};
export const messageSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(20000),
  attachments: z.array(z.object({ name: z.string().max(160) })).max(3).optional(),
  sources: z.array(z.object({
    title: z.string().max(300),
    url: z.url().max(2000).refine((url) => /^https?:\/\//.test(url)),
  })).max(20).optional(),
  options: z.array(travelOptionSchema).max(12).optional(),
  widgets: z.array(conversationWidgetSchema).max(8).optional(),
});
export type Message = z.infer<typeof messageSchema>;
export type Connection = {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  connected: boolean;
  missing: string[];
};
export type Status = {
  ai: boolean;
  realtime: boolean;
  cloud: boolean;
  connections: Connection[];
};
export type LocalAction = {
  type: "expense" | "itinerary" | "trip" | "reminder";
  data: unknown;
  label: string;
};
export const emptyWorkspace = (): Workspace => ({
  trip: tripSchema.parse({}),
  expenses: [],
  members: [],
  itinerary: [],
  reminders: [],
  alertsConsent: false,
  assistantPreferences: { checklist: {}, ratings: {}, anonymousPriceConsent: false },
  postTrip: postTripSchema.parse({}),
  rateAlerts: [],
});
export const money = (value: number, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
export const today = (timeZone = "America/Argentina/Buenos_Aires") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function budgetSummary(
  state: Workspace,
  date = today(state.trip.timeZone),
) {
  const spent = roundMoney(
    state.expenses.reduce((sum, expense) => sum + expense.homeAmount, 0),
  );
  const spentToday = roundMoney(
    state.expenses
      .filter((e) => e.date === date)
      .reduce((sum, e) => sum + e.homeAmount, 0),
  );
  const days =
    state.trip.startDate && state.trip.endDate
      ? Math.max(
          1,
          Math.round(
            (Date.parse(state.trip.endDate) -
              Date.parse(state.trip.startDate)) /
              86400000,
          ) + 1,
        )
      : 0;
  const availableBudget = Math.max(
    0,
    state.trip.budget - state.trip.returnReserve,
  );
  const daysLeft = state.trip.endDate
    ? Math.max(
        0,
        Math.min(
          days,
          Math.ceil(
            (Date.parse(state.trip.endDate) - Date.parse(date)) / 86400000,
          ),
        ),
      )
    : 0;
  const elapsed = days ? Math.max(1, Math.min(days, days - daysLeft)) : 0;
  return {
    spent,
    spentToday,
    remaining: roundMoney(state.trip.budget - spent),
    available: roundMoney(availableBudget - spent),
    days,
    daysLeft,
    daily: days ? roundMoney(availableBudget / days) : 0,
    perDayLeft: daysLeft ? roundMoney((availableBudget - spent) / daysLeft) : 0,
    projected:
      elapsed && date >= state.trip.startDate
        ? roundMoney((spent / elapsed) * days)
        : spent,
    byCategory: Object.fromEntries(
      categories.map((category) => [
        category,
        roundMoney(
          state.expenses
            .filter((e) => e.category === category)
            .reduce((sum, e) => sum + e.homeAmount, 0),
        ),
      ]),
    ),
  };
}
export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function localTimeToIso(local: string, timeZone: string) {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Completá la fecha y el horario.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const asUtc = (instant: number) => {
    const p = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  let instant = desired;
  for (let i = 0; i < 3; i++) instant += desired - asUtc(instant);
  if (asUtc(instant) !== desired)
    throw new Error(
      "Ese horario no existe en la zona elegida. Revisá el cambio de hora.",
    );
  return new Date(instant).toISOString();
}

export function equalShares(total: number, memberIds: string[]) {
  if (!memberIds.length || new Set(memberIds).size !== memberIds.length)
    throw new Error("Elegí integrantes distintos para dividir el gasto.");
  const cents = Math.round(total * 100),
    share = Math.floor(cents / memberIds.length),
    remainder = cents % memberIds.length;
  return memberIds.map((memberId, index) => ({
    memberId,
    amount: (share + (index < remainder ? 1 : 0)) / 100,
  }));
}

export function validateExpense(expense: Expense, state: Workspace) {
  if (expense.amount <= 0 || expense.homeAmount <= 0)
    throw new Error("El importe debe ser mayor a cero.");
  if (
    expense.currency === state.trip.currency &&
    Math.abs(expense.amount - expense.homeAmount) > 0.001
  )
    throw new Error(
      "En la misma moneda, el importe y el total del presupuesto deben coincidir.",
    );
  const ids = new Set(["me", ...state.members.map((m) => m.id)]);
  if (
    !ids.has(expense.payer) ||
    expense.shares.some((s) => !ids.has(s.memberId))
  )
    throw new Error("El gasto tiene integrantes que no pertenecen al viaje.");
  if (
    new Set(expense.shares.map((s) => s.memberId)).size !==
    expense.shares.length
  )
    throw new Error("Hay integrantes repetidos.");
  if (
    expense.shares.length &&
    Math.abs(
      roundMoney(expense.shares.reduce((sum, s) => sum + s.amount, 0)) -
        expense.homeAmount,
    ) > 0.001
  )
    throw new Error(
      "La suma de las partes debe coincidir con el total en la moneda del presupuesto.",
    );
  return expense;
}

export function settleExpenses(expenses: Expense[]) {
  const cents: Record<string, number> = {};
  for (const e of expenses.filter((e) => e.shares.length)) {
    cents[e.payer] = (cents[e.payer] || 0) + Math.round(e.homeAmount * 100);
    for (const share of e.shares)
      cents[share.memberId] =
        (cents[share.memberId] || 0) - Math.round(share.amount * 100);
  }
  const creditors = Object.entries(cents)
    .filter(([, n]) => n > 0)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
  const debtors = Object.entries(cents)
    .filter(([, n]) => n < 0)
    .map(([id, value]) => ({ id, value: -value }))
    .sort((a, b) => b.value - a.value);
  const transfers: { from: string; to: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const value = Math.min(debtors[i].value, creditors[j].value);
    transfers.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: value / 100,
    });
    debtors[i].value -= value;
    creditors[j].value -= value;
    if (!debtors[i].value) i++;
    if (!creditors[j].value) j++;
  }
  return {
    net: Object.fromEntries(
      Object.entries(cents).map(([id, n]) => [id, n / 100]),
    ),
    transfers,
  };
}

export function applyLocalAction(
  state: Workspace,
  action: LocalAction,
): Workspace {
  if (action.type === "expense") {
    const expense = validateExpense(expenseSchema.parse(action.data), state);
    return state.expenses.some((e) => e.id === expense.id)
      ? state
      : { ...state, expenses: [...state.expenses, expense] };
  }
  if (action.type === "itinerary") {
    const item = itinerarySchema.parse(action.data);
    if (
      !Number.isFinite(Date.parse(item.start)) ||
      Date.parse(item.end) <= Date.parse(item.start)
    )
      throw new Error("Revisá el inicio y el fin de la actividad.");
    return state.itinerary.some((e) => e.id === item.id)
      ? state
      : {
          ...state,
          itinerary: [...state.itinerary, item].sort((a, b) =>
            a.start.localeCompare(b.start),
          ),
        };
  }
  if (action.type === "reminder") {
    const item = reminderSchema.parse(action.data);
    if (!Number.isFinite(Date.parse(item.at)))
      throw new Error("La fecha del recordatorio no es válida.");
    return state.reminders.some((e) => e.id === item.id)
      ? state
      : { ...state, reminders: [...state.reminders, item] };
  }
  const trip = tripSchema.parse({ ...state.trip, ...(action.data as object) });
  if (
    trip.returnReserve > trip.budget ||
    (trip.startDate && trip.endDate && trip.endDate < trip.startDate)
  )
    throw new Error("Revisá las fechas y el monto reservado para la vuelta.");
  if (
    Object.values(trip.categoryBudgets).reduce((sum, n) => sum + (n || 0), 0) >
    trip.budget - trip.returnReserve
  )
    throw new Error(
      "Los topes por categoría superan el presupuesto disponible después de separar la vuelta.",
    );
  return { ...state, trip };
}
