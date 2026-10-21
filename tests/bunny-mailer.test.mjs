import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { createContactMailer } from "../server/bunny-mailer.mjs";

test("the upgraded SMTP adapter preserves TLS, Unicode addresses and buffered attachments without network delivery", async (t) => {
  const realCreateTransport = nodemailer.createTransport.bind(nodemailer);
  const stream = realCreateTransport({ streamTransport: true, buffer: true, newline: "unix" });
  let configured;
  let generated;
  t.mock.method(nodemailer, "createTransport", (options) => {
    configured = options;
    return { sendMail: async (message) => { generated = await stream.sendMail(message); } };
  });
  const send = createContactMailer({ STRATO_SMTP_USER: "smtp@example.test", STRATO_SMTP_PASS: "test-only" });
  await send({
    from: { name: "Artbild Fotografie", email: "info@example.test" },
    to: { name: "Artbild", email: "inquiries@example.test" },
    reply: { name: "Jörg, Müller & Partner", email: "joerg+hochzeit@example.test" },
    subject: "Anfrage für eine Hochzeit",
    text: "Termin und Nachricht bleiben erhalten.",
    attachments: [{ filename: "portrait.jpg", content: Buffer.from("photo-test-bytes").toString("base64"), mimeType: "image/jpeg" }],
  });
  assert.equal(configured.host, "smtp.strato.de");
  assert.equal(configured.port, 465);
  assert.equal(configured.secure, true);
  assert.equal(configured.connectionTimeout, 15_000);
  assert.equal(configured.greetingTimeout, 15_000);
  assert.equal(configured.socketTimeout, 20_000);
  assert.deepEqual(generated.envelope, { from: "info@example.test", to: ["inquiries@example.test"] });
  const mime = generated.message.toString("utf8");
  assert.match(mime, /Reply-To:[\s\S]*?joerg\+hochzeit@example\.test/);
  assert.match(mime, /Content-Type: image\/jpeg; name=portrait\.jpg/);
  assert.match(mime, /cGhvdG8tdGVzdC1ieXRlcw==/);
  assert.match(mime, /Termin und Nachricht bleiben erhalten\./);
});

test("missing SMTP credentials still disable the mail adapter", () => {
  assert.equal(createContactMailer({}), undefined);
  assert.equal(createContactMailer({ STRATO_SMTP_USER: "smtp@example.test" }), undefined);
});
