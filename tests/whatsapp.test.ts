import test from "node:test";
import assert from "node:assert/strict";
import { isAllowed, parseIncoming, toWhatsappText } from "../lib/turi/whatsapp";

const key = (extra = {}) => ({ id: "ABC", remoteJid: "5493810000000@s.whatsapp.net", fromMe: false, ...extra });

test("parseIncoming reads text, captions and media", () => {
  assert.equal(parseIncoming({ key: key(), message: { conversation: " hola " } })?.text, "hola");
  assert.equal(parseIncoming({ key: key(), message: { extendedTextMessage: { text: "che" } } })?.text, "che");
  const image = parseIncoming({ key: key(), message: { imageMessage: { mimetype: "image/png", caption: "ticket" }, base64: "AAAA" } });
  assert.deepEqual(image?.media, { kind: "file", type: "image/png", name: "comprobante.jpg", base64: "AAAA" });
  assert.equal(image?.text, "ticket");
  const audio = parseIncoming({ key: key(), message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" }, base64: "BBBB" } });
  assert.equal(audio?.media?.kind, "audio");
});

test("parseIncoming ignores groups, own messages and empty events", () => {
  assert.equal(parseIncoming({ key: key({ remoteJid: "123-456@g.us" }), message: { conversation: "x" } }), undefined);
  assert.equal(parseIncoming({ key: key({ remoteJid: "status@broadcast" }), message: { conversation: "x" } }), undefined);
  assert.equal(parseIncoming({ key: key({ fromMe: true }), message: { conversation: "x" } }), undefined);
  assert.equal(parseIncoming({ key: key(), message: {} }), undefined);
});

test("parseIncoming prefers the phone JID over a LID", () => {
  const lid = parseIncoming({ key: key({ remoteJid: "999@lid", remoteJidAlt: "5493810000000@s.whatsapp.net" }), message: { conversation: "x" } });
  assert.equal(lid?.jid, "5493810000000@s.whatsapp.net");
  assert.equal(parseIncoming({ key: key({ remoteJid: "999@lid" }), message: { conversation: "x" } })?.jid, "999@lid");
});

test("toWhatsappText converts markdown", () => {
  assert.equal(toWhatsappText("**Hotel** en [Booking](https://b.com/x)"), "*Hotel* en Booking: https://b.com/x");
  assert.equal(toWhatsappText("## Día 1"), "*Día 1*");
});

test("isAllowed filters by phone when a list is set", () => {
  assert.equal(isAllowed("5491126883748@s.whatsapp.net", "+54 9 11 2688-3748"), true);
  assert.equal(isAllowed("5493810000000@s.whatsapp.net", "5491126883748"), false);
  assert.equal(isAllowed("999@lid", "5491126883748"), false);
  assert.equal(isAllowed("5493810000000@s.whatsapp.net", ""), true);
});

test("hotelCaption arma la ficha del hotel para la foto", async () => {
  const { hotelCaption } = await import("../lib/turi/whatsapp");
  const caption = hotelCaption({ id: "1", name: "LK Design Hotel", address: "R. Bocaiúva 1755, Florianópolis", stars: 4,
    ratingLabel: "Excelente", rating: 4.9, listPrice: 445623, price: 325305, discount: 27, image: "https://x/y.jpg", url: "https://travel.belo.app/hotel/1" });
  assert.match(caption, /^\*LK Design Hotel\* ⭐⭐⭐⭐/);
  assert.match(caption, /por noche \(antes .*-27%\)/);
  assert.match(caption, /travel\.belo\.app\/hotel\/1$/);
});
