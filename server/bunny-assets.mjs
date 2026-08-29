import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const CONTENT_TYPES = new Map([
  [".asc", "application/pgp-signature"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
  [".xsl", "text/xsl; charset=utf-8"],
]);

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function safeLocalPath(rootDirectory, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) return null;

  const resolved = path.resolve(rootDirectory, `.${decoded}`);
  if (resolved !== rootDirectory && !resolved.startsWith(`${rootDirectory}${path.sep}`)) {
    return null;
  }
  return resolved;
}

async function fileInfo(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match) return null;

  let start = match[1] ? Number.parseInt(match[1], 10) : null;
  let end = match[2] ? Number.parseInt(match[2], 10) : null;

  if (start === null && end !== null) {
    start = Math.max(size - end, 0);
    end = size - 1;
  } else {
    start ??= 0;
    end ??= size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

function fileResponse(request, filePath, info) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES.get(extension) || "application/octet-stream";
  const etag = `W/\"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}\"`;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
  });

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const rangeHeader = request.headers.get("range");
  const requestedRange = rangeHeader ? parseRange(rangeHeader, info.size) : null;
  if (rangeHeader && !requestedRange) {
    headers.set("Content-Range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = requestedRange?.start ?? 0;
  const end = requestedRange?.end ?? Math.max(info.size - 1, 0);
  const length = requestedRange ? end - start + 1 : info.size;
  headers.set("Content-Length", String(length));

  if (extension === ".html") {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    headers.set("Cache-Control", "public, max-age=86400");
  }

  if (requestedRange) {
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }

  const body = request.method === "HEAD" || info.size === 0
    ? null
    : Readable.toWeb(createReadStream(filePath, requestedRange ? { start, end } : undefined));

  return new Response(body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}

export function createAssetBinding(directory) {
  const rootDirectory = path.resolve(directory);

  return {
    async fetch(request) {
      if (request.method !== "GET" && request.method !== "HEAD") return notFound();

      const url = new URL(request.url);
      let filePath = safeLocalPath(rootDirectory, url.pathname);
      if (!filePath) return notFound();

      let info = await fileInfo(filePath);
      if (info?.isDirectory()) {
        if (!url.pathname.endsWith("/")) {
          url.pathname = `${url.pathname}/`;
          return Response.redirect(url, 308);
        }
        filePath = path.join(filePath, "index.html");
        info = await fileInfo(filePath);
      }

      if (!info?.isFile()) return notFound();
      return fileResponse(request, filePath, info);
    },
  };
}
