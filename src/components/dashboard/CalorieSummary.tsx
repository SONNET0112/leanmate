import type { NutritionTotals } from "../../modules/nutrition/nutrition.types";
import type { NutritionGoal } from "../../modules/plan/plan.types";
import { grams, percent } from "../../utils/format";

const MACROS = [
  { key: "proteinG", label: "蛋白质", color: "var(--color-protein)" },
  { key: "carbohydratesG", label: "碳水", color: "var(--color-carbs)" },
  { key: "fatG", label: "脂肪", color: "var(--color-fat)" },
] as const;

const R = 45;
const CIRC = 2 * Math.PI * R;

export function CalorieSummary({ totals, goal }: { totals: NutritionTotals; goal: NutritionGoal }) {
  const consumed = Math.round(totals.caloriesKcal);
  const target = goal.dailyCaloriesKcal;
  const remaining = Math.round(target - consumed);
  const over = remaining < 0;
  // 进度统一表示「已摄入占目标的比例」，与宏量素保持一致
  const pct = percent(consumed, target);

  return (
    <section className="card flex h-full flex-col p-5">
      <h2 className="text-[13px] font-medium text-muted">今日数据</h2>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-[96px] shrink-0">
          <svg viewBox="0 0 108 108" className="size-full -rotate-90" aria-hidden>
            <circle cx="54" cy="54" r={R} fill="none" stroke="#eef1e8" strokeWidth="9" />
            <circle
              cx="54"
              cy="54"
              r={R}
              fill="none"
              stroke={over ? "var(--color-danger)" : "var(--color-primary)"}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
              className="transition-[stroke-dasharray]"
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-[21px] font-semibold leading-none tracking-tight">{consumed}</span>
            <span className="mt-1 text-[10px] text-muted">kcal</span>
          </div>
        </div>

        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] items-baseline gap-y-1.5 gap-x-2 text-[12px]">
          <dt className="text-muted">已摄入</dt>
          <dd className="justify-self-end whitespace-nowrap tabular-nums">{consumed} kcal</dd>
          <dt className="text-muted">目标</dt>
          <dd className="justify-self-end whitespace-nowrap tabular-nums">{target} kcal</dd>
          <dt className={over ? "text-danger" : "text-muted"}>今日剩余</dt>
          <dd
            className={`justify-self-end whitespace-nowrap text-[15px] font-medium tabular-nums ${
              over ? "text-danger" : "text-primary-deep"
            }`}
          >
            {Math.abs(remaining)} kcal
          </dd>
        </dl>
      </div>

      <ul className="mt-4 space-y-2.5 border-t border-line/70 pt-3.5">
        {MACROS.map(({ key, label, color }) => {
          const value = totals[key];
          const macroTarget = goal[key];
          const isOver = macroTarget > 0 && value > macroTarget;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <i className="size-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">
                  <span className={isOver ? "text-danger" : "text-ink"}>{grams(Math.round(value * 10) / 10)}</span>
                  {macroTarget ? ` / ${macroTarget} g` : " g"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1e8]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${macroTarget ? percent(value, macroTarget) : 0}%`,
                    background: isOver ? "var(--color-danger)" : color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
