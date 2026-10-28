import { useState } from "react";
import { Info, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { TemplateEditor } from "../components/plan/TemplateEditor";
import { useActiveGoal, useStore } from "../app/store";
import { dietRules } from "../modules/plan/plan.service";
import { newTemplate } from "../modules/plan/templates";
import { grams } from "../utils/format";

export function PlanPage() {
  const { data, today, recomputeGoal, saveTemplate, deleteTemplate, addTemplateTo } = useStore();
  const goal = useActiveGoal();
  const [notice, setNotice] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  if (!data) return null;

  return (
    <div className="space-y-3">
      <PageHeader title="计划" subtitle="目标、每条计算依据与餐食模板" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          {goal ? (
            <section className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[13px] font-medium text-muted">每日营养目标</h2>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[34px] font-semibold leading-none">{goal.dailyCaloriesKcal}</span>
                    <span className="text-[13px] text-muted">kcal</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const computed = recomputeGoal();
                    setNotice(computed ? `已生成新目标：${computed.goal.dailyCaloriesKcal} kcal（规则 ${dietRules.version}），旧目标保留为历史版本。` : "缺少资料，无法计算");
                  }}
                  className="btn btn-ghost text-[13px]"
                >
                  重新计算
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "蛋白质", value: goal.proteinG, color: "var(--color-protein)" },
                  { label: "碳水", value: goal.carbohydratesG, color: "var(--color-carbs)" },
                  { label: "脂肪", value: goal.fatG, color: "var(--color-fat)" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-line px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <i className="size-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
                      {m.label}
                    </div>
                    <div className="mt-1 text-[17px]">
                      {m.value}
                      <span className="ml-0.5 text-[11px] text-muted">g</span>
                    </div>
                  </div>
                ))}
              </div>

              <dl className="mt-4 space-y-1.5 text-[12px] text-muted">
                <div className="flex justify-between">
                  <dt>依据体重</dt>
                  <dd>{grams(goal.basisWeightKg)} kg</dd>
                </div>
                <div className="flex justify-between">
                  <dt>生效日期</dt>
                  <dd>{goal.effectiveFrom}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>规则版本</dt>
                  <dd>{goal.calculationRuleVersion}</dd>
                </div>
              </dl>

              <button type="button" onClick={() => setShowRules((v) => !v)} className="mt-4 flex items-center gap-1.5 text-[12px] text-primary hover:underline">
                <Info size={13} /> {showRules ? "收起计算依据" : "查看计算依据与数据来源"}
              </button>

              {showRules ? (
                <div className="mt-2 space-y-2 rounded-xl bg-[#fafbf8] p-3 text-[12px] leading-relaxed text-muted">
                  <p>
                    <strong className="text-ink">基础代谢：</strong>
                    {dietRules.bmr.method}（{dietRules.bmr.source}）
                  </p>
                  <p>
                    <strong className="text-ink">活动系数：</strong>
                    {dietRules.activityBands.map((b) => `${b.label} ×${b.factor}`).join("；")}
                  </p>
                  <p>
                    <strong className="text-ink">缺口：</strong>每日 {dietRules.deficitKcal} kcal，{dietRules.deficitNote}
                  </p>
                  <p>
                    <strong className="text-ink">蛋白质：</strong>
                    {dietRules.proteinGPerKg} g/kg，{dietRules.proteinSource}
                  </p>
                  <p>
                    <strong className="text-ink">脂肪：</strong>至少 {dietRules.fatGPerKg} g/kg 且不低于热量的 {dietRules.fatMinPercentOfCalories}%，碳水为剩余热量。
                  </p>
                  <p className="rounded-lg border border-[#f0e6cf] bg-[#fdf8ec] p-2 text-[#7a6231]">
                    参考视频中的运动时长-宏量营养素系数尚未核实原始出处，本版本未采用（状态：{dietRules.videoDerivedCoefficients.status}）。
                  </p>
                  <p>{dietRules.statusNote}</p>
                  <p>以上均为估算值，不构成医疗或营养处方。</p>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="card p-5">
              <h2 className="text-[15px] font-medium">还没有营养目标</h2>
              <p className="mt-1 text-[13px] text-muted">需要先保存个人资料，然后点击生成目标。</p>
              <Link to="/profile" className="btn btn-primary mt-3 w-full">
                去完善资料
              </Link>
            </section>
          )}

          {data.nutritionGoals.length > 1 ? (
            <section className="card p-5">
              <h2 className="text-[13px] font-medium text-muted">历史目标</h2>
              <ul className="mt-2 space-y-1 text-[12px] text-muted">
                {[...data.nutritionGoals]
                  .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
                  .map((g) => (
                    <li key={g.id} className="flex justify-between border-b border-line/60 py-1.5 last:border-0">
                      <span>{g.effectiveFrom}</span>
                      <span>
                        {g.dailyCaloriesKcal} kcal · 依据 {grams(g.basisWeightKg)} kg
                        {g.id === goal?.id ? " · 生效中" : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-medium text-muted">餐食模板</h2>
            <button
              type="button"
              onClick={() => {
                saveTemplate(newTemplate());
                setNotice("已新建一个空模板，展开「编辑」添加食物。");
              }}
              className="btn btn-ghost text-[12px]"
            >
              <Plus size={13} /> 新建模板
            </button>
          </div>

          {notice ? (
            <p className="rounded-xl border border-primary-soft bg-primary-soft/60 px-4 py-2.5 text-[13px] text-[#3c4d41]" role="status">
              {notice}
            </p>
          ) : null}

          {data.mealTemplates.map((template) => (
            <TemplateEditor
              key={template.id}
              template={template}
              today={today}
              onSave={saveTemplate}
              onDelete={() => deleteTemplate(template.id)}
              onAddTo={(date, mealType) => {
                const result = addTemplateTo(date, template, mealType);
                setNotice(
                  result.added
                    ? `已把「${template.name}」的 ${result.added} 项写入 ${date}${result.missing ? `，${result.missing} 项食物缺失未写入` : ""}`
                    : "模板中没有可写入的食物",
                );
              }}
            />
          ))}
          {!data.mealTemplates.length ? (
            <p className="card px-4 py-6 text-center text-[13px] text-muted">还没有模板，点「新建模板」从食物库拼一份。</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
