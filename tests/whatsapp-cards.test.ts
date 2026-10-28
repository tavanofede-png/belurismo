import test from "node:test";
import assert from "node:assert/strict";
import { renderBeloCard, renderHotelCard, renderOptionCard, renderTripSummary } from "../lib/turi/whatsapp-cards";
import { buildConversationPanels } from "../lib/turi/conversation-panels";
import { emptyWorkspace } from "../lib/turi/domain";

// Offline: fonts and photos fail to download, so the cards render with the fallback font and no photo.
// @vercel/og still reads its bundled font through fetch(file://), so only http(s) is cut.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (/^https?:/.test(String(input instanceof Request ? input.url : input))) throw new Error("offline");
  return realFetch(input, init);
}) as typeof fetch;
const isPng = (base64: string) => {
  const bytes = Buffer.from(base64, "base64");
  return bytes.subarray(0, 4).toString("hex") === "89504e47" && bytes.length > 10_000;
};

test("las tarjetas de WhatsApp salen como PNG aun sin red", async () => {
  assert.ok(isPng(await renderHotelCard({ id: "1", name: "LK Design Hotel", address: "Florianópolis", stars: 4, ratingLabel: "Excelente",
    rating: 4.9, listPrice: 445623, price: 325305, discount: 27, image: "https://x/y.jpg", url: "https://travel.belo.app/hotel/1" })));
  assert.ok(isPng(await renderOptionCard({ id: "o", kind: "restaurant", name: "Ostradamus", location: "Ribeirão da Ilha", summary: "s", price: null,
    facts: [], pros: ["Ostras frescas"], cons: ["Reservar"], caveat: "c", sourceUrl: "https://ostradamus.com.br", sourceTitle: "ostradamus.com.br",
    checkedAt: new Date().toISOString() })));
  assert.ok(isPng(await renderBeloCard({ holder: "kenny", lastFour: "2830", status: "frozen", limitUsd: "100.00" })));
  assert.ok(isPng(await renderBeloCard({ holder: "Juan", lastFour: null, status: "failed", limitUsd: null, error: "falta saldo" })));
  assert.ok(isPng(await renderTripSummary(buildConversationPanels(emptyWorkspace()).summary)));
});
