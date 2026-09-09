# Lokale Zwei-Faktor-Anmeldung auf Bunny

Die Anmeldung prüft das vorhandene Passwort und einen zeitbasierten Einmalcode
(TOTP nach RFC 6238). QR-Erzeugung, Prüfung, verschlüsselte Geheimnisse und
Wiederherstellung bleiben in der bestehenden Bunny-Anwendung und Datenbank.
Es gibt keinen zusätzlichen Authentifizierungsdienst und keine zusätzliche
Anbietergebühr für diese Funktion. Eine kompatible Authenticator-App erzeugt
Codes lokal; deren Cloud-Synchronisierung ist optional und nicht erforderlich.

## Vor dem ersten produktiven Start

- `ADMIN_USERNAME` und `ADMIN_PASSWORD` bleiben erhalten.
- `ADMIN_SESSION_SECRET` muss ein unabhängiger, zufälliger Schlüssel mit
  **32 Bytes als base64url ohne Padding** sein: genau 43 Zeichen. Er darf
  nicht dem Passwort entsprechen. Bisherige schwache oder fehlende Werte
  werden abgewiesen. Dieser Schlüssel verschlüsselt künftig das TOTP-Geheimnis.
- `ADMIN_MFA_SETUP_TOKEN` ist ein **anderer** zufälliger Wert im selben Format.
  Er erlaubt nur die erste Registrierung, solange für das Konto noch kein
  Authenticator bestätigt wurde.
- `ADMIN_PUBLIC_ORIGIN=https://artbild-fotografie.de` ist der verbindliche
  Ursprung für Login- und Admin-Schreibanfragen. Für eine Testdomain muss
  deren eigener HTTPS-Ursprung eingetragen werden.

Die beiden Zufallswerte können bei der Einrichtung lokal erzeugt und direkt
in den geheimen Umgebungsvariablen von Bunny hinterlegt werden. Sie gehören
nicht in Git, Build-Argumente, Logs, Screenshots, Chats oder E-Mails.
Einrichtungsschlüssel zusätzlich bis zur Registrierung sicher verfügbar halten.
Keine Produktionsdatenbank an eine lokale Browser-Testinstanz anschließen.

Ohne gültige Konfiguration liefert die Admin-Anmeldung 503. Es gibt keinen
Fallback auf die frühere Passwortanmeldung. Die öffentliche Website bleibt
verfügbar. Deshalb zuerst die Variablen vorbereiten, danach das geprüfte
Container-Image umstellen und unmittelbar persönlich einrichten.

## Einrichtung im Browser

1. `/admin-login/` öffnen und mit Benutzername und Passwort anmelden.
2. Den einmaligen Einrichtungsschlüssel eingeben.
3. QR-Code mit einer TOTP-Authenticator-App scannen oder den angezeigten
   Schlüssel als zeitbasiertes Konto eingeben. QR-Code und Schlüssel bleiben geheim.
4. Einen aktuellen sechsstelligen Code bestätigen.
5. Die zehn Wiederherstellungscodes herunterladen und sicher, getrennt vom
   Authenticator aufbewahren. Danach die Sicherung bestätigen.

Erst jetzt wird die Terminverwaltung freigeschaltet. Die Einrichtungscodes
werden nach dem Fortfahren nicht erneut angezeigt. Die nur dafür nötigen
verschlüsselten Anzeigedaten werden beim Fortfahren gelöscht, spätestens nach
zehn Minuten ungültig und bei der periodischen Bereinigung entfernt.
Nach erfolgreicher Einrichtung `ADMIN_MFA_SETUP_TOKEN` aus Bunny entfernen.
Ein Neustart oder das Entfernen dieses Tokens deaktiviert 2FA nicht.

## Anmeldung und Abmelden

Nach dem Passwort folgt der aktuelle Authenticator-Code. Ein bestätigter
Zeitschritt kann nicht erneut benutzt werden, auch nicht parallel oder auf
einem zweiten Container. Das zulässige Zeitfenster beträgt einen Schritt
vor und nach der Serverzeit (je 30 Sekunden). Die Server- und Geräteuhr müssen stimmen.

Die vorläufige Anmeldung läuft nach zehn Minuten ab. Erst bestätigte 2FA
erzeugt eine voll berechtigte Sitzung. HTTP Basic, frühere v1-Cookies und
vorläufige Cookies gewähren keinen Zugriff auf Admin-Daten.

Unter **Anmeldesicherheit & Abmelden** kann dieses Gerät oder können alle
Geräte abgemeldet werden. Dieselben Cookies funktionieren danach nicht mehr.
Sitzungen enden außerdem nach 30 Minuten Inaktivität, spätestens nach vier
Stunden. Passwortänderungen in der Serverkonfiguration beenden bestehende
Sitzungen und vorläufige Anmeldungen; der Authenticator bleibt erhalten.

## Verlorenes Gerät

Nach dem Passwort **Kein Zugriff auf den Authenticator?** öffnen und einen
unbenutzten Wiederherstellungscode eingeben. Jeder Code wird atomar nur einmal
verbraucht. Andere Sitzungen werden sofort beendet. Anschließend muss ein
neuer Authenticator bestätigt werden; erst danach gibt es neue
Wiederherstellungscodes und eine neue Admin-Sitzung. Alle alten
Wiederherstellungscodes werden bei der Bestätigung ersetzt.

Wenn der Vorgang abbricht, kann ein anderer noch gültiger Wiederherstellungscode
verwendet werden. Wer alle Faktoren und Codes verloren hat, benötigt einen
kontrollierten Eingriff des Serverbetreibers. Ein öffentliches Passwort-only-
Reset oder eine E-Mail-Hintertür existiert bewusst nicht. Das erneute Setzen
des ursprünglichen Einrichtungsschlüssels setzt eine bestehende 2FA nicht zurück.

## Betrieb und Daten

`admin_mfa_accounts` speichert ein AES-256-GCM-verschlüsseltes TOTP-Geheimnis,
den zuletzt verbrauchten Zeitschritt und HMAC-Prüfwerte der Wiederherstellungscodes.
`admin_login_sessions` speichert nur Hashes der zufälligen Sitzungstokens,
CSRF-Werte, Ablaufzeiten und kurzlebige verschlüsselte Einrichtungsdaten.
Abgelaufene Sitzungen werden periodisch entfernt. Geheimnisse, Codes,
Cookies und Formulardaten werden nicht durch die Authentifizierung protokolliert.

Der Verschlüsselungsschlüssel wird per HKDF domänenspezifisch aus
`ADMIN_SESSION_SECRET` abgeleitet. Dieses Secret muss zusammen mit der
Datenbank sicher wiederherstellbar sein. **Nicht einfach rotieren:** Mit
einem anderen Schlüssel können gespeicherte Authenticator-Geheimnisse nicht
mehr gelesen werden. Eine Rotation benötigt eine separate, geprüfte
Neuverschlüsselung oder kontrollierte Neueinrichtung. Auch den Benutzernamen
nicht beiläufig ändern; er ist Teil der Kontozuordnung.

Passwort- und Faktorversuche sind getrennt auf fünf pro 15 Minuten begrenzt.
Ein korrektes Passwort kann die Faktorsperre nicht löschen. Diese globalen
Kontobudgets können weiterhin den legitimen Neulogin durch fremde Fehlversuche
vorübergehend blockieren; ein zusätzlicher geprüfter Edge-Schutz wäre eine
separate Verbesserung. Aktive Sitzungen bleiben nutzbar.

## Veröffentlichung und Rückfall

Die Änderung wird als Bunny-Image gebaut. `npm run deploy` ist der andere,
hier nicht zu verwendende Cloudflare-Worker-Pfad. Vor Veröffentlichung müssen
`npm run test:bunny`, die relevanten Browserprüfungen und der vollständige
Build bestehen. Danach Container-Bereitschaft, Login-Header, 401-Antworten
beider Admin-APIs und persönliche Einrichtung prüfen.

Ein Zurückrollen auf einen früheren Container würde die Passwort-only-Anmeldung
wieder öffnen. Nach aktivierter 2FA ist das kein sicherer Standard-Rollback.
Bei Störungen den Admin-Zugang geschlossen halten, die Schlüssel wiederherstellen
oder einen korrigierten 2FA-fähigen Build einsetzen. Die öffentliche Website
kann dabei weiterlaufen. Es wurden keine robots.txt- oder CDN-Purge-Änderungen
mit dieser 2FA-Implementierung verbunden.

## Prüfungen

Die lokale Testsuite verwendet ausschließlich eigene Testidentitäten und
temporäre SQLite-Datenbanken. Sie prüft unter anderem RFC-Vektoren,
Einrichtung, fehlende zweite Faktoren, Wiederverwendung, parallele Versuche,
getrennte Limits, Wiederherstellung, Logout, Ablauf und fehlende Konfiguration.
Browseransichten in Desktop-/Mobilgrößen ersetzen keinen Nachweis auf einem
echten iPhone oder Android-Gerät.
