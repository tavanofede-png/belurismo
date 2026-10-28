import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("lote de tarjetas: guarda las creadas aunque una falle", async () => {
  process.chdir(mkdtempSync(join(tmpdir(), "turi-cards-")));
  process.env.BELO_API_KEY = "belo_test_x";
  delete process.env.UPSTASH_REDIS_REST_URL;
  let n = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const { name } = JSON.parse(String(init.body));
    if (name === "Francisco")
      return new Response(JSON.stringify({ error: { code: "x", message: "y" } }), { status: 422 });
    n++;
    return new Response(JSON.stringify({ id: `c${n}`, name, lastFour: `000${n}`, brand: "visa", type: "virtual", status: "active", canFreeze: true }), { status: 201 });
  }) as typeof fetch;
  const { createCards, loadCards } = await import("../lib/turi/belo-cards");
  const results = await createCards(["Marco", "Francisco", "Juan"], "100.00");
  assert.deepEqual(results.map((r) => r.ok), [true, false, true]);
  assert.match(results[1].error!, /tope de tarjetas virtuales o falta saldo/);
  const saved = await loadCards();
  assert.deepEqual(saved.map((c) => [c.holder, c.limitUsd]), [["Marco", "100.00"], ["Juan", "100.00"]]);
});

test("el widget de tarjetas acepta creadas y fallidas, y descarta datos sensibles", async () => {
  const { readConversationWidget } = await import("../lib/turi/conversation-widgets");
  const widget = readConversationWidget({ id: "w", type: "cards", cards: [
    { holder: "Marco", lastFour: "0001", status: "active", limitUsd: "100.00", pan: "4111111111111111" },
    { holder: "Francisco", lastFour: null, status: "failed", limitUsd: "100.00", error: "falta saldo" },
  ] });
  assert.equal(widget?.type, "cards");
  assert.equal(widget?.type === "cards" && "pan" in widget.cards[0], false);
});

test("ante un 429 de belo reintenta con la misma Idempotency-Key", async () => {
  process.env.BELO_API_KEY = "belo_test_x";
  const keys: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
    if (keys.length === 1) return new Response("{}", { status: 429, headers: { "retry-after": "1" } });
    return new Response(JSON.stringify({ id: "c9", name: "Ana", lastFour: "0009", brand: "visa", type: "virtual", status: "active", canFreeze: true }), { status: 201 });
  }) as typeof fetch;
  const { createCards } = await import("../lib/turi/belo-cards");
  const [result] = await createCards(["Ana"], null);
  assert.equal(result.ok, true);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test("belo travel: arma la URL de búsqueda con el formato del sitio y el widget sólo acepta links de belo travel", async () => {
  const { beloTravelSearchUrl, beloTravelHotelUrl, findBeloTravelDestination } = await import("../lib/turi/belo-travel");
  const { readConversationWidget } = await import("../lib/turi/conversation-widgets");
  const tucuman = findBeloTravelDestination("Me voy a Tucumán");
  assert.ok(tucuman);
  assert.equal(beloTravelSearchUrl(tucuman, "2026-10-28", "2026-10-29", 2),
    "https://travel.belo.app/search?businessTrip=false&dates=20261028,20261029&placeId=ChIJA2nF1pI3IpQRJ2XFtZJbjfg&propertyTypes=1&q=San%20Miguel%20de%20Tucum%C3%A1n,%20Tucum%C3%A1n%20Province,%20Argentina&rooms=2-&sorting=Discount-desc&stars=4,5&currency=ARS");
  const hotel = { ...tucuman.hotels[0], url: beloTravelHotelUrl(tucuman.hotels[0].id, "2026-10-28", "2026-10-29", 2) };
  const widget = { id: "h", type: "belo-hotels", destination: tucuman.name, searchUrl: "https://travel.belo.app/", checkedAt: "2026-10-28", checkedDates: ["2026-10-28", "2026-10-29"], adults: 2 };
  assert.equal(readConversationWidget({ ...widget, hotels: [hotel] })?.type, "belo-hotels");
  assert.equal(readConversationWidget({ ...widget, hotels: [{ ...hotel, url: "https://www.booking.com/hotel/x" }] }), undefined);
  assert.equal(findBeloTravelDestination("Bariloche"), undefined);
});

test("hoteles web sólo como respaldo: se descartan si el destino está en belo travel", async () => {
  const { findBeloTravelDestination } = await import("../lib/turi/belo-travel");
  assert.ok(findBeloTravelDestination("Florianópolis, Santa Catarina Hotel Majestic"));
  assert.equal(findBeloTravelDestination("Bariloche, Río Negro Llao Llao"), undefined);
});

test("matchCards busca por titular sin acentos ni mayúsculas, o por últimos 4", async () => {
  const { matchCards } = await import("../lib/turi/belo-cards");
  const cards = [
    { holder: "kenny", lastFour: "2830" },
    { holder: "Franco Perez", lastFour: "5349" },
    { holder: "Franco Perez", lastFour: "5478" },
    { holder: "Lucía Montero", lastFour: "1287" },
  ];
  assert.deepEqual(matchCards(cards, "Kenny").map((c) => c.lastFour), ["2830"]);
  assert.deepEqual(matchCards(cards, "lucia").map((c) => c.lastFour), ["1287"]);
  assert.deepEqual(matchCards(cards, "franco perez").map((c) => c.lastFour), ["5349", "5478"]);
  assert.deepEqual(matchCards(cards, "5478").map((c) => c.holder), ["Franco Perez"]);
  assert.deepEqual(matchCards(cards, "juan"), []);
});

test("congelar llama a freeze con Idempotency-Key y descongelar a unfreeze", async () => {
  process.env.BELO_API_KEY = "belo_test_x";
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${url.split("/api/v1")[1]} ${Boolean((init.headers as Record<string, string>)["Idempotency-Key"])}`);
    const status = url.endsWith("/freeze") ? "frozen" : "active";
    return new Response(JSON.stringify({ id: "316", name: "kenny", lastFour: "2830", brand: "visa", type: "virtual", status, canFreeze: true }), { status: 200 });
  }) as typeof fetch;
  const { setCardFrozen } = await import("../lib/turi/belo-cards");
  assert.equal((await setCardFrozen("316", true)).status, "frozen");
  assert.equal((await setCardFrozen("316", false)).status, "active");
  assert.deepEqual(calls, ["POST /cards/316/freeze true", "POST /cards/316/unfreeze true"]);
});
