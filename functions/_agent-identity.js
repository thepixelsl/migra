// Canonical categories only: never retain a raw User-Agent, address or referrer.
const BOTS = [
  [/ChatGPT-User/i, "ChatGPT", "OpenAI", "ChatGPT-User", "user"],
  [/OAI-SearchBot/i, "OpenAI", "OpenAI", "OAI-SearchBot", "search"],
  [/GPTBot/i, "OpenAI", "OpenAI", "GPTBot", "crawler"],
  [/Claude-User/i, "Claude", "Anthropic", "Claude-User", "user"],
  [/Claude-SearchBot/i, "Claude", "Anthropic", "Claude-SearchBot", "search"],
  [/ClaudeBot|anthropic-ai/i, "Claude", "Anthropic", "ClaudeBot", "crawler"],
  [/Perplexity-User/i, "Perplexity", "Perplexity", "Perplexity-User", "user"],
  [/PerplexityBot/i, "Perplexity", "Perplexity", "PerplexityBot", "search"],
  [/Google-CloudVertexBot/i, "Google (Dienst unklar)", "Google", "Google-CloudVertexBot", "crawler"],
  [/Googlebot|GoogleOther/i, "Google (Dienst unklar)", "Google", "Google-Crawler", "crawler"],
  [/Google-NotebookLM/i, "NotebookLM", "Google", "Google-NotebookLM", "user"],
  [/\bGemini(?:[ /;-]|$)/i, "Gemini", "Google", "Gemini", "agent"],
  [/\bClaude(?:[ /;-]|$)|claude-code/i, "Claude", "Anthropic", "Claude", "agent"],
  [/\bChatGPT(?:[ /;-]|$)|\bCodex(?:[ /;-]|$)/i, "ChatGPT / Codex", "OpenAI", "OpenAI-Agent", "agent"],
  [/bingbot|BingPreview|MicrosoftPreview/i, "Microsoft Bing", "Microsoft", "Bing", "search"],
  [/\bCopilot(?:[ /;-]|$)/i, "Microsoft Copilot", "Microsoft", "Copilot", "agent"],
  [/DuckAssistBot/i, "DuckDuckGo", "DuckDuckGo", "DuckAssistBot", "user"],
  [/Applebot/i, "Apple", "Apple", "Applebot", "crawler"],
  [/meta-externalagent|facebookexternalhit/i, "Meta", "Meta", "Meta-Crawler", "crawler"],
  [/Amazonbot/i, "Amazon", "Amazon", "Amazonbot", "crawler"],
  [/Bytespider/i, "ByteDance", "ByteDance", "Bytespider", "crawler"],
  [/CCBot/i, "Common Crawl", "Common Crawl", "CCBot", "crawler"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere", "Cohere", "Cohere", "crawler"],
  [/YouBot/i, "You.com", "You.com", "YouBot", "search"],
];

export function availabilityChannel(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/agenten-test/")) return "agent_html";
  // This describes the declared entry point, never a verified human identity.
  const source = request.headers.get("X-Artbild-Availability-Source");
  if (source === "fab" || source === "agent_form") return source;
  return "api";
}

export async function reportedAgentIdentity(request, env) {
  const ua = (request.headers.get("User-Agent") || "").slice(0, 1024);
  const bot = BOTS.find(([pattern]) => pattern.test(ua));
  let network = null;
  if (typeof env?.AGENT_NETWORK_LOOKUP === "function") {
    // This value is provided by the hosting proxy. It is evidence, not authentication.
    const ip = (request.headers.get("x-real-ip") || "").trim();
    try { network = env.AGENT_NETWORK_LOOKUP(ip); } catch { /* classification is best effort */ }
  }
  if (bot) {
    const [, clientLabel, provider, botName, activity] = bot;
    const matches = network?.provider === provider;
    return {
      clientLabel, clientVerified: false,
      identitySource: matches ? "user_agent_ip" : "user_agent",
      botName, activity,
      evidence: matches ? "Bot-Kennung und gemeldete Anbieter-IP passen zusammen."
        : network ? "Bot-Kennung erkannt; die gemeldete Anbieter-IP passt nicht dazu."
          : "Bot-Kennung erkannt; Herkunft nicht unabhängig bestätigt.",
    };
  }
  if (network) return {
    clientLabel: network.provider === "Anthropic" ? "Claude / Anthropic"
      : network.provider === "Google" ? "Google (Dienst unklar)" : network.provider,
    clientVerified: false, identitySource: "provider_ip", botName: "", activity: "unknown",
    evidence: "Gemeldete IP gehört zu einem veröffentlichten Anbieter-Netz; konkreter Dienst unklar.",
  };
  const browser = /Mozilla\/5\.0|Safari\/|Chrome\/|Firefox\//i.test(ua);
  const automation = /bot\b|crawler|spider|HeadlessChrome|python-requests|python-httpx|curl\/|wget\/|node|undici|Go-http-client/i.test(ua);
  return {
    clientLabel: automation ? "Anderer Agent / Abrufdienst" : browser ? "Browser (Mensch oder KI)" : "Nicht identifiziert",
    clientVerified: false, identitySource: automation ? "automation" : browser ? "browser" : "unknown",
    botName: "", activity: automation ? "automation" : browser ? "browser" : "unknown",
    evidence: browser && !automation ? "Browserkennung; menschliche Bedienung und Computer Use sind nicht unterscheidbar."
      : automation ? "Automatisches Abrufwerkzeug erkannt; KI-Anbieter unbekannt." : "Keine zuordenbare Kennung oder Anbieter-IP.",
  };
}
