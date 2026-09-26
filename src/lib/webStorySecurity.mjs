// Only standalone story documents need the AMP runtime. Other pages retain
// their existing policy, including all admin and API responses.
export function webStorySecurityPolicy(policy, pathname = "") {
  if (!/^\/web-stories\/[^/]+\/(?:index\.html)?$/.test(pathname)) return policy;
  return policy.split(";").map((directive) => {
    const value = directive.trim();
    return /^(?:script-src|style-src|connect-src)\s/.test(value)
      ? `${value} https://cdn.ampproject.org`
      : value;
  }).join("; ");
}
