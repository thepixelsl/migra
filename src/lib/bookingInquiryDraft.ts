import { weddingPackages } from "../data/weddingPackages";

export const BOOKING_INQUIRY_DRAFT_STORAGE_KEY = "artbild_booking_inquiry_draft_v1";
export const BOOKING_INQUIRY_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
export const BOOKING_INQUIRY_SOURCE_PATH = "/fuer-agenten/";

export const bookingInquiryRequestTypes = [
  "hochzeit",
  "standesamtliche-trauung",
  "portraitshooting",
] as const;

export const bookingInquiryPackageOptions = weddingPackages.map(({ id, name }) => ({
  id,
  name,
}));

export type BookingInquiryRequestType = (typeof bookingInquiryRequestTypes)[number];

export type BookingInquiryDraftInput = {
  requestType: BookingInquiryRequestType;
  date: string;
  location: string;
  packageId?: string;
};

export type BookingInquiryDraft = BookingInquiryDraftInput & {
  version: 1;
  createdAt: number;
};

type DateBounds = {
  minDate: string;
  maxDate: string;
};

export type BookingInquiryDraftResult =
  | { ok: true; draft: BookingInquiryDraft }
  | { ok: false; error: string; message: string };

const requestTypeSet = new Set<string>(bookingInquiryRequestTypes);
const packageNameById = new Map(
  bookingInquiryPackageOptions.map(({ id, name }) => [id, name]),
);
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const unsafeTextPattern = /[<>{}\[\]`]/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isStrictIsoDate = (value: string) => {
  const match = isoDatePattern.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDay;
};

const validateDraftInput = (
  value: unknown,
  bounds: DateBounds,
): { ok: true; input: BookingInquiryDraftInput } | Exclude<BookingInquiryDraftResult, { ok: true }> => {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: "invalid_input",
      message: "Bitte gib Auftragsart, Wunschdatum und Ort an.",
    };
  }

  const requestType = value.requestType;
  if (typeof requestType !== "string" || !requestTypeSet.has(requestType)) {
    return {
      ok: false,
      error: "invalid_request_type",
      message: "Bitte wähle eine unterstützte Art des Fotoauftrags.",
    };
  }

  const date = typeof value.date === "string" ? value.date.trim() : "";
  if (!isStrictIsoDate(date) || date < bounds.minDate || date > bounds.maxDate) {
    return {
      ok: false,
      error: "invalid_date",
      message: `Bitte gib ein Wunschdatum zwischen ${bounds.minDate} und ${bounds.maxDate} an.`,
    };
  }

  const location = typeof value.location === "string"
    ? value.location.replace(/\s+/g, " ").trim()
    : "";
  if (
    location.length < 2
    || location.length > 160
    || unsafeTextPattern.test(location)
  ) {
    return {
      ok: false,
      error: "invalid_location",
      message: "Bitte gib einen gültigen Ort oder eine Location an.",
    };
  }

  const packageId = value.packageId;
  if (
    packageId !== undefined
    && (typeof packageId !== "string" || !packageNameById.has(packageId))
  ) {
    return {
      ok: false,
      error: "invalid_package",
      message: "Bitte wähle eines der veröffentlichten Fotopakete.",
    };
  }

  return {
    ok: true,
    input: {
      requestType: requestType as BookingInquiryRequestType,
      date,
      location,
      ...(typeof packageId === "string" ? { packageId } : {}),
    },
  };
};

export const createBookingInquiryDraft = (
  value: unknown,
  bounds: DateBounds,
  now = Date.now(),
): BookingInquiryDraftResult => {
  const validation = validateDraftInput(value, bounds);
  if (!validation.ok) return validation;

  return {
    ok: true,
    draft: {
      version: 1,
      createdAt: now,
      ...validation.input,
    },
  };
};

export const parseBookingInquiryDraft = (
  rawValue: string | null,
  bounds: DateBounds,
  now = Date.now(),
): BookingInquiryDraft | null => {
  if (!rawValue) return null;

  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(value) || value.version !== 1 || typeof value.createdAt !== "number") {
    return null;
  }
  if (
    !Number.isFinite(value.createdAt)
    || value.createdAt > now + 60_000
    || now - value.createdAt > BOOKING_INQUIRY_DRAFT_MAX_AGE_MS
  ) {
    return null;
  }

  const validation = validateDraftInput(value, bounds);
  if (!validation.ok) return null;

  return {
    version: 1,
    createdAt: value.createdAt,
    ...validation.input,
  };
};

export const bookingInquiryPackageName = (packageId?: string) =>
  packageId ? packageNameById.get(packageId) ?? null : null;
