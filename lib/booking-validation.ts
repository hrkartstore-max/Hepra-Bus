/**
 * Shared validation primitives for upcoming server-side booking APIs.
 * Keep this module free of browser APIs and database access.
 */

export type ValidationIssue = { field: string; message: string };
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export type BookingLookupInput = { reference: string; phone: string };
export type CreateDemoBookingInput = {
  tripId: string;
  passengerName: string;
  phone: string;
  seatLabels: string[];
};

const cleanString = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export function validateBookingLookup(input: unknown): ValidationResult<BookingLookupInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "A JSON object is required." }] };
  }
  const body = input as Record<string, unknown>;
  const reference = cleanString(body.reference, 40).toUpperCase();
  const phone = cleanString(body.phone, 20).replace(/[^0-9]/g, "");
  const issues: ValidationIssue[] = [];
  if (!/^HB-[A-Z0-9-]{6,32}$/.test(reference)) {
    issues.push({ field: "reference", message: "Enter a valid booking reference." });
  }
  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    issues.push({ field: "phone", message: "Enter a valid 10-digit Indian mobile number." });
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: { reference, phone } };
}

export function validateCreateBooking(input: unknown): ValidationResult<CreateDemoBookingInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "A JSON object is required." }] };
  }
  const body = input as Record<string, unknown>;
  const tripId = cleanString(body.tripId, 80);
  const passengerName = cleanString(body.passengerName, 80);
  const phone = cleanString(body.phone, 20).replace(/[^0-9]/g, "");
  const rawSeats = Array.isArray(body.seatLabels) ? body.seatLabels : [];
  const seatLabels = rawSeats
    .filter((seat): seat is string => typeof seat === "string")
    .map((seat) => seat.trim().toUpperCase())
    .filter((seat) => /^[A-Z][0-9]{1,2}$/.test(seat))
    .slice(0, 6);
  const issues: ValidationIssue[] = [];

  if (!tripId || !/^[A-Za-z0-9_-]{1,80}$/.test(tripId)) {
    issues.push({ field: "tripId", message: "A valid trip identifier is required." });
  }
  if (passengerName.length < 2 || !/^[\p{L}\p{M} .'-]+$/u.test(passengerName)) {
    issues.push({ field: "passengerName", message: "Enter a valid passenger name." });
  }
  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    issues.push({ field: "phone", message: "Enter a valid 10-digit Indian mobile number." });
  }
  if (!Array.isArray(body.seatLabels) || seatLabels.length < 1 || seatLabels.length !== rawSeats.length) {
    issues.push({ field: "seatLabels", message: "Choose between 1 and 6 valid, unique seats." });
  }
  if (new Set(seatLabels).size !== seatLabels.length) {
    issues.push({ field: "seatLabels", message: "Duplicate seats are not allowed." });
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: { tripId, passengerName, phone, seatLabels } };
}
