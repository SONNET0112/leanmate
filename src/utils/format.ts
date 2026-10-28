export function kcal(n: number): string {
  return `${Math.round(n)}`;
}

export function grams(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function percent(value: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

export function kg(n: number): string {
  return n.toFixed(1);
}
