/** Hand-rolled date/time formatting — no library, local timezone. */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2 Aug 2026" */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2 Aug, 9:40 pm" */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const suffix = d.getHours() >= 12 ? "pm" : "am";
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hours}:${minutes} ${suffix}`;
}
