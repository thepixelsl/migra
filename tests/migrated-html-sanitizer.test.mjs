import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractMigratedMainHtml,
  sanitizeMigratedHtml,
} from "../scripts/lib/sanitize-migrated-html.mjs";

test("removes active and parser-confusing HTML from migrated content", () => {
  const sanitized = sanitizeMigratedHtml(`
    <div onclick="alert(1)">
      <p onmouseover=alert(1)>Sicherer Text</p>
      <script>alert(1)</script>
      <svg><a xlink:href="javascript:alert(1)">SVG</a></svg>
      <math><mtext><img src=x onerror=alert(1)></mtext></math>
      <iframe srcdoc="<script>alert(1)</script>"></iframe>
      <form action="https://attacker.example"><input name="password"></form>
      <a href="jav&#x61;script:alert(1)">Gefährlich</a>
      <a href="java&#10;script:alert(1)">Zeilenumbruch</a>
      <a href="data:text/html,<script>alert(1)</script>">Datenlink</a>
      <a href="//attacker.example/path">Protokollrelativ</a>
      <a href="/\\attacker.example/path">Backslash</a>
      <img src=x onerror=alert(1)>
      <p>&#60;svg onload=alert(1)&#62;Entity payload&#60;/svg&#62;</p>
    </div>
  `);

  assert.match(sanitized, /<p>Sicherer Text<\/p>/);
  assert.match(sanitized, /<a>Gefährlich<\/a>/);
  assert.match(sanitized, /<a>Zeilenumbruch<\/a>/);
  assert.match(sanitized, /<a>Datenlink<\/a>/);
  assert.match(sanitized, /<a>Protokollrelativ<\/a>/);
  assert.match(sanitized, /<a>Backslash<\/a>/);
  assert.match(sanitized, /&lt;svg onload=alert\(1\)&gt;Entity payload&lt;\/svg&gt;/);
  assert.doesNotMatch(
    sanitized,
    /<\/?(?:script|svg|math|iframe|form|input|img)\b|javascript:|data:text\/html|srcdoc|xlink:/i,
  );
  assert.doesNotMatch(sanitized, /<[^>]+\son\w+\s*=/i);
});

test("preserves the editorial allowlist, safe links, tables and asset rewrites", () => {
  const originalAsset = "https://artbild-fotografie.de/wp-content/uploads/example.pdf?download=1";
  const sanitized = sanitizeMigratedHtml(`
    <h2 dir="ltr" class="legacy">Überschrift</h2>
    <p><strong>Warm</strong> und <em>editorial</em><br>erzählt [sic].</p>
    <ul><li>Ein Punkt</li></ul>
    <table><thead><tr><th scope="col" style="color:red">Name</th></tr></thead>
      <tbody><tr><td colspan="2">York</td></tr></tbody></table>
    <p><a href="https://www.artbild-fotografie.de/kontakt/?a=1#formular">Kontakt</a></p>
    <p><a href="https://example.com/story" onclick="alert(1)">Extern</a></p>
    <p><a href="mailto:info@example.com">E-Mail</a> <a href="tel:+4940123456">Telefon</a></p>
    <p><a href="${originalAsset}">PDF</a></p>
  `, new Map([[originalAsset, "/migrated-assets/example.pdf"]]));

  assert.match(sanitized, /<h2 dir="ltr">Überschrift<\/h2>/);
  assert.match(sanitized, /<strong>Warm<\/strong> und <em>editorial<\/em><br>erzählt \[sic\]/);
  assert.match(sanitized, /<ul><li>Ein Punkt<\/li><\/ul>/);
  assert.match(sanitized, /<th scope="col">Name<\/th>/);
  assert.match(sanitized, /<td colspan="2">York<\/td>/);
  assert.match(sanitized, /href="\/kontakt\/\?a=1#formular"/);
  assert.match(
    sanitized,
    /<a href="https:\/\/example\.com\/story" rel="noopener noreferrer" target="_blank">Extern<\/a>/,
  );
  assert.match(sanitized, /href="\/migrated-assets\/example\.pdf"/);
  assert.match(sanitized, /<a href="mailto:info@example\.com">E-Mail<\/a>/);
  assert.match(sanitized, /<a href="tel:\+4940123456">Telefon<\/a>/);
  assert.doesNotMatch(sanitized, /class=|style=|onclick=/i);
});

test("extracts the actual page body and drops legacy page chrome", () => {
  const extracted = extractMigratedMainHtml(`
    <header><nav><a href="/evil-menu/">Altes Menü</a></nav></header>
    <main><header><a href="/duplicate/">Seitentitel-Navigation</a></header>
      <article><div class="entry-content"><h2>Geschichte</h2><p>Bleibt erhalten.</p></div></article>
    </main>
    <footer><form action="https://attacker.example"><input name="search"></form></footer>
  `);
  const sanitized = sanitizeMigratedHtml(extracted);

  assert.match(sanitized, /<h2>Geschichte<\/h2><p>Bleibt erhalten\.<\/p>/);
  assert.doesNotMatch(sanitized, /Altes Menü|Seitentitel-Navigation|attacker\.example|<form|<input/i);
});
