import type { NutritionGoal } from "../../modules/plan/plan.types";

const ITEMS = [
  { key: "dailyCaloriesKcal", label: "热量", unit: "kcal", color: "#6d8f74", soft: "#eaf2e4" },
  { key: "proteinG", label: "蛋白质", unit: "g", color: "#6f9ec4", soft: "#e9f1f8" },
  { key: "carbohydratesG", label: "碳水", unit: "g", color: "#dda86d", soft: "#faf0e2" },
  { key: "fatG", label: "脂肪", unit: "g", color: "#a495c9", soft: "#f1edf9" },
] as const;

export function NutritionTargets({ goal }: { goal: NutritionGoal }) {
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">营养目标</h2>
        <span className="text-[11px] text-muted">依据 {goal.basisWeightKg} kg · {goal.effectiveFrom}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ITEMS.map(({ key, label, unit, color, soft }) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <span
              className="grid size-[68px] place-items-center rounded-full text-center"
              style={{ background: soft, boxShadow: `inset 0 0 0 5px ${color}22` }}
            >
              <span className="text-[14px] font-semibold leading-none" style={{ color }}>
                {goal[key]}
              </span>
              <span className="mt-0.5 text-[9.5px] text-muted">{unit}</span>
            </span>
            <span className="text-[12px]">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">* 以上为参考值，具体需根据个人情况调整。</p>
    </section>
  );
}
