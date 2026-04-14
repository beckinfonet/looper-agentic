/** True if `tz` is accepted by the runtime as an IANA time zone name. */
export function isValidIanaTimeZone(tz: string): boolean {
  const t = tz.trim();
  if (!t || t.length > 120) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return true;
  } catch {
    return false;
  }
}
