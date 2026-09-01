import { load } from "cheerio";

const ALLOWED_TAGS = new Set([
  "a",
  "address",
  "b",
  "blockquote",
  "br",
  "cite",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "small",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const DROP_WITH_CONTENTS = new Set([
  "applet",
  "audio",
  "base",
  "button",
  "canvas",
  "embed",
  "figure",
  "form",
  "frame",
  "frameset",
  "header",
  "iframe",
  "img",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "nav",
  "object",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "track",
  "video",
  "footer",
  "i",
]);

const INTERNAL_HOSTS = new Set([
  "artbild-fotografie.de",
  "www.artbild-fotografie.de",
  "artbild-fotografie.ch",
  "www.artbild-fotografie.ch",
]);

const MIGRATED_INTERNAL_LINK_REWRITES = new Map([
  ["/gallery-category/mallorca/", "/gallery/mallorca/"],
  ["/gallery-category/teneriffa/", "/gallery/teneriffa/"],
]);

function normalizedHref(value = "") {
  const href = String(value).trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return "";
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) {
    return href;
  }
  if (/^(?:mailto|tel):/i.test(href)) return href;

  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    return "";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  if (INTERNAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return parsed.href;
}

function isExternalWebLink(href) {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function removeComments($, node = $.root()) {
  for (const child of node.contents().toArray()) {
    if (child.type === "comment") {
      $(child).remove();
    } else if (child.type === "tag") {
      removeComments($, $(child));
    }
  }
}

function sanitizeAllowedAttributes($, element) {
  const tag = element.name.toLowerCase();
  const current = { ...element.attribs };
  for (const name of Object.keys(current)) $(element).removeAttr(name);

  if (tag === "a") {
    const href = normalizedHref(current.href);
    if (!href) return;
    $(element).attr("href", href);
    if (isExternalWebLink(href)) {
      $(element).attr("rel", "noopener noreferrer");
      $(element).attr("target", "_blank");
    }
    return;
  }

  if (["h1", "h2", "h3", "h4", "h5", "h6", "p"].includes(tag)) {
    const direction = String(current.dir || "").toLowerCase();
    if (["auto", "ltr", "rtl"].includes(direction)) $(element).attr("dir", direction);
  }

  if (["td", "th"].includes(tag)) {
    for (const name of ["colspan", "rowspan"]) {
      const value = String(current[name] || "");
      if (/^[1-9]\d?$/.test(value)) $(element).attr(name, value);
    }
    if (tag === "th" && ["col", "colgroup", "row", "rowgroup"].includes(current.scope)) {
      $(element).attr("scope", current.scope);
    }
  }
}

export function sanitizeMigratedHtml(html = "", assetMap = new Map()) {
  let content = String(html);
  for (const [original, local] of assetMap.entries()) {
    content = content.replaceAll(original, local);
    content = content.replaceAll(original.replace(/&/g, "&amp;"), local);
  }

  const $ = load(content, {}, false);
  removeComments($);

  for (const element of $("*").toArray()) {
    const tag = element.name.toLowerCase();
    if (DROP_WITH_CONTENTS.has(tag)) {
      $(element).remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      $(element).replaceWith($(element).contents());
      continue;
    }
    sanitizeAllowedAttributes($, element);
  }

  $("a").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href") || "";
    const rewrittenHref = MIGRATED_INTERNAL_LINK_REWRITES.get(href);

    if (rewrittenHref) {
      anchor.attr("href", rewrittenHref);
      return;
    }

    if (/^\/(?:tag|category)\//.test(href) || !anchor.text().trim()) {
      anchor.replaceWith(anchor.contents());
    }
  });

  $("p").each((_, element) => {
    if (!$(element).text().trim() && $(element).children().length === 0) {
      $(element).remove();
    }
  });

  return ($.root().html() || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractMigratedMainHtml(html = "") {
  const $ = load(String(html));
  for (const selector of [".entry-content", "main", "article"]) {
    const candidate = $(selector).first();
    if (candidate.length) return candidate.html() || "";
  }
  return "";
}
