export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Pull every valid-looking email address out of a CSV / text blob (deduped, lower-cased). */
export function extractEmails(text: string): string[] {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(found.map(e => e.toLowerCase()))];
}

/** value for <input type="datetime-local"> */
export const toLocalInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
