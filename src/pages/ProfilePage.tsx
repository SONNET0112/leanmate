import { useEffect, useRef, useState } from "react";
import { Download, Pencil, Trash2, Upload } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/layout/PageHeader";
import { AccountCard } from "../components/auth/AccountCard";
import { AiSettingsCard } from "../components/settings/AiSettingsCard";
import { useActiveGoal, useStore } from "../app/store";
import { PROFILE_LIMITS, validateProfileInput } from "../modules/plan/plan.service";
import type { Sex, UserProfile } from "../modules/plan/plan.types";
import { sevenDayAverage, weightForDate, weightSeries } from "../modules/tracking/tracking.service";
import { parseImport } from "../storage/storage.migration";
import { kg } from "../utils/format";

const SEX_LABEL: Record<Sex, string> = { male: "男", female: "女", other: "其他" };

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value)} className="field" />
        {suffix ? <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function ProfilePage() {
  const { data, today, updateProfile, saveWeight, editWeight, removeWeight, recomputeGoal, replaceAll, reset } = useStore();
  const goal = useActiveGoal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profile = data?.profile;

  const [form, setForm] = useState(() => ({
    sex: (profile?.sex ?? "other") as Sex,
    age: String(profile?.age ?? ""),
    heightCm: String(profile?.heightCm ?? ""),
    currentWeightKg: String(profile?.currentWeightKg ?? ""),
    targetWeightKg: String(profile?.targetWeightKg ?? ""),
    weeklyExerciseHours: String(profile?.weeklyExerciseHours ?? ""),
    exerciseType: profile?.exerciseType ?? "",
  }));

  const [weightDate, setWeightDate] = useState(today);
  const [weightInput, setWeightInput] = useState("");
  const [weightNote, setWeightNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 选日期即加载当天记录：有记录就进入编辑模式，没有就是新增
  useEffect(() => {
    const record = weightForDate(data?.weightRecords ?? [], weightDate);
    setEditingId(record?.id ?? null);
    setWeightInput(record ? String(record.weightKg) : "");
    setWeightNote(record?.note ?? "");
  }, [weightDate, data?.weightRecords]);

  if (!data || !profile) return null;

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submitProfile = () => {
    setError(null);
    setMessage(null);
    const parsed = {
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      currentWeightKg: Number(form.currentWeightKg),
      targetWeightKg: Number(form.targetWeightKg),
      weeklyExerciseHours: Number(form.weeklyExerciseHours),
    };
    const problem = validateProfileInput(parsed);
    if (problem) {
      setError(problem);
      return;
    }
    const next: UserProfile = { ...profile, sex: form.sex, exerciseType: form.exerciseType.trim() || undefined, ...parsed };
    updateProfile(next);
    setMessage("资料已保存。营养目标不会自动变化，需要时在计划页或下方重新计算。");
  };

  const submitWeight = () => {
    setError(null);
    setMessage(null);
    const value = Number(weightInput);
    try {
      if (editingId) {
        editWeight(editingId, { date: weightDate, weightKg: value, note: weightNote.trim() || undefined });
        setMessage(`已更新 ${weightDate} 的体重记录，营养目标保持不变。`);
      } else {
        saveWeight({ date: weightDate, weightKg: value, note: weightNote.trim() || undefined });
        setMessage(`${weightDate} 的体重已记录，营养目标保持不变。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leanmate-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    setError(null);
    setMessage(null);
    try {
      const parsed = parseImport(await file.text());
      if (
        !confirm(
          `导入会用文件里的 ${parsed.foodRecords.length} 条饮食记录、${parsed.weightRecords.length} 条体重记录、${parsed.nutritionGoals.length} 个目标版本\n` +
            `覆盖本机现有数据（${data.foodRecords.length} 条饮食 / ${data.weightRecords.length} 条体重），不会合并。\n\n确定继续？`,
        )
      ) {
        return;
      }
      replaceAll(parsed);
      setMessage("导入成功，页面数据已更新。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，现有数据未改动");
    }
  };

  const series = weightSeries(data.weightRecords, 30, today);
  const todayWeight = weightForDate(data.weightRecords, today);
  const average = sevenDayAverage(data.weightRecords, today);
  const history = [...data.weightRecords].sort((a, b) => b.date.localeCompare(a.date));
  const toTarget = profile.currentWeightKg - profile.targetWeightKg;

  return (
    <div className="space-y-3">
      <PageHeader title="我的" subtitle="资料、体重与本地数据" />

      {error ? (
        <p className="rounded-xl border border-[#eed6d3] bg-[#fdf4f3] px-4 py-2.5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-primary-soft bg-primary-soft/60 px-4 py-2.5 text-[13px] text-[#3c4d41]" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <section className="card p-5">
            <h2 className="text-[15px] font-medium">个人资料</h2>
            <div className="mt-4 flex gap-2">
              {(Object.keys(SEX_LABEL) as Sex[]).map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sex }))}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[13px] ${form.sex === sex ? "border-primary bg-primary-soft text-[#3c4d41]" : "border-line text-muted"}`}
                >
                  {SEX_LABEL[sex]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField label="年龄" value={form.age} onChange={set("age")} min={PROFILE_LIMITS.age[0]} max={PROFILE_LIMITS.age[1]} suffix="岁" />
              <NumberField label="身高" value={form.heightCm} onChange={set("heightCm")} min={PROFILE_LIMITS.heightCm[0]} max={PROFILE_LIMITS.heightCm[1]} suffix="cm" />
              <NumberField
                label="当前体重"
                value={form.currentWeightKg}
                onChange={set("currentWeightKg")}
                min={PROFILE_LIMITS.weightKg[0]}
                max={PROFILE_LIMITS.weightKg[1]}
                step={0.1}
                suffix="kg"
              />
              <NumberField
                label="目标体重"
                value={form.targetWeightKg}
                onChange={set("targetWeightKg")}
                min={PROFILE_LIMITS.weightKg[0]}
                max={PROFILE_LIMITS.weightKg[1]}
                step={0.1}
                suffix="kg"
              />
              <NumberField
                label="每周运动"
                value={form.weeklyExerciseHours}
                onChange={set("weeklyExerciseHours")}
                min={PROFILE_LIMITS.weeklyExerciseHours[0]}
                max={PROFILE_LIMITS.weeklyExerciseHours[1]}
                step={0.5}
                suffix="小时"
              />
              <label className="block">
                <span className="label">运动类型（可选）</span>
                <input value={form.exerciseType} onChange={(e) => set("exerciseType")(e.target.value)} className="field" placeholder="力量训练 / 跑步" />
              </label>
            </div>
            <button type="button" onClick={submitProfile} className="btn btn-primary mt-4 w-full">
              保存资料
            </button>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium">营养目标</h2>
              <button
                type="button"
                onClick={() => {
                  const computed = recomputeGoal();
                  setMessage(computed ? `已生成新目标：${computed.goal.dailyCaloriesKcal} kcal，旧目标保留在计划页历史中。` : "计算失败");
                }}
                className="btn btn-ghost text-[13px]"
              >
                重新计算
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {goal
                ? `当前：${goal.dailyCaloriesKcal} kcal · 蛋白 ${goal.proteinG} g · 碳水 ${goal.carbohydratesG} g · 脂肪 ${goal.fatG} g（依据 ${goal.basisWeightKg} kg，规则 ${goal.calculationRuleVersion}）`
                : "还没有目标，点击右侧按钮生成。"}
            </p>
            <p className="mt-2 text-[12px] text-muted">
              目标体重 {kg(profile.targetWeightKg)} kg · 当前 {kg(profile.currentWeightKg)} kg ·{" "}
              {toTarget > 0 ? `还需减少 ${kg(toTarget)} kg` : toTarget < 0 ? `已低于目标 ${kg(Math.abs(toTarget))} kg` : "已达到目标体重"}
            </p>
            <p className="mt-1 text-[11px] text-muted">记录体重不会自动改目标，只有点「重新计算」才会生成新版本。</p>
          </section>
        </div>

        <div className="space-y-3">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium">体重记录</h2>
              <span className="text-[12px] text-muted">
                {todayWeight ? `今日 ${kg(todayWeight.weightKg)} kg` : "今日未记录"} · 7 日均值 {average ? `${kg(average)} kg` : "—"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">日期</span>
                <input
                  type="date"
                  value={weightDate}
                  max={today}
                  onChange={(e) => setWeightDate(e.target.value || today)}
                  className="field"
                  aria-label="体重日期"
                />
              </label>
              <label className="block">
                <span className="label">体重（kg）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="field"
                  aria-label="今日体重"
                />
              </label>
              <label className="block">
                <span className="label">备注（可选）</span>
                <input value={weightNote} onChange={(e) => setWeightNote(e.target.value)} className="field" placeholder="早晨空腹" />
              </label>
              <div className="flex items-end gap-2">
                <button type="button" onClick={submitWeight} className="btn btn-primary flex-1">
                  {editingId ? "更新记录" : "记录"}
                </button>
                {editingId ? (
                  <button type="button" onClick={() => setWeightDate(today)} className="btn btn-ghost text-[12px]">
                    回到今天
                  </button>
                ) : null}
              </div>
            </div>
            {editingId ? <p className="mt-1 text-[11px] text-muted">这一天已有记录，保存会更新它（同一天只保留一条）。</p> : null}

            {series.length >= 2 ? (
              <div className="mt-4 h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#E8ECE6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} stroke="#667068" tickLine={false} />
                    <YAxis
                      domain={[(dataMin: number) => Math.floor(dataMin - 1), (dataMax: number) => Math.ceil(dataMax + 1)]}
                      fontSize={11}
                      stroke="#667068"
                      tickLine={false}
                    />
                    <Tooltip formatter={(value: number) => [`${value} kg`, "体重"]} labelFormatter={(label: string) => label} contentStyle={{ borderRadius: 12, border: "1px solid #E8ECE6", fontSize: 12 }} />
                    <Line type="monotone" dataKey="weightKg" stroke="#5f7d69" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-muted">记录两天以上即可看到趋势图。单日变化多来自水分，不必过度解读。</p>
            )}

            {history.length ? (
              <ul className="mt-3 divide-y divide-line text-[13px]">
                {history.slice(0, 12).map((record) => (
                  <li key={record.id} className="flex items-center justify-between py-2">
                    <span>
                      {record.date === today ? "今天" : record.date}
                      {record.note ? <span className="ml-2 text-muted">{record.note}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{kg(record.weightKg)} kg</span>
                      <button
                        type="button"
                        onClick={() => setWeightDate(record.date)}
                        className="rounded-lg p-1 text-muted hover:text-ink"
                        aria-label={`编辑 ${record.date} 的体重记录`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`删除 ${record.date} 的体重记录？`)) removeWeight(record.id);
                        }}
                        className="rounded-lg p-1 text-muted hover:text-danger"
                        aria-label={`删除 ${record.date} 的体重记录`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <AccountCard />

          <AiSettingsCard />

          <section className="card p-5">
            <h2 className="text-[15px] font-medium">数据</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              数据默认保存在这台设备的浏览器里；登录后还会同步到云端，换设备用同一个账号即可恢复。导出备份始终可用。
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={exportData} className="btn btn-ghost text-[13px]">
                <Download size={14} /> 导出
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost text-[13px]">
                <Upload size={14} /> 导入
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("清空后本地数据无法恢复，确定继续？建议先导出备份。")) {
                    reset();
                    setMessage("数据已清空。");
                  }
                }}
                className="btn btn-ghost text-[13px] text-danger"
              >
                <Trash2 size={14} /> 清空
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importData(file);
                e.target.value = "";
              }}
            />
            <p className="mt-3 text-[11px] text-muted">
              共 {data.foodRecords.length} 条饮食记录 · {data.weightRecords.length} 条体重记录 · {data.nutritionGoals.length} 个目标版本 ·{" "}
              {data.mealTemplates.length} 个模板（schema v{data.schemaVersion}）
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
