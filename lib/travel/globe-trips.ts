import { workspaceSchema, type Workspace } from "@/lib/turi/domain";

export type TripStatus = "completed" | "active" | "upcoming";
export type Coordinates = { lat: number; lng: number; approximate?: boolean };
export type GlobeTrip = {
  id: string;
  destination: string;
  country: string;
  coordinates: Coordinates | null;
  status: TripStatus;
  startDate: string;
  endDate: string;
  travelers: number;
  currency: string;
  budget: number;
  spent: number;
  reserve: number;
  members: string[];
  itinerary: { id: string; title: string; start: string; location: string; notes: string }[];
  expenses: { id: string; description: string; amount: number; currency: string; category: string; date: string }[];
  source: "example" | "current" | "archive";
};

export const TRIP_STATUS: Record<TripStatus, { label: string; action: string; color: string }> = {
  completed: { label: "Vivido", action: "Reviví el viaje", color: "#6300dc" },
  active: { label: "En curso", action: "Así va tu viaje", color: "#007e67" },
  upcoming: { label: "Próximo", action: "Tu próximo capítulo", color: "#83719e" },
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Offline gazetteer. Country-only matches are explicitly approximate; unknown
// destinations stay in the trip list instead of being placed at invented coordinates.
const PLACES: [string, string, number, number][] = [
  ["buenos aires|caba", "Argentina", -34.604, -58.382],
  ["bariloche|san carlos de bariloche", "Argentina", -41.134, -71.31],
  ["mendoza", "Argentina", -32.89, -68.845], ["cordoba", "Argentina", -31.42, -64.189],
  ["ushuaia", "Argentina", -54.801, -68.303], ["salta", "Argentina", -24.785, -65.411],
  ["el calafate|calafate", "Argentina", -50.337, -72.265], ["iguazu|puerto iguazu", "Argentina", -25.6, -54.574],
  ["mar del plata", "Argentina", -38.005, -57.543], ["jujuy", "Argentina", -24.185, -65.3],
  ["rio de janeiro|rio|copacabana|ipanema", "Brasil", -22.907, -43.173],
  ["sao paulo|san pablo", "Brasil", -23.55, -46.633],
  ["florianopolis|floripa", "Brasil", -27.595, -48.548], ["salvador de bahia|salvador", "Brasil", -12.977, -38.501],
  ["buzios", "Brasil", -22.747, -41.881], ["recife", "Brasil", -8.054, -34.881],
  ["fortaleza", "Brasil", -3.732, -38.527], ["brasilia", "Brasil", -15.797, -47.891],
  ["porto alegre", "Brasil", -30.035, -51.218], ["manaus", "Brasil", -3.119, -60.022],
  ["cartagena|cartagena de indias", "Colombia", 10.391, -75.479],
  ["bogota", "Colombia", 4.711, -74.072], ["medellin", "Colombia", 6.244, -75.581],
  ["santa marta", "Colombia", 11.24, -74.199], ["san andres", "Colombia", 12.584, -81.7],
  ["cusco|cuzco|machu picchu", "Perú", -13.532, -71.967], ["lima", "Perú", -12.046, -77.043],
  ["arequipa", "Perú", -16.409, -71.538],
  ["ciudad de mexico|mexico city|cdmx|distrito federal", "México", 19.433, -99.133],
  ["cancun", "México", 21.161, -86.852], ["tulum", "México", 20.212, -87.465],
  ["playa del carmen|riviera maya", "México", 20.63, -87.074], ["oaxaca", "México", 17.074, -96.727],
  ["guadalajara", "México", 20.66, -103.35], ["puerto vallarta", "México", 20.653, -105.225],
  ["santiago de chile|santiago", "Chile", -33.449, -70.669], ["valparaiso", "Chile", -33.047, -71.612],
  ["san pedro de atacama|atacama", "Chile", -22.909, -68.199], ["punta arenas", "Chile", -53.163, -70.917],
  ["montevideo", "Uruguay", -34.901, -56.165], ["punta del este", "Uruguay", -34.967, -54.95],
  ["colonia del sacramento|colonia", "Uruguay", -34.463, -57.844],
  ["quito", "Ecuador", -0.181, -78.468], ["guayaquil", "Ecuador", -2.171, -79.922],
  ["galapagos", "Ecuador", -0.743, -90.315], ["la paz", "Bolivia", -16.5, -68.15],
  ["uyuni", "Bolivia", -20.463, -66.826], ["sucre", "Bolivia", -19.019, -65.262],
  ["asuncion", "Paraguay", -25.264, -57.575], ["caracas", "Venezuela", 10.48, -66.904],
  ["isla margarita|margarita", "Venezuela", 10.998, -63.911],
  ["san jose de costa rica|san jose", "Costa Rica", 9.928, -84.091], ["la fortuna", "Costa Rica", 10.467, -84.643],
  ["ciudad de panama|panama city", "Panamá", 8.983, -79.52], ["bocas del toro", "Panamá", 9.34, -82.24],
  ["antigua guatemala|antigua", "Guatemala", 14.558, -90.733], ["ciudad de guatemala", "Guatemala", 14.635, -90.507],
  ["la habana|havana", "Cuba", 23.113, -82.367], ["varadero", "Cuba", 23.179, -81.189],
  ["punta cana", "República Dominicana", 18.56, -68.372], ["santo domingo", "República Dominicana", 18.486, -69.931],
  ["san juan", "Puerto Rico", 18.466, -66.106], ["san salvador", "El Salvador", 13.692, -89.218],
  ["tegucigalpa", "Honduras", 14.072, -87.192], ["managua", "Nicaragua", 12.115, -86.237],
];
const COUNTRIES: [string, string, number, number][] = [
  ["argentina", "Argentina", -38.4, -63.6], ["brasil|brazil", "Brasil", -14.2, -51.9],
  ["colombia", "Colombia", 4.6, -74.3], ["peru", "Perú", -9.19, -75.0],
  ["mexico", "México", 23.6, -102.55], ["chile", "Chile", -35.7, -71.5],
  ["uruguay", "Uruguay", -32.52, -55.77], ["ecuador", "Ecuador", -1.83, -78.18],
  ["bolivia", "Bolivia", -16.29, -63.59], ["paraguay", "Paraguay", -23.44, -58.44],
  ["venezuela", "Venezuela", 6.42, -66.59], ["costa rica", "Costa Rica", 9.75, -83.75],
  ["panama", "Panamá", 8.54, -80.78], ["guatemala", "Guatemala", 15.78, -90.23],
  ["cuba", "Cuba", 21.52, -77.78], ["republica dominicana", "República Dominicana", 18.74, -70.16],
];

export function locateDestination(destination: string): { country: string; coordinates: Coordinates | null } {
  const text = ` ${normalize(destination)} `;
  const match = (aliases: string) => aliases.split("|").some((alias) => text.includes(` ${alias} `));
  if (match("espana|spain|italia|italy|estados unidos|united states|francia|france|canada|portugal")) return { country: "", coordinates: null };
  const country = COUNTRIES.find(([aliases]) => match(aliases));
  const city = PLACES.find(([aliases, name]) => match(aliases) && (!country || country[1] === name));
  if (city) return { country: city[1], coordinates: { lat: city[2], lng: city[3] } };
  if (country) return { country: country[1], coordinates: { lat: country[2], lng: country[3], approximate: true } };
  return { country: "", coordinates: null };
}

export function tripStatus(start: string, end: string, timeZone: string, now = new Date()): TripStatus {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (end && end < date) return "completed";
  if (start && start <= date && (!end || end >= date)) return "active";
  return "upcoming";
}

function fromWorkspace(state: Pick<Workspace, "trip" | "expenses" | "itinerary"> & { members: { name: string }[] }, id: string, source: GlobeTrip["source"], now: Date): GlobeTrip {
  const trip = state.trip;
  return {
    id, source, destination: trip.destination, ...locateDestination(trip.destination),
    status: trip.status === "closed" ? "completed" : tripStatus(trip.startDate, trip.endDate, trip.timeZone, now),
    startDate: trip.startDate, endDate: trip.endDate, travelers: trip.travelers,
    currency: trip.currency, budget: trip.budget, reserve: trip.returnReserve,
    spent: state.expenses.reduce((total, expense) => total + expense.homeAmount, 0),
    members: state.members.map((member) => member.name),
    itinerary: state.itinerary.map(({ id, title, start, location, notes }) => ({ id, title, start, location, notes })),
    expenses: state.expenses.map(({ id, description, amount, currency, category, date }) => ({ id, description, amount, currency, category, date })),
  };
}

export function readGlobeTrips(raw: string | null, now = new Date()): GlobeTrip[] {
  if (!raw) return [];
  try {
    const envelope = JSON.parse(raw);
    const result = workspaceSchema.safeParse(envelope.state);
    if (!result.success) return [];
    const state = result.data;
    const trips = state.postTrip.archivedTrips.map((archive) => fromWorkspace(archive.snapshot, archive.id, "archive", now));
    // Archiving retains the current trip in the workspace. Show that snapshot once.
    const archived = state.postTrip.archivedTrips.some(({ snapshot }) =>
      snapshot.trip.destination === state.trip.destination && snapshot.trip.startDate === state.trip.startDate && snapshot.trip.endDate === state.trip.endDate);
    if (state.trip.destination && !archived) trips.push(fromWorkspace(state, "current", "current", now));
    return trips;
  } catch { return []; }
}

const example = (trip: Partial<GlobeTrip> & Pick<GlobeTrip, "id" | "destination" | "status" | "startDate" | "endDate">): GlobeTrip => ({
  travelers: 3, currency: "USD", budget: 1250, spent: 0, reserve: 100,
  members: ["Vos", "Juli", "Fran"], itinerary: [], expenses: [], source: "example",
  ...locateDestination(trip.destination), ...trip,
});

export const EXAMPLE_TRIPS: GlobeTrip[] = [
  example({ id: "rio", destination: "Río de Janeiro", status: "active", startDate: "2026-10-25", endDate: "2026-11-01", budget: 1480, spent: 624,
    itinerary: [
      { id: "r1", title: "Llegada y check-in en Ipanema", start: "2026-10-25T15:00:00-03:00", location: "Ipanema, Río de Janeiro", notes: "Comprobante del alojamiento guardado en el viaje." },
      { id: "r2", title: "Atardecer en el Pan de Azúcar", start: "2026-10-28T16:30:00-03:00", location: "Urca, Río de Janeiro", notes: "Entradas confirmadas para el grupo." },
      { id: "r3", title: "Un día en Ilha Grande", start: "2026-10-30T08:00:00-03:00", location: "Vila do Abraão", notes: "Excursión planificada. Traslado por confirmar." },
    ], expenses: [
      { id: "re1", description: "Alojamiento en Ipanema", amount: 420, currency: "USD", category: "Alojamiento", date: "2026-10-25" },
      { id: "re2", description: "Comidas del grupo", amount: 136, currency: "USD", category: "Comida", date: "2026-10-27" },
      { id: "re3", description: "Traslados y paseos", amount: 68, currency: "USD", category: "Transporte", date: "2026-10-28" },
    ] }),
  example({ id: "cusco", destination: "Cusco", status: "completed", startDate: "2026-06-14", endDate: "2026-06-21", budget: 1160, spent: 982,
    itinerary: [
      { id: "c1", title: "Cusco, sin apuro", start: "2026-06-14T14:00:00-05:00", location: "Centro histórico", notes: "Primer paseo por San Blas y la Plaza de Armas." },
      { id: "c2", title: "El Valle Sagrado", start: "2026-06-16T08:00:00-05:00", location: "Pisac y Ollantaytambo", notes: "Un día entre mercados, montañas y caminos incas." },
      { id: "c3", title: "Llegamos a Machu Picchu", start: "2026-06-18T06:00:00-05:00", location: "Machu Picchu", notes: "Tren, entrada y recorrido del grupo en el mismo itinerario." },
    ], expenses: [
      { id: "ce1", description: "Alojamiento · 7 noches", amount: 364, currency: "USD", category: "Alojamiento", date: "2026-06-14" },
      { id: "ce2", description: "Tren y transportes", amount: 278, currency: "USD", category: "Transporte", date: "2026-06-18" },
      { id: "ce3", description: "Comidas y experiencias", amount: 340, currency: "USD", category: "Actividades", date: "2026-06-21" },
    ] }),
  example({ id: "cartagena", destination: "Cartagena", status: "completed", startDate: "2026-03-08", endDate: "2026-03-13", budget: 920, spent: 846,
    itinerary: [
      { id: "ca1", title: "Nos perdimos por Getsemaní", start: "2026-03-09T10:00:00-05:00", location: "Getsemaní", notes: "Murales, café y una tarde sin reloj." },
      { id: "ca2", title: "Islas del Rosario", start: "2026-03-11T08:30:00-05:00", location: "Mar Caribe", notes: "Excursión del grupo y regreso al atardecer." },
    ], expenses: [ { id: "cae1", description: "Alojamiento, comidas y paseos", amount: 846, currency: "USD", category: "Otros", date: "2026-03-13" } ] }),
  example({ id: "mexico", destination: "Ciudad de México", status: "upcoming", startDate: "2027-02-12", endDate: "2027-02-19", budget: 1640, spent: 380,
    itinerary: [
      { id: "m1", title: "Llegada a Ciudad de México", start: "2027-02-12T13:00:00-06:00", location: "Aeropuerto Benito Juárez", notes: "Vuelo agregado al itinerario." },
      { id: "m2", title: "Nuestra base en Roma Norte", start: "2027-02-12T15:00:00-06:00", location: "Roma Norte", notes: "Alojamiento reservado por 7 noches." },
      { id: "m3", title: "Coyoacán y Casa Azul", start: "2027-02-14T10:00:00-06:00", location: "Coyoacán", notes: "Visita planificada. Entradas pendientes." },
    ], expenses: [ { id: "me1", description: "Anticipo del alojamiento", amount: 380, currency: "USD", category: "Alojamiento", date: "2026-10-20" } ] }),
  example({ id: "bariloche", destination: "Bariloche", status: "upcoming", startDate: "2027-07-16", endDate: "2027-07-23", budget: 1380, spent: 0,
    itinerary: [
      { id: "b1", title: "Una semana frente al Nahuel Huapi", start: "2027-07-16T15:00:00-03:00", location: "Bariloche", notes: "Fechas elegidas por el grupo. Alojamiento por reservar." },
      { id: "b2", title: "Nieve en el Cerro Catedral", start: "2027-07-18T09:00:00-03:00", location: "Cerro Catedral", notes: "Actividad propuesta para el itinerario." },
    ] }),
];

export function formatTripDate(date: string) {
  if (!date) return "Fecha por definir";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function tripMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
