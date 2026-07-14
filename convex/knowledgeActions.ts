export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export type LinkSourceKind = "website" | "public_media";

const supportedDocumentExtensions = new Set(["pdf", "doc", "docx", "ppt", "pptx"]);
const supportedSpreadsheetExtensions = new Set(["csv", "xls", "xlsx"]);
const supportedAudioExtensions = new Set(["mp3", "m4a", "wav", "ogg"]);
const supportedVideoExtensions = new Set(["mp4", "mov", "webm"]);

export function normalizePublicKnowledgeLink(kind: LinkSourceKind, rawUrl: string) {
  const trimmed = rawUrl.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Enter a valid public URL");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname) ||
    hostname === "[::1]"
  ) {
    throw new Error("Enter a valid public URL");
  }

  parsed.username = "";
  parsed.password = "";
  return { kind, url: parsed.href };
}

export function classifyKnowledgeUpload(filename: string, contentType: string) {
  const extension = filename.trim().toLowerCase().split(".").pop() ?? "";
  const normalizedType = contentType.trim().toLowerCase();
  if (supportedDocumentExtensions.has(extension)) return "document" as const;
  if (supportedSpreadsheetExtensions.has(extension)) return "spreadsheet" as const;
  if (supportedAudioExtensions.has(extension) || normalizedType.startsWith("audio/")) return "audio" as const;
  if (supportedVideoExtensions.has(extension) || normalizedType.startsWith("video/")) return "video" as const;
  throw new Error("Choose a supported document, spreadsheet, audio, or video file");
}

export function requireSourceStatusTransition(
  from: SourceStatus,
  to: SourceStatus,
  details: { summary?: string; error?: string } = {},
) {
  const allowed =
    (from === "queued" && to === "processing") ||
    (from === "processing" && (to === "ready" || to === "failed")) ||
    (from === "failed" && to === "queued");
  if (!allowed) throw new Error(`Source cannot move from ${from} to ${to}`);
  if (to === "ready" && !details.summary?.trim()) {
    throw new Error("A source summary is required when processing completes");
  }
  if (to === "failed" && !details.error?.trim()) {
    throw new Error("A user-readable error is required when processing fails");
  }
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}
