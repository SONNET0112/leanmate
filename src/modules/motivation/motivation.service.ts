import quotesJson from "../../data/motivational-quotes.json";
import type { MotivationCategory, MotivationContext } from "./motivation.types";

const quotes = quotesJson.categories as Record<MotivationCategory, string[]>;

export function pickCategory(ctx: MotivationContext): MotivationCategory {
  if (!ctx.hasRecordsToday && ctx.recordCount === 0) return "noPlan";
  if (ctx.recordCount === 1) return "firstRecord";
  if (ctx.calorieTarget > 0 && ctx.caloriesConsumed > ctx.calorieTarget * 1.05) return "overTarget";
  if (ctx.proteinTarget > 0 && ctx.proteinConsumed < ctx.proteinTarget * 0.6) return "proteinGap";
  if (ctx.streakDays >= 3) return "streak";
  if (ctx.weightDeltaKg !== null && ctx.weightDeltaKg !== 0) return "weightTrend";
  return "onTrack";
}

/** 同一天用日期做种子，保证刷新后文案不跳变。 */
export function motivationFor(ctx: MotivationContext, seedDate: string): string {
  const category = pickCategory(ctx);
  const list = quotes[category] ?? quotes.onTrack;
  if (!list.length) return "";
  const seed = [...seedDate].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return list[seed % list.length];
}
