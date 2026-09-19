// Coarse hints only, without identifiers, storage, cookies or fingerprinting.
// A trusted browser event is still possible under Computer Use.
export function availabilitySignals(event, navigatorInfo = navigator) {
  const automated = navigatorInfo.webdriver === true || event?.agentInvoked === true;
  const interaction = automated ? "automated" : event?.isTrusted === true ? "browser" : "unknown";
  return {
    "X-Artbild-Interaction": interaction,
    ...(/Macintosh/.test(navigatorInfo.userAgent || "") && navigatorInfo.maxTouchPoints > 1
      ? { "X-Artbild-Device": "tablet" } : {}),
  };
}
