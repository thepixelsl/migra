const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function adminAuthPage({ stage = "password", csrf = "", error = "", secret = "", qr = "", codes = [] } = {}) {
  const hidden = (action) => `<input type="hidden" name="action" value="${action}"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`;
  const otpInput = '<label for="code">Sechsstelliger Bestätigungscode</label><input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9 ]{6,8}" autocomplete="one-time-code" maxlength="8" required autofocus aria-describedby="code-help"><p id="code-help" class="hint">Den aktuellen Code finden Sie in Ihrer Authenticator-App. Jeder Code kann nur einmal verwendet werden.</p>';
  const alert = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : "";
  let heading = "Terminverwaltung";
  let intro = "Melden Sie sich mit Ihrem Passwort und anschließend mit einem Bestätigungscode an.";
  let content = `<form method="post" action="/admin-login/">
    <input type="hidden" name="action" value="password">
    <label for="admin-username">Benutzername</label>
    <input id="admin-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="200" required autofocus>
    <label for="admin-password">Passwort</label>
    <input id="admin-password" name="password" type="password" autocomplete="current-password" maxlength="1024" required>
    ${alert}<button type="submit">Weiter zum Bestätigungscode</button></form>`;
  if (stage === "setup-authorize") {
    heading = "Zwei-Faktor-Anmeldung einrichten";
    intro = "Für die erste Einrichtung benötigen Sie zusätzlich den einmaligen Einrichtungsschlüssel aus Ihrer Serverkonfiguration.";
    content = `<form method="post" action="/admin-login/">${hidden("authorize-setup")}
      <label for="setup-token">Einrichtungsschlüssel</label>
      <input id="setup-token" name="setup_token" type="password" autocomplete="off" maxlength="128" required autofocus>
      ${alert}<button type="submit">Authenticator einrichten</button></form>`;
  } else if (["setup", "replace"].includes(stage)) {
    heading = stage === "replace" ? "Authenticator neu einrichten" : "Authenticator verbinden";
    intro = "Scannen Sie diesen QR-Code mit Ihrer Authenticator-App. Die App kann Bestätigungscodes auch ohne Internet erzeugen.";
    content = `<img class="qr" src="${escapeHtml(qr)}" alt="QR-Code zum Hinzufügen von Artbild-Fotografie in Ihrer Authenticator-App" width="256" height="256">
      <details><summary>Schlüssel manuell eingeben</summary><p>Kontotyp: zeitbasiert (TOTP). Anbieter: Artbild-Fotografie.</p><code class="secret">${escapeHtml(secret)}</code></details>
      <form method="post" action="/admin-login/">${hidden("confirm-setup")}${otpInput}${alert}
      <button type="submit">Bestätigungscode prüfen</button></form>
      <p class="hint">Die Einrichtung wird erst nach einem gültigen Code aktiviert. Bewahren Sie den QR-Code und den Schlüssel vertraulich auf.</p>`;
  } else if (stage === "verify") {
    heading = "Anmeldung bestätigen";
    intro = "Geben Sie den aktuellen Code Ihrer Authenticator-App ein.";
    content = `<form method="post" action="/admin-login/">${hidden("verify")}${otpInput}${alert}<button type="submit">Sicher anmelden</button></form>
      <details><summary>Kein Zugriff auf den Authenticator?</summary>
      <p>Mit einem unbenutzten Wiederherstellungscode können Sie Ihren Authenticator neu einrichten. Andere Sitzungen werden dabei beendet.</p>
      <form method="post" action="/admin-login/">${hidden("recover")}
      <label for="recovery-code">Wiederherstellungscode</label><input id="recovery-code" name="recovery_code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" required>
      <button type="submit">Authenticator wiederherstellen</button></form></details>`;
  } else if (stage === "backup") {
    heading = "Wiederherstellungscodes sichern";
    intro = "Mit diesen Codes erhalten Sie wieder Zugang, wenn Ihr Authenticator verloren geht. Jeder Code funktioniert nur einmal.";
    const download = `Artbild-Fotografie – Wiederherstellungscodes\n\n${codes.join("\n")}\n\nJeder Code funktioniert nur einmal. Zusammen mit dem Passwort sicher und getrennt vom Authenticator aufbewahren.\n`;
    content = `<ul class="codes">${codes.map((code) => `<li><code>${escapeHtml(code)}</code></li>`).join("")}</ul>
      <a class="download" download="artbild-wiederherstellungscodes.txt" href="data:text/plain;charset=utf-8,${encodeURIComponent(download)}">Codes als Textdatei speichern</a>
      <p>Nach dem Fortfahren werden diese Codes nicht erneut angezeigt. Speichern Sie sie an einem sicheren Ort, getrennt von Ihrem Authenticator.</p>
      <form method="post" action="/admin-login/">${hidden("acknowledge")}
      <label class="checkbox"><input type="checkbox" name="saved" value="yes" required> Ich habe meine Wiederherstellungscodes sicher gespeichert.</label>
      ${alert}<button type="submit">Zur Terminverwaltung</button></form>`;
  } else if (stage === "security") {
    heading = "Anmeldesicherheit";
    intro = "Ihre Zwei-Faktor-Anmeldung ist aktiv. Sie können diese Sitzung oder alle angemeldeten Geräte abmelden.";
    content = `<form method="post" action="/admin-logout/">${hidden("logout")}<button type="submit">Dieses Gerät abmelden</button></form>
      <form method="post" action="/admin-security/">${hidden("logout-all")}<button type="submit" class="secondary">Alle Geräte abmelden</button></form>
      <p><a href="/admin-termine/">Zurück zur Terminverwaltung</a></p>`;
  } else if (["unavailable", "limited"].includes(stage)) {
    heading = stage === "limited" ? "Bitte kurz warten" : "Anmeldung vorübergehend nicht verfügbar";
    intro = stage === "limited"
      ? "Zu viele Anmeldeversuche. Bitte versuchen Sie es in spätestens 15 Minuten erneut."
      : "Die Anmeldung kann gerade nicht sicher durchgeführt werden. Bitte prüfen Sie die Einrichtung oder versuchen Sie es später erneut.";
    content = '<p><a href="/admin-login/">Zur Anmeldung</a></p>';
  }
  const cancel = csrf && !["security", "backup"].includes(stage)
    ? `<form class="cancel" method="post" action="/admin-logout/">${hidden("logout")}<button class="secondary" type="submit">Anmeldung abbrechen</button></form>` : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow, noarchive"><link rel="icon" href="data:,"><title>${escapeHtml(heading)} | Artbild-Fotografie</title>
    <style>
      :root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;background:#f4f2ee;color:#181818}*{box-sizing:border-box}
      body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px}main{width:min(100%,480px);background:#fff;border:1px solid #dedbd5;border-radius:18px;padding:clamp(20px,5vw,38px);box-shadow:0 18px 50px #00000014;min-width:0}
      .eyebrow{margin:0 0 12px;color:#514d47;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:clamp(1.55rem,6vw,2.1rem);line-height:1.15;overflow-wrap:anywhere}
      p{line-height:1.55}.intro{margin:16px 0 24px;color:#45423e}form{display:grid;gap:10px}label{margin-top:8px;font-size:.95rem;font-weight:700}input{width:100%;min-width:0;min-height:48px;border:1px solid #777;border-radius:9px;padding:11px;font:inherit;font-size:16px}
      input:focus,button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #145c4b;outline-offset:3px}button,.download{min-height:48px;margin-top:12px;border:0;border-radius:9px;padding:12px 16px;background:#145c4b;color:#fff;font:inherit;font-weight:700;cursor:pointer;text-align:center;text-decoration:none}
      button.secondary{color:#184c40;background:#e9efeb}.error{margin:8px 0;padding:12px;background:#fff0ee;color:#7e2018;border-radius:8px}.hint,.privacy{font-size:.85rem;color:#48443e}.hint{margin:2px 0 10px}.privacy{margin:24px 0 0}.qr{display:block;width:min(100%,256px);height:auto;margin:0 auto 20px}details{margin:20px 0;padding:14px;background:#f4f2ee;border-radius:8px}summary{cursor:pointer;font-weight:700;line-height:1.5}.secret{display:block;overflow-wrap:anywhere;line-height:1.7}.codes{list-style:none;padding:14px 8px;text-align:center;background:#f4f2ee;border-radius:8px}.codes li{padding:5px 0}.codes code{font-size:clamp(.75rem,2.7vw,.91rem);white-space:nowrap}.download{display:block}.checkbox{display:flex;gap:12px;align-items:flex-start;font-weight:400;line-height:1.5}.checkbox input{width:22px;min-height:22px;margin:2px 0;flex-shrink:0}.cancel{margin-top:16px}a{color:#145c4b}
      @media(max-width:360px){body{padding:12px}main{padding:20px 16px}}
    </style></head><body><main><p class="eyebrow">Artbild-Fotografie</p><h1>${escapeHtml(heading)}</h1><p class="intro">${escapeHtml(intro)}</p>${content}${cancel}
    <p class="privacy">Die Codes werden direkt auf unserem Server geprüft. Eine Sitzung endet nach 30 Minuten ohne Aktivität, spätestens nach vier Stunden.</p></main></body></html>`;
}
