import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(new URL("../src/scripts/fab-android-chrome.js", import.meta.url), "utf8");
const android = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1";

test("helper stays an external same-origin script permitted by Bunny CSP", () => {
  const component = readFileSync(new URL("../src/components/FloatingActionButton.astro", import.meta.url), "utf8");
  assert.match(component, /fab-android-chrome\.js\?url&no-inline/);
  assert.match(component, /<script is:inline src=\{androidChromeBackdropScript\} defer><\/script>/);
});

function run({ ua = android, platform = "Linux armv8l", brands, supported = true, currentFilter = "none", small = true, panelCount = 1 } = {}) {
  const calls = { queries: [], writes: [], listeners: [] };
  const media = { matches: small, addEventListener: (event, fn) => calls.listeners.push({ event, fn }) };
  const panels = Array.from({ length: panelCount }, (_, index) => ({
    style: { setProperty: (property, value) => calls.writes.push({ index, property, value }) },
  }));
  vm.runInNewContext(script, {
    navigator: { userAgent: ua, platform, ...(brands ? { userAgentData: { brands } } : {}) },
    CSS: { supports: (property, value) => {
      assert.equal(property, "backdrop-filter");
      assert.equal(value, "blur(1px)");
      return supported;
    } },
    document: { querySelectorAll: (selector) => { calls.queries.push(selector); return panels; } },
    getComputedStyle: () => ({ getPropertyValue: (property) => {
      assert.equal(property, "backdrop-filter");
      return currentFilter;
    } }),
    window: { matchMedia: (query) => { assert.equal(query, "(max-width: 480px)"); return media; } },
  });
  return { calls, media };
}

for (const [name, ua, platform] of [
  ["iPhone Safari", iphone, "iPhone"],
  ["iPhone Chrome", iphone.replace("Version/26.0", "CriOS/126.0.0.0"), "iPhone"],
  ["iPad Safari", iphone.replaceAll("iPhone", "iPad"), "iPad"],
  ["iPad desktop UA", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/26.0 Safari/605.1.15", "MacIntel"],
  ["Apple platform even with Android UA", android, "MacIntel"],
  ["desktop Chrome", android.replace("Linux; Android 15", "Windows NT 10.0; Win64; x64"), "Win32"],
  ["Samsung Internet", android + " SamsungBrowser/28.0", "Linux armv8l"],
  ["Edge Android", android + " EdgA/126.0.0.0", "Linux armv8l"],
  ["Opera Android", android + " OPR/88.0", "Linux armv8l"],
  ["Vivaldi Android", android + " Vivaldi/7.0", "Linux armv8l"],
  ["Android WebView", android.replace("Android 15", "Android 15; wv"), "Linux armv8l"],
  ["Firefox Android", "Mozilla/5.0 (Android 15; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0", "Linux armv8l"],
  ["unknown browser", "Unknown/1.0", ""],
]) {
  test(`${name}: no DOM queries, style writes or listeners`, () => {
    const { calls } = run({ ua, platform });
    assert.deepEqual(calls, { queries: [], writes: [], listeners: [] });
  });
}

test("non-Chrome client-hint brands are excluded", () => {
  const { calls } = run({ brands: [{ brand: "Chromium" }, { brand: "Brave" }] });
  assert.deepEqual(calls, { queries: [], writes: [], listeners: [] });
});

test("Android Chrome restores only the existing 18px filter", () => {
  const { calls } = run({ brands: [{ brand: "Chromium" }, { brand: "Google Chrome" }] });
  assert.deepEqual(calls.queries, [".floating-action__menu[data-floating-action-panel]"]);
  assert.deepEqual(calls.writes, [{ index: 0, property: "backdrop-filter", value: "saturate(180%) blur(18px)" }]);
  assert.equal(calls.listeners.length, 1);
  assert.equal(calls.listeners[0].event, "change");
});

test("existing wide-viewport filter is 22px; rotation tracks the original breakpoint", () => {
  const { calls, media } = run({ small: false });
  assert.equal(calls.writes[0].value, "saturate(180%) blur(22px)");
  media.matches = true;
  calls.listeners[0].fn();
  assert.equal(calls.writes[1].value, "saturate(180%) blur(18px)");
});

test("no fallback when standard filter is unsupported", () => {
  const { calls } = run({ supported: false });
  assert.deepEqual(calls, { queries: [], writes: [], listeners: [] });
});

test("no override if the authored filter already works", () => {
  const { calls } = run({ currentFilter: "saturate(1.8) blur(18px)" });
  assert.deepEqual(calls.writes, []);
  assert.deepEqual(calls.listeners, []);
});

test("pages without a FAB need no listener or mutation", () => {
  const { calls } = run({ panelCount: 0 });
  assert.deepEqual(calls.writes, []);
  assert.deepEqual(calls.listeners, []);
});
