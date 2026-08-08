import nodemailer from "nodemailer";

function requiredText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function createContactMailer(env = process.env) {
  const username = requiredText(env.STRATO_SMTP_USER);
  const password = requiredText(env.STRATO_SMTP_PASS);

  if (!username || !password) return undefined;

  const transporter = nodemailer.createTransport({
    host: requiredText(env.SMTP_HOST) || "smtp.strato.de",
    port: Number.parseInt(env.SMTP_PORT || "465", 10),
    secure: env.SMTP_SECURE !== "false",
    auth: {
      user: username,
      pass: password,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  return async function sendContactMail(message) {
    await transporter.sendMail({
      from: {
        name: message.from.name,
        address: message.from.email,
      },
      to: {
        name: message.to.name,
        address: message.to.email,
      },
      replyTo: {
        name: message.reply.name,
        address: message.reply.email,
      },
      subject: message.subject,
      text: message.text,
      attachments: message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, "base64"),
        contentType: attachment.mimeType,
      })),
    });
  };
}
