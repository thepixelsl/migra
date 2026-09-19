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
  [/Googlebot/i, "Google", "Google", "Googlebot", "search"],
  [/GoogleOther/i, "Google", "Google", "GoogleOther", "crawler"],
  [/Google-NotebookLM/i, "NotebookLM", "Google", "Google-NotebookLM", "user"],
  [/\bGemini(?:[ /;-]|$)/i, "Gemini", "Google", "Gemini", "agent"],
  [/\bClaude(?:[ /;-]|$)|claude-code/i, "Claude", "Anthropic", "Claude", "agent"],
  [/\bCodex(?:[ /;-]|$)/i, "Codex", "OpenAI", "Codex", "agent"],
  [/\bChatGPT(?:[ /;-]|$)/i, "ChatGPT", "OpenAI", "ChatGPT", "agent"],
  [/bingbot|BingPreview|MicrosoftPreview/i, "Microsoft Bing", "Microsoft", "Bing", "search"],
  [/\bCopilot(?:[ /;-]|$)/i, "Microsoft Copilot", "Microsoft", "Copilot", "agent"],
  [/DuckAssistBot/i, "DuckDuckGo", "DuckDuckGo", "DuckAssistBot", "user"],
  [/Applebot/i, "Apple", "Apple", "Applebot", "crawler"],
  [/facebookexternalhit/i, "Meta", "Meta", "FacebookExternalHit", "preview"],
  [/meta-externalagent/i, "Meta", "Meta", "Meta-ExternalAgent", "crawler"],
  [/meta-externalfetcher/i, "Meta AI", "Meta", "Meta-ExternalFetcher", "user"],
  [/meta-webindexer/i, "Meta AI", "Meta", "Meta-WebIndexer", "search"],
  [/meta-externalads/i, "Meta", "Meta", "Meta-ExternalAds", "ads"],
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
    const botNetworkMatches = matches && network.botNames?.includes(botName) === true;
    return {
      clientLabel, clientVerified: false,
      audience: botNetworkMatches ? "verified_bot" : "reported_bot", device: "unknown",
      identitySource: matches ? "user_agent_ip" : "user_agent",
      botName, activity,
      evidence: matches ? "Bot-Kennung und gemeldete Anbieter-IP passen zusammen."
        : network ? "Bot-Kennung erkannt; die gemeldete Anbieter-IP passt nicht dazu."
          : "Bot-Kennung erkannt; Herkunft nicht unabhängig bestätigt.",
    };
  }
  if (network) return {
    audience: "reported_bot", device: "unknown",
    clientLabel: network.provider === "Anthropic" ? "Claude / Anthropic"
      : network.provider === "Google" ? "Google (Dienst unklar)" : network.provider,
    clientVerified: false, identitySource: "provider_ip", botName: "", activity: "unknown",
    evidence: "Gemeldete IP gehört zu einem veröffentlichten Anbieter-Netz; konkreter Dienst unklar.",
  };
  const browser = /Mozilla\/5\.0|Safari\/|Chrome\/|Firefox\//i.test(ua);
  const automation = /bot\b|crawler|spider|HeadlessChrome|python-requests|python-httpx|curl\/|wget\/|node|undici|Go-http-client/i.test(ua);
  const interaction = request.headers.get("X-Artbild-Interaction");
  const automated = automation || interaction === "automated";
  const manual = browser && !automated && interaction === "browser"
    && ["fab", "agent_form"].includes(availabilityChannel(request));
  return {
    audience: manual ? "likely_manual" : automated ? "reported_bot" : "unknown",
    device: manual ? browserDevice(request, ua) : "unknown",
    clientLabel: automated ? "Anderer Agent / Abrufdienst" : browser ? "Browser (Mensch oder KI)" : "Nicht identifiziert",
    clientVerified: false, identitySource: automated ? "automation" : browser ? "browser" : "unknown",
    botName: "", activity: automated ? "automation" : browser ? "browser" : "unknown",
    evidence: manual ? "Browser-Formular mit Bedienungssignal; vermutlich manuell. Computer Use bleibt möglich."
      : browser && !automated ? "Browserkennung ohne belastbares Bedienungssignal."
        : automated ? "Automatisches Abrufwerkzeug oder WebMCP erkannt; Anbieter nicht bestätigt." : "Keine zuordenbare Kennung oder Anbieter-IP.",
  };
}

function browserDevice(request, ua) {
  // Store a coarse class only. Touch-capable iPads can advertise a desktop UA.
  if (/iPad|Tablet|Silk|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (request.headers.get("X-Artbild-Device") === "tablet" && /Macintosh/i.test(ua)) return "tablet";
  if (request.headers.get("Sec-CH-UA-Mobile") === "?1" || /Mobile|iPhone|iPod|Windows Phone/i.test(ua)) return "mobile";
  if (/Windows NT|Macintosh|X11|CrOS|Linux x86/i.test(ua)) return "desktop";
  return "unknown";
}

export function auditAudience(row, meta) {
  if (meta.version === 2 && ["verified_bot", "reported_bot", "likely_manual", "unknown"].includes(meta.audience)) return meta.audience;
  // Old provider matches do not record which service's network matched.
  if (["api_key", "user_agent", "user_agent_ip", "provider_ip", "automation"].includes(row.identity_source)) return "reported_bot";
  return "unknown";
}
