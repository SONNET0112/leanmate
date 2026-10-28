import { useEffect } from "react";
import { Leaf } from "lucide-react";
import { CalorieSummary } from "../components/dashboard/CalorieSummary";
import { DailyTasks } from "../components/dashboard/DailyTasks";
import { MealSummary } from "../components/dashboard/MealSummary";
import { MotivationCard } from "../components/dashboard/MotivationCard";
import { NutritionTargets } from "../components/dashboard/NutritionTargets";
import { RecipeSuggestions } from "../components/dashboard/RecipeSuggestions";
import { WeightSummary } from "../components/dashboard/WeightSummary";
import { AiMealPanel } from "../components/diet/AiMealPanel";
import { DateSwitcher } from "../components/common/DateSwitcher";
import { useActiveGoal, useStore } from "../app/store";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { defaultMealFor, getDailySummary, recordsForDate } from "../modules/records/records.service";
import { motivationFor } from "../modules/motivation/motivation.service";
import { tasksForDate } from "../modules/tasks/tasks.service";
import { weightChange } from "../modules/tracking/tracking.service";
import { formatDateCN, toISODate, weekdayCN } from "../utils/date";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function streakDays(dates: Set<string>, date: string): number {
  let count = 0;
  const cursor = new Date(`${date}T00:00:00`);
  while (dates.has(toISODate(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

const AI_CHIPS = [
  { label: "记早餐", text: "早餐：" },
  { label: "记午餐", text: "午餐：" },
  { label: "记晚餐", text: "晚餐：" },
  { label: "加餐：一杯牛奶", text: "加餐：一杯牛奶" },
];

export function DashboardPage() {
  const { data, today, toggleTask, ensureTasks, addRawRecord, addTemplateTo } = useStore();
  const { date, setDate } = useSelectedDate();
  const goal = useActiveGoal(date);

  useEffect(() => {
    ensureTasks(date);
  }, [date, ensureTasks]);

  if (!data) return null;

  const records = data.foodRecords;
  const totals = getDailySummary(records, date);
  const dayRecords = recordsForDate(records, date);
  const tasks = tasksForDate(data.dailyTasks, date);
  const { deltaKg } = weightChange(data.weightRecords.filter((w) => w.date <= date));
  const streak = streakDays(new Set(records.map((r) => r.date)), date);
  const isToday = date === today;

  const motivation = motivationFor(
    {
      hasRecordsToday: dayRecords.length > 0,
      recordCount: dayRecords.length,
      streakDays: streak,
      calorieTarget: goal?.dailyCaloriesKcal ?? 0,
      caloriesConsumed: totals.caloriesKcal,
      proteinTarget: goal?.proteinG ?? 0,
      proteinConsumed: totals.proteinG,
      weightDeltaKg: deltaKg,
    },
    date,
  );

  return (
    <div className="space-y-3.5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.18em] text-primary">LEANMATE · 今日</p>
          <h1 className="mt-1 text-[23px] font-semibold leading-tight tracking-tight sm:text-[26px]">
            {isToday ? `${greeting()}～` : `${formatDateCN(date)} ${weekdayCN(date)}`}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted">
            今天的每一口，都是向更好的自己靠近 🍀 · 连续记录 {streak} 天
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateSwitcher date={date} today={today} onChange={setDate} />
          <span className="hidden size-9 place-items-center rounded-full bg-primary-soft text-primary-deep sm:grid" aria-hidden>
            <Leaf size={16} strokeWidth={1.9} />
          </span>
        </div>
      </header>

      <AiMealPanel
        hero
        chips={AI_CHIPS}
        date={date}
        defaultMeal={defaultMealFor(date, today)}
        onSave={(items) => {
          for (const item of items) {
            addRawRecord({
              date,
              mealType: item.mealType,
              foodId: item.foodId ?? `ai:${item.name}`,
              foodName: item.name,
              amountG: item.amountG,
              foodState: item.foodState,
              nutrition: item.nutrition,
            });
          }
        }}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        {goal ? (
          <div className="xl:col-span-5">
            <CalorieSummary totals={totals} goal={goal} />
          </div>
        ) : (
          <section className="card flex h-full flex-col justify-center p-5 md:col-span-2 xl:col-span-5">
            <h2 className="text-[15px] font-medium">还没有营养目标</h2>
            <p className="mt-1 text-[13px] text-muted">先在「计划」页生成一份目标，首页才能显示剩余额度。</p>
          </section>
        )}
        <div className="xl:col-span-3">
          <WeightSummary
            records={data.weightRecords.filter((w) => w.date <= date)}
            date={date}
            today={today}
            targetWeightKg={data.profile?.targetWeightKg}
          />
        </div>
        <div className="xl:col-span-4">
          <MealSummary records={records} date={date} />
        </div>

        {goal ? (
          <div className="md:col-span-2 xl:col-span-5">
            <NutritionTargets goal={goal} />
          </div>
        ) : null}
        <div className="xl:col-span-3">
          <DailyTasks tasks={tasks} onToggle={toggleTask} />
        </div>
        <div className="xl:col-span-4">
          <RecipeSuggestions templates={data.mealTemplates} onAdd={(template) => addTemplateTo(date, template)} />
        </div>
        <div className="md:col-span-2 xl:col-span-12">
          <MotivationCard text={motivation} />
        </div>
      </div>
    </div>
  );
}
