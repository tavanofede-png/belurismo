"use client";

import {
  PlusIcon,
  TrashIcon,
  ArrowRightIcon,
  MapPinIcon,
  CheckIcon,
  ArrowDownRightIcon,
  BellIcon,
} from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  budgetSummary,
  money,
  categories,
  currencies,
  applyLocalAction,
  equalShares,
  settleExpenses,
  today,
  localTimeToIso,
  workspaceSchema,
  tripStatuses,
  tripStatusLabel,
  type Workspace,
  type Expense,
} from "@/lib/turi/domain";
import { closeCurrentTrip } from "@/lib/turi/posttrip";
import { api, type TuriController } from "./useTuri";

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`turi-field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="turi-empty-state">{children}</p>;
}
const formValues = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const text = (form: FormData, key: string) => String(form.get(key) || "");
const number = (form: FormData, key: string) => Number(form.get(key) || 0);

export default function TripView({
  tab,
  turi,
}: {
  tab: "trip" | "budget" | "group";
  turi: TuriController;
}) {
  const state = turi.state,
    summary = budgetSummary(state),
    [editing, setEditing] = useState(!state.trip.destination),
    [notice, setNotice] = useState(""),
    [confirmClose, setConfirmClose] = useState(false);
  const [expenseCurrency, setExpenseCurrency] = useState(
      state.trip.destinationCurrency,
    ),
    [shared, setShared] = useState(false),
    [split, setSplit] = useState("equal");
  const [quote, setQuote] = useState<{
      from: string;
      to: string;
      rate: number;
      updatedAt: string;
    } | null>(null),
    [quoteBusy, setQuoteBusy] = useState(false);
  const members = [{ id: "me", name: "Vos" }, ...state.members],
    settlement = settleExpenses(state.expenses);
  const update = (next: Workspace) => {
    turi.setState(next);
    setNotice("Guardado en tu viaje.");
  };
  const setStatus = (status: (typeof tripStatuses)[number]) => {
    try {
      if (status === "closed") {
        turi.setState(closeCurrentTrip(state));
        setConfirmClose(false);
        setEditing(true);
        setNotice("Viaje cerrado. Quedó en tus viajes cerrados y arrancamos uno nuevo.");
      } else update(applyLocalAction(state, { type: "trip", label: "Estado del viaje", data: { status } }));
    } catch (e) {
      turi.setError((e as Error).message);
    }
  };
  const closedTrips = [...state.postTrip.archivedTrips].reverse();
  const saveTrip = (event: FormEvent<HTMLFormElement>) => {
    const form = formValues(event);
    try {
      if (
        state.expenses.length &&
        text(form, "currency") !== state.trip.currency
      )
        throw new Error(
          "Para cambiar la moneda base, primero exportá y quitá los gastos existentes; así evitamos mezclar importes.",
        );
      const data = {
        destination: text(form, "destination"),
        startDate: text(form, "startDate"),
        endDate: text(form, "endDate"),
        timeZone: text(form, "timeZone"),
        travelers: number(form, "travelers"),
        budget: number(form, "budget"),
        returnReserve: number(form, "returnReserve"),
        currency: text(form, "currency"),
        destinationCurrency: text(form, "destinationCurrency"),
        preferences: text(form, "preferences"),
        categoryBudgets: Object.fromEntries(
          categories.map((category) => [
            category,
            number(form, `category-${category}`),
          ]),
        ),
      };
      new Intl.DateTimeFormat("es", { timeZone: data.timeZone });
      update(
        applyLocalAction(state, { type: "trip", label: "Mi viaje", data }),
      );
      setEditing(false);
    } catch (e) {
      turi.setError((e as Error).message);
    }
  };
  const addExpense = (event: FormEvent<HTMLFormElement>) => {
    const formNode = event.currentTarget,
      form = formValues(event);
    try {
      const homeAmount =
          expenseCurrency === state.trip.currency
            ? number(form, "amount")
            : number(form, "homeAmount"),
        ids = form.getAll("among").map(String);
      if (shared && !ids.length)
        throw new Error("Elegí al menos un participante del gasto.");
      const shares = shared
        ? split === "equal"
          ? equalShares(homeAmount, ids)
          : ids.map((memberId) => ({
              memberId,
              amount: number(form, `share-${memberId}`),
            }))
        : [];
      const expense = {
        id: crypto.randomUUID(),
        description: text(form, "description"),
        amount: number(form, "amount"),
        currency: expenseCurrency,
        homeAmount,
        date: text(form, "date"),
        category: text(form, "category"),
        payer: text(form, "payer"),
        shares,
      };
      update(
        applyLocalAction(state, {
          type: "expense",
          label: "Gasto registrado",
          data: expense,
        }),
      );
      formNode.reset();
      setShared(false);
    } catch (e) {
      turi.setError((e as Error).message);
    }
  };
  const addActivity = (event: FormEvent<HTMLFormElement>) => {
    const node = event.currentTarget,
      form = formValues(event);
    try {
      const start = localTimeToIso(text(form, "start"), state.trip.timeZone),
        end = localTimeToIso(text(form, "end"), state.trip.timeZone);
      update(
        applyLocalAction(state, {
          type: "itinerary",
          label: "Nueva actividad",
          data: {
            id: crypto.randomUUID(),
            title: text(form, "title"),
            start,
            end,
            location: text(form, "location"),
            notes: text(form, "notes"),
            reminderMinutes: number(form, "reminderMinutes"),
          },
        }),
      );
      node.reset();
    } catch (e) {
      turi.setError((e as Error).message);
    }
  };
  const addMember = (event: FormEvent<HTMLFormElement>) => {
    const node = event.currentTarget,
      form = formValues(event);
    if (!form.has("adult") || !form.has("consent")) {
      turi.setError(
        "Necesitamos confirmar mayoría de edad y consentimiento del titular.",
      );
      return;
    }
    const member = {
      id: crypto.randomUUID(),
      name: text(form, "name"),
      email: text(form, "email"),
      belotag: text(form, "belotag"),
      adultConfirmed: true,
      consentConfirmed: true,
    };
    if (
      state.members.some(
        (m) =>
          member.belotag &&
          m.belotag.toLowerCase() === member.belotag.toLowerCase(),
      )
    ) {
      turi.setError("Ese belotag ya está en el grupo.");
      return;
    }
    update({ ...state, members: [...state.members, member] });
    node.reset();
  };
  const person = (id: string) =>
    members.find((m) => m.id === id)?.name || "Integrante";
  const displayDate = (iso: string) =>
    new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: state.trip.timeZone,
    }).format(new Date(iso));
  return (
    <section className="turi-page-scroll">
      <div className="turi-page-heading">
        <span className="turi-eyebrow">
          {tab === "trip"
            ? "DE LA IDEA AL CAMINO"
            : tab === "budget"
              ? "CADA GASTO, MÁS CLARO"
              : "VIAJAR SE DISFRUTA MÁS EN COMPAÑÍA"}
        </span>
        <h2>
          {tab === "trip"
            ? "Tu viaje, a tu manera."
            : tab === "budget"
              ? "Que las cuentas cierren."
              : "Tu grupo de viaje."}
        </h2>
        <p>
          {tab === "trip"
            ? "Destino, itinerario y recordatorios. Todo en el mismo lugar."
            : tab === "budget"
              ? "Un registro para decidir mejor. Los saldos reales se consultan en Belo."
              : "Cada persona conserva su cuenta. Compartimos el plan y los gastos que aporten."}
        </p>
      </div>
      {notice && (
        <div className="turi-success" role="status">
          <CheckIcon size={16} />
          {notice}
          <button onClick={() => setNotice("")}>Cerrar</button>
        </div>
      )}
      {(tab === "trip" || tab === "budget") && (
        <>
          <div className="turi-section-title">
            <h3>{tab === "trip" ? "Los detalles" : "Presupuesto del viaje"}</h3>
            <button
              onClick={() => setEditing((v) => !v)}
              className="turi-text-button"
            >
              {editing ? "Cerrar edición" : "Editar"}
            </button>
          </div>
          {editing ? (
            <form
              className="turi-form-grid"
              onSubmit={saveTrip}
              key={`trip-${state.trip.destination}-${state.trip.currency}`}
            >
              <Field label="Destino" wide>
                <input
                  name="destination"
                  placeholder="Por ejemplo, Río de Janeiro"
                  defaultValue={state.trip.destination}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Fecha de ida">
                <input
                  name="startDate"
                  type="date"
                  defaultValue={state.trip.startDate}
                  required
                />
              </Field>
              <Field label="Fecha de vuelta">
                <input
                  name="endDate"
                  type="date"
                  defaultValue={state.trip.endDate}
                  required
                />
              </Field>
              <Field label="Viajeros">
                <input
                  name="travelers"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={state.trip.travelers}
                  required
                />
              </Field>
              <Field label="Zona horaria del itinerario">
                <select name="timeZone" defaultValue={state.trip.timeZone}>
                  {[
                    "America/Argentina/Buenos_Aires",
                    "America/Sao_Paulo",
                    "America/Montevideo",
                    "America/Santiago",
                    "America/Mexico_City",
                    "America/New_York",
                    "Europe/Madrid",
                    "Europe/London",
                    "Asia/Tokyo",
                  ].map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Moneda de tu presupuesto">
                <select name="currency" defaultValue={state.trip.currency}>
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Moneda del destino">
                <select
                  name="destinationCurrency"
                  defaultValue={state.trip.destinationCurrency}
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Presupuesto total">
                <input
                  name="budget"
                  type="number"
                  min={0}
                  max={1e9}
                  step="0.01"
                  defaultValue={state.trip.budget}
                  required
                />
              </Field>
              <Field label="Separar para la vuelta">
                <input
                  name="returnReserve"
                  type="number"
                  min={0}
                  max={1e9}
                  step="0.01"
                  defaultValue={state.trip.returnReserve}
                />
              </Field>
              <details className="wide turi-category-limits">
                <summary>Topes por categoría (opcionales)</summary>
                <div className="turi-form-grid">
                  {categories.map((category) => (
                    <Field label={category} key={category}>
                      <input
                        name={`category-${category}`}
                        type="number"
                        min={0}
                        max={1e9}
                        step="0.01"
                        defaultValue={state.trip.categoryBudgets[category] || 0}
                      />
                    </Field>
                  ))}
                </div>
              </details>
              <Field label="Lo que te gusta" wide>
                <textarea
                  name="preferences"
                  placeholder="Playa, buen desayuno, cerca del centro…"
                  defaultValue={state.trip.preferences}
                  maxLength={1000}
                  rows={2}
                />
              </Field>
              <p className="turi-help wide">
                El dinero para la vuelta se separa en este plan; no queda
                bloqueado en tu billetera.
              </p>
              <button className="turi-primary wide" type="submit">
                <CheckIcon size={16} />
                Guardar detalles
              </button>
            </form>
          ) : (
            <div className="turi-trip-details">
              <div className="turi-trip-status" role="group" aria-label="Estado del viaje">
                {tripStatuses.filter((s) => s !== "closed").map((s) => (
                  <button key={s} type="button" aria-pressed={state.trip.status === s}
                    className={state.trip.status === s ? "active" : ""} onClick={() => setStatus(s)}>
                    {tripStatusLabel[s]}
                  </button>
                ))}
                {state.trip.destination && (confirmClose ? (
                  <span className="turi-trip-close-confirm">
                    ¿Cerrar {state.trip.destination}?
                    <button type="button" className="danger" onClick={() => setStatus("closed")}>Sí, cerrar</button>
                    <button type="button" onClick={() => setConfirmClose(false)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="turi-trip-close" onClick={() => setConfirmClose(true)}>Cerrar viaje</button>
                ))}
              </div>
              <strong>
                {state.trip.destination || "Elegí tu próximo destino"}
              </strong>
              <p>
                {state.trip.startDate || "Sin fecha"} →{" "}
                {state.trip.endDate || "Sin fecha"} · {state.trip.travelers}{" "}
                viajeros
              </p>
              <p>
                {state.trip.preferences ||
                  "Agregá tus preferencias para personalizar el viaje."}
              </p>
            </div>
          )}
        </>
      )}
      {tab === "trip" && closedTrips.length > 0 && (
        <>
          <div className="turi-section-title">
            <h3>Viajes cerrados</h3>
          </div>
          <ul className="turi-closed-trips">
            {closedTrips.map(({ id, name, createdAt, snapshot }) => (
              <li key={id}>
                <strong>{name}</strong>
                <span>
                  {snapshot.trip.startDate || "Sin fecha"} → {snapshot.trip.endDate || "Sin fecha"} ·{" "}
                  {money(snapshot.expenses.reduce((sum, e) => sum + e.homeAmount, 0), snapshot.trip.currency)} registrados
                </span>
                <small>{snapshot.trip.status === "closed" ? `Cerrado el ${createdAt.slice(0, 10)}` : `Archivado el ${createdAt.slice(0, 10)}`}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {tab === "trip" && (
        <>
          <div className="turi-section-title">
            <h3>Tu itinerario</h3>
          </div>
          {!state.itinerary.length ? (
            <Empty>
              Todavía no hay paradas. Sumá una actividad o pedile a Turi que
              arme un plan.
            </Empty>
          ) : (
            <div className="turi-timeline">
              {state.itinerary.map((item) => (
                <article key={item.id}>
                  <span className="turi-timeline-dot" />
                  <div>
                    <small>{displayDate(item.start)}</small>
                    <h4>{item.title}</h4>
                    <p>
                      <MapPinIcon size={13} />
                      {item.location || "Ubicación a confirmar"}
                    </p>
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  <button
                    className="turi-icon-button"
                    aria-label={`Quitar ${item.title}`}
                    onClick={() =>
                      update({
                        ...state,
                        itinerary: state.itinerary.filter(
                          (e) => e.id !== item.id,
                        ),
                      })
                    }
                  >
                    <TrashIcon size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
          <details className="turi-details">
            <summary>
              <PlusIcon size={17} />
              Agregar una parada
            </summary>
            <form className="turi-form-grid" onSubmit={addActivity}>
              <Field label="Actividad" wide>
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="Vuelo, check-in, paseo…"
                />
              </Field>
              <Field label="Inicio">
                <input name="start" type="datetime-local" required />
              </Field>
              <Field label="Fin">
                <input name="end" type="datetime-local" required />
              </Field>
              <p className="turi-help wide">
                Horarios en {state.trip.timeZone.replaceAll("_", " ")}.
              </p>
              <Field label="Dirección" wide>
                <input name="location" maxLength={250} />
              </Field>
              <Field label="Notas y reserva" wide>
                <textarea name="notes" maxLength={2000} />
              </Field>
              <Field label="Recordatorio en Calendar">
                <select name="reminderMinutes" defaultValue="60">
                  <option value="30">30 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 día antes</option>
                </select>
              </Field>
              <button className="turi-primary" type="submit">
                Guardar actividad
              </button>
            </form>
          </details>
          <div className="turi-section-title">
            <h3>Recordatorios</h3>
            <BellIcon size={18} />
          </div>
          <p className="turi-help">
            Para recibirlos con la web cerrada: vinculá Telegram, habilitá
            alertas y configurá el planificador. Sin eso, quedan en esta lista.
          </p>
          {state.reminders.map((item) => (
            <div className="turi-list-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {displayDate(item.at)} · {item.sent ? "Enviado" : "Pendiente"}
                </small>
              </span>
              <button
                aria-label={`Quitar recordatorio ${item.title}`}
                className="turi-icon-button"
                onClick={() =>
                  update({
                    ...state,
                    reminders: state.reminders.filter((r) => r.id !== item.id),
                  })
                }
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
          <form
            className="turi-form-grid turi-inline-form"
            onSubmit={(e) => {
              const node = e.currentTarget,
                form = formValues(e);
              try {
                update(
                  applyLocalAction(state, {
                    type: "reminder",
                    label: "Recordatorio",
                    data: {
                      id: crypto.randomUUID(),
                      title: text(form, "title"),
                      at: localTimeToIso(text(form, "at"), state.trip.timeZone),
                      sent: false,
                    },
                  }),
                );
                node.reset();
              } catch (error) {
                turi.setError((error as Error).message);
              }
            }}
          >
            <Field label="Recordame">
              <input
                name="title"
                maxLength={180}
                placeholder="Hacer el check-in"
                required
              />
            </Field>
            <Field label="Cuándo">
              <input name="at" type="datetime-local" required />
            </Field>
            <button className="turi-secondary wide">
              <PlusIcon size={15} />
              Guardar recordatorio
            </button>
          </form>
          <div className="turi-section-title">
            <h3>Alertas de cotización</h3>
          </div>
          <p className="turi-help">
            Elegí un umbral de referencia. La fuente se actualiza una vez por
            día; no anticipa el mejor momento para comprar. Requiere Telegram,
            consentimiento y planificador para avisarte.
          </p>
          {state.rateAlerts.map((alert) => (
            <div className="turi-list-row" key={alert.id}>
              <span>
                <strong>
                  1 {alert.from} {alert.direction === "below" ? "≤" : "≥"}{" "}
                  {alert.threshold} {alert.to}
                </strong>
                <small>
                  {alert.sent ? "Aviso enviado" : "Esperando el umbral"}
                </small>
              </span>
              <button
                className="turi-icon-button"
                aria-label="Quitar alerta de cotización"
                onClick={() =>
                  update({
                    ...state,
                    rateAlerts: state.rateAlerts.filter(
                      (a) => a.id !== alert.id,
                    ),
                  })
                }
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
          <form
            className="turi-form-grid"
            onSubmit={(e) => {
              const node = e.currentTarget,
                form = formValues(e);
              const next = {
                ...state,
                rateAlerts: [
                  ...state.rateAlerts,
                  {
                    id: crypto.randomUUID(),
                    from: text(form, "from"),
                    to: text(form, "to"),
                    direction: text(form, "direction"),
                    threshold: number(form, "threshold"),
                    sent: false,
                  },
                ],
              };
              try {
                update(workspaceSchema.parse(next));
                node.reset();
              } catch {
                turi.setError("Revisá las monedas y el umbral de la alerta.");
              }
            }}
          >
            <Field label="Una unidad de">
              <select name="from" defaultValue={state.trip.destinationCurrency}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Expresada en">
              <select name="to" defaultValue={state.trip.currency}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Avisarme cuando">
              <select name="direction">
                <option value="below">Baje de</option>
                <option value="above">Suba de</option>
              </select>
            </Field>
            <Field label="Umbral">
              <input
                name="threshold"
                type="number"
                min="0.000001"
                step="any"
                max={1e9}
                required
              />
            </Field>
            <button className="turi-secondary wide">Guardar alerta</button>
          </form>
        </>
      )}
      {tab === "budget" && (
        <>
          <div className="turi-budget-numbers">
            <div>
              <span>Registrado</span>
              <strong>{money(summary.spent, state.trip.currency)}</strong>
            </div>
            <div>
              <span>Disponible en tu plan</span>
              <strong className={summary.available < 0 ? "negative" : ""}>
                {money(summary.available, state.trip.currency)}
              </strong>
            </div>
            <div>
              <span>Gastaste hoy</span>
              <strong>{money(summary.spentToday, state.trip.currency)}</strong>
            </div>
            <div>
              <span>Para cada día restante</span>
              <strong>
                {summary.daysLeft
                  ? money(summary.perDayLeft, state.trip.currency)
                  : "Definí las fechas"}
              </strong>
            </div>
          </div>
          {summary.days > 0 && (
            <p className="turi-help">
              Tope diario: {money(summary.daily, state.trip.currency)} ·
              proyección al cierre:{" "}
              {money(summary.projected, state.trip.currency)} ·{" "}
              {summary.daysLeft} días restantes.
            </p>
          )}
          <div className="turi-rate-reference">
            <button
              className="turi-text-button"
              disabled={quoteBusy}
              onClick={async () => {
                setQuoteBusy(true);
                try {
                  setQuote(
                    await api("exchange", {
                      from: state.trip.destinationCurrency,
                      to: state.trip.currency,
                      amount: 1,
                    }),
                  );
                } catch (error) {
                  turi.setError((error as Error).message);
                } finally {
                  setQuoteBusy(false);
                }
              }}
            >
              {quoteBusy
                ? "Consultando…"
                : `Consultar referencia ${state.trip.destinationCurrency} → ${state.trip.currency}`}
            </button>
            {quote && (
              <p>
                1 {quote.from} ≈ {money(quote.rate, quote.to)} · actualizado{" "}
                {new Date(quote.updatedAt).toLocaleString("es-AR", {
                  timeZone: state.trip.timeZone,
                })}
                . Es una referencia diaria; la tasa y comisiones de Belo, Pix o
                tarjeta pueden diferir.
              </p>
            )}
            <a
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Rates by ExchangeRate-API
            </a>
          </div>
          {summary.daily > 0 && summary.spentToday > summary.daily && (
            <div className="turi-warning">
              Hoy superaste el presupuesto diario de{" "}
              {money(summary.daily, state.trip.currency)}. Te quedan{" "}
              {summary.daysLeft} días y{" "}
              {money(summary.available, state.trip.currency)} disponibles en el
              plan.
            </div>
          )}
          <div className="turi-category-bars">
            {Object.entries(summary.byCategory)
              .filter(([, value]) => value > 0)
              .map(([category, value]) => (
                <div key={category}>
                  <span>
                    {category}
                    <strong>{money(value, state.trip.currency)}</strong>
                  </span>
                  <i>
                    <b
                      style={{
                        width: `${summary.spent ? (value / summary.spent) * 100 : 0}%`,
                      }}
                    />
                  </i>
                </div>
              ))}
          </div>
          {categories
            .filter(
              (category) =>
                (state.trip.categoryBudgets[category] || 0) > 0 &&
                summary.byCategory[category] >
                  state.trip.categoryBudgets[category]!,
            )
            .map((category) => (
              <div className="turi-warning" key={category}>
                {category}: registraste{" "}
                {money(summary.byCategory[category], state.trip.currency)} y
                supera el tope de{" "}
                {money(
                  state.trip.categoryBudgets[category]!,
                  state.trip.currency,
                )}
                .
              </div>
            ))}
          <details className="turi-details" open>
            <summary>
              <PlusIcon size={17} />
              Registrar un gasto
            </summary>
            <form className="turi-form-grid" onSubmit={addExpense}>
              <Field label="¿En qué gastaste?" wide>
                <input
                  name="description"
                  placeholder="Almuerzo, taxi, alojamiento…"
                  required
                  maxLength={180}
                />
              </Field>
              <Field label="Importe">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={1e9}
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Moneda">
                <select
                  value={expenseCurrency}
                  onChange={(e) =>
                    setExpenseCurrency(e.target.value as typeof expenseCurrency)
                  }
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              {expenseCurrency !== state.trip.currency && (
                <Field
                  label={`Importe equivalente en ${state.trip.currency} (confirmado por vos)`}
                  wide
                >
                  <input
                    name="homeAmount"
                    type="number"
                    min="0.01"
                    max={1e9}
                    step="0.01"
                    required
                  />
                  <small>
                    Usá el total real de tu comprobante o cotización. Turi no
                    supone una tasa.
                  </small>
                </Field>
              )}
              <Field label="Fecha">
                <input
                  name="date"
                  type="date"
                  defaultValue={today(state.trip.timeZone)}
                  required
                />
              </Field>
              <Field label="Categoría">
                <select name="category">
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Pagó">
                <select name="payer">
                  {members.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="turi-checkbox">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                />
                Compartido con el grupo
              </label>
              {shared && (
                <>
                  <Field label="Cómo lo dividen" wide>
                    <select
                      value={split}
                      onChange={(e) => setSplit(e.target.value)}
                    >
                      <option value="equal">Partes iguales</option>
                      <option value="custom">Importes personalizados</option>
                    </select>
                  </Field>
                  <div className="turi-shares wide">
                    {members.map((m) => (
                      <div key={m.id}>
                        <label className="turi-checkbox">
                          <input
                            name="among"
                            value={m.id}
                            type="checkbox"
                            defaultChecked
                          />
                          {m.name}
                        </label>
                        {split === "custom" && (
                          <input
                            name={`share-${m.id}`}
                            aria-label={`Parte de ${m.name} en ${state.trip.currency}`}
                            type="number"
                            min={0}
                            max={1e9}
                            step="0.01"
                            placeholder={state.trip.currency}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button className="turi-primary wide" type="submit">
                <CheckIcon size={16} />
                Guardar gasto
              </button>
            </form>
          </details>
          <div className="turi-section-title">
            <h3>Movimientos registrados</h3>
            <span>{state.expenses.length}</span>
          </div>
          {!state.expenses.length ? (
            <Empty>
              Los gastos que registres aparecen acá. No se importan movimientos
              bancarios sin una conexión autorizada.
            </Empty>
          ) : (
            [...state.expenses].reverse().map((expense: Expense) => (
              <div className="turi-list-row" key={expense.id}>
                <span>
                  <strong>{expense.description}</strong>
                  <small>
                    {expense.category} · {expense.date} · pagó{" "}
                    {person(expense.payer)}
                  </small>
                </span>
                <span className="turi-row-amount">
                  <strong>{money(expense.amount, expense.currency)}</strong>
                  {expense.currency !== state.trip.currency && (
                    <small>
                      {money(expense.homeAmount, state.trip.currency)}
                    </small>
                  )}
                </span>
                <button
                  className="turi-icon-button"
                  aria-label={`Quitar gasto ${expense.description}`}
                  onClick={() =>
                    update({
                      ...state,
                      expenses: state.expenses.filter(
                        (e) => e.id !== expense.id,
                      ),
                    })
                  }
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))
          )}
        </>
      )}
      {tab === "group" && (
        <>
          <div className="turi-group-members">
            <div className="turi-member">
              <span className="turi-member-avatar">V</span>
              <div>
                <strong>Vos</strong>
                <small>Organizás este viaje</small>
              </div>
            </div>
            {state.members.map((member) => (
              <div className="turi-member" key={member.id}>
                <span className="turi-member-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{member.name}</strong>
                  <small>
                    {member.belotag || "Sin belotag"} ·{" "}
                    {member.email || "Sin email"}
                  </small>
                </div>
                <button
                  className="turi-icon-button"
                  aria-label={`Quitar integrante ${member.name}`}
                  onClick={() => {
                    if (
                      state.expenses.some(
                        (e) =>
                          e.payer === member.id ||
                          e.shares.some((s) => s.memberId === member.id),
                      )
                    ) {
                      turi.setError(
                        "Este integrante tiene gastos registrados. Revisalos antes de quitarlo.",
                      );
                      return;
                    }
                    update({
                      ...state,
                      members: state.members.filter((m) => m.id !== member.id),
                    });
                  }}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
          </div>
          <details className="turi-details">
            <summary>
              <PlusIcon size={17} />
              Sumar un integrante
            </summary>
            <form className="turi-form-grid" onSubmit={addMember}>
              <Field label="Nombre" wide>
                <input name="name" required maxLength={60} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" maxLength={200} />
              </Field>
              <Field label="Belotag confirmado por el titular">
                <input name="belotag" maxLength={80} placeholder="Opcional" />
              </Field>
              <label className="turi-checkbox wide">
                <input name="adult" type="checkbox" required />
                Confirmo que es mayor de 18 años.
              </label>
              <label className="turi-checkbox wide">
                <input name="consent" type="checkbox" required />
                El titular consintió que guarde sus datos y confirmó su belotag,
                si lo agregué.
              </label>
              <button className="turi-primary wide">Agregar al grupo</button>
            </form>
          </details>
          <div className="turi-section-title">
            <h3>Quién le debe a quién</h3>
            <ArrowDownRightIcon size={19} />
          </div>
          {!settlement.transfers.length ? (
            <Empty>
              {state.expenses.some((e) => e.shares.length)
                ? "Las cuentas del grupo están equilibradas con los gastos registrados."
                : "Registrá un gasto compartido desde Presupuesto para calcular las cuentas."}
            </Empty>
          ) : (
            settlement.transfers.map((transfer, index) => (
              <div className="turi-list-row" key={index}>
                <span>
                  <strong>
                    {person(transfer.from)}
                    <ArrowRightIcon size={14} />
                    {person(transfer.to)}
                  </strong>
                  <small>
                    Balance organizativo · no es una solicitud de pago
                  </small>
                </span>
                <strong>{money(transfer.amount, state.trip.currency)}</strong>
              </div>
            ))
          )}
          <p className="turi-help">
            Los QR, solicitudes de cobro de Belo Air y referidos oficiales
            quedan pendientes de validación de la API. Un belotag no permite
            consultar los gastos de otra persona.
          </p>
        </>
      )}
    </section>
  );
}
