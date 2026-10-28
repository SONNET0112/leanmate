import { Cookie, Moon, Sun, Sunrise } from "lucide-react";
import { Link } from "react-router-dom";
import { MEAL_LABEL, MEAL_ORDER, type MealType } from "../../modules/records/records.types";
import { mealTotals } from "../../modules/records/records.service";
import type { FoodRecord } from "../../modules/records/records.types";

const ICONS: Record<MealType, typeof Sunrise> = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Cookie };

export function MealSummary({ records, date }: { records: FoodRecord[]; date: string }) {
  const meals = mealTotals(records, date);
  const ordered = MEAL_ORDER.map((type) => meals.find((m) => m.mealType === type)).filter(
    (m): m is (typeof meals)[number] => Boolean(m),
  );

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">今日饮食</h2>
        <Link to="/diet" className="text-[12px] text-primary hover:underline">
          去记录
        </Link>
      </div>

      <ul className="mt-3 flex flex-1 flex-col justify-between gap-1.5">
        {ordered.map(({ mealType, totals, count }) => {
          const Icon = ICONS[mealType];
          return (
            <li key={mealType}>
              <Link to="/diet" className="flex items-center gap-2.5 rounded-2xl px-1.5 py-1.5 hover:bg-[#fafbf6]">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft/70 text-primary-deep">
                  <Icon size={15} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px]">{MEAL_LABEL[mealType]}</span>
                  <span className="block text-[11px] text-muted">{count ? `${count} 项` : "还没记录"}</span>
                </span>
                <span className={`shrink-0 text-[12.5px] ${count ? "" : "text-muted"}`}>
                  {Math.round(totals.caloriesKcal)} kcal
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
