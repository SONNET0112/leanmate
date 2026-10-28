const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDateCN(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function weekdayCN(date: string): string {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[new Date(`${date}T00:00:00`).getDay()];
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}
