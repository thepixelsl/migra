import { BlockList, isIP } from "node:net";

export const BOT_NETWORK_SOURCES = [
  ["OpenAI", "https://openai.com/chatgpt-user.json"],
  ["OpenAI", "https://openai.com/searchbot.json"],
  ["OpenAI", "https://openai.com/gptbot.json"],
  ["Anthropic", "https://claude.com/crawling/bots.json"],
  ["Perplexity", "https://www.perplexity.ai/perplexity-user.json"],
  ["Perplexity", "https://www.perplexity.ai/perplexitybot.json"],
  ["Google", "https://developers.google.com/static/crawling/ipranges/common-crawlers.json"],
  ["Google", "https://developers.google.com/static/crawling/ipranges/special-crawlers.json"],
  ["Google", "https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json"],
];
const MAX_AGE = 24 * 60 * 60 * 1000;

export function compileNetworkList(payload) {
  const list = new BlockList();
  let count = 0;
  for (const entry of (payload?.prefixes || []).slice(0, 20000)) {
    const cidr = entry.ipv4Prefix || entry.ipv6Prefix;
    if (typeof cidr !== "string") continue;
    const [address, prefix, extra] = cidr.split("/");
    const family = isIP(address);
    const bits = Number(prefix);
    if (!family || extra !== undefined || !/^\d+$/.test(prefix || "") || bits < 1 || bits > (family === 4 ? 32 : 128)) continue;
    list.addSubnet(address, bits, family === 4 ? "ipv4" : "ipv6");
    count += 1;
  }
  if (!count) throw new Error("empty_bot_network_list");
  return list;
}

export function createAgentNetworkRegistry({ fetcher = fetch, now = Date.now, sources = BOT_NETWORK_SOURCES } = {}) {
  const entries = new Map();
  let pending;
  let timer;
  let closed = false;
  async function refresh() {
    if (pending) return pending;
    pending = Promise.allSettled(sources.map(async ([provider, url]) => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000), redirect: "error" });
      if (!response.ok) throw new Error("bot_network_fetch_failed");
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error("bot_network_list_too_large");
      const list = compileNetworkList(JSON.parse(body));
      if (!closed) entries.set(url, { provider, list, updatedAt: now() });
    })).finally(() => { pending = undefined; });
    return pending;
  }
  return {
    refresh,
    lookup(address) {
      const family = isIP(address);
      if (!family) return null;
      for (const entry of entries.values()) {
        if (now() - entry.updatedAt <= MAX_AGE && entry.list.check(address, family === 4 ? "ipv4" : "ipv6")) {
          return { provider: entry.provider };
        }
      }
      return null;
    },
    start() {
      void refresh();
      timer = setInterval(() => { void refresh(); }, 6 * 60 * 60 * 1000);
      timer.unref?.();
    },
    close() { closed = true; clearInterval(timer); },
  };
}
