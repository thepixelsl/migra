import { BlockList, isIP } from "node:net";

export const BOT_NETWORK_SOURCES = [
  ["OpenAI", "https://openai.com/chatgpt-user.json", ["ChatGPT-User"]],
  ["OpenAI", "https://openai.com/searchbot.json", ["OAI-SearchBot"]],
  ["OpenAI", "https://openai.com/gptbot.json", ["GPTBot"]],
  ["Anthropic", "https://claude.com/crawling/bots.json", ["Claude-User", "Claude-SearchBot", "ClaudeBot"]],
  ["Perplexity", "https://www.perplexity.ai/perplexity-user.json", ["Perplexity-User"]],
  ["Perplexity", "https://www.perplexity.ai/perplexitybot.json", ["PerplexityBot"]],
  ["Google", "https://developers.google.com/static/crawling/ipranges/common-crawlers.json", ["Googlebot", "GoogleOther"]],
  ["Google", "https://developers.google.com/static/crawling/ipranges/special-crawlers.json", []],
  ["Google", "https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json", ["Google-NotebookLM"]],
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
    pending = Promise.allSettled(sources.map(async ([provider, url, botNames = []]) => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000), redirect: "error" });
      if (!response.ok) throw new Error("bot_network_fetch_failed");
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error("bot_network_list_too_large");
      const list = compileNetworkList(JSON.parse(body));
      if (!closed) entries.set(url, { provider, botNames, list, updatedAt: now() });
    })).finally(() => { pending = undefined; });
    return pending;
  }
  return {
    refresh,
    lookup(address) {
      const family = isIP(address);
      if (!family) return null;
      const matches = [...entries.values()].filter((entry) => now() - entry.updatedAt <= MAX_AGE
        && entry.list.check(address, family === 4 ? "ipv4" : "ipv6"));
      if (!matches.length || new Set(matches.map((entry) => entry.provider)).size !== 1) return null;
      return { provider: matches[0].provider, botNames: [...new Set(matches.flatMap((entry) => entry.botNames))] };
    },
    start() {
      void refresh();
      timer = setInterval(() => { void refresh(); }, 6 * 60 * 60 * 1000);
      timer.unref?.();
    },
    close() { closed = true; clearInterval(timer); },
  };
}
