import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../app/store";
import { computeNutritionGoal, PROFILE_LIMITS, validateProfileInput } from "../modules/plan/plan.service";
import type { Sex, UserProfile } from "../modules/plan/plan.types";

const SEX_LABEL: Record<Sex, string> = { male: "男", female: "女", other: "其他" };

export function OnboardingPage() {
  const { data, createProfile } = useStore();
  const navigate = useNavigate();
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState("28");
  const [heightCm, setHeightCm] = useState("165");
  const [currentWeightKg, setCurrentWeightKg] = useState("65");
  const [targetWeightKg, setTargetWeightKg] = useState("58");
  const [weeklyExerciseHours, setWeeklyExerciseHours] = useState("3");
  const [exerciseType, setExerciseType] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = {
    age: Number(age),
    heightCm: Number(heightCm),
    currentWeightKg: Number(currentWeightKg),
    targetWeightKg: Number(targetWeightKg),
    weeklyExerciseHours: Number(weeklyExerciseHours),
  };
  const problem = validateProfileInput(parsed);

  const preview = useMemo(() => {
    if (problem) return null;
    const draft: UserProfile = {
      ...parsed,
      id: "preview",
      sex,
      exerciseType: exerciseType || undefined,
      createdAt: "",
      updatedAt: "",
    };
    try {
      return computeNutritionGoal(draft, new Date().toISOString().slice(0, 10));
    } catch {
      return null;
    }
  }, [problem, sex, age, heightCm, currentWeightKg, targetWeightKg, weeklyExerciseHours, exerciseType]);

  if (data === null) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">
        正在读取本地数据…
      </div>
    );
  }
  if (data.profile) return <Navigate to="/" replace />;

  const submit = () => {
    setError(null);
    if (problem) {
      setError(problem);
      return;
    }
    createProfile({
      sex,
      ...parsed,
      exerciseType: exerciseType.trim() || undefined,
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[12px] uppercase tracking-[0.18em] text-primary">LeanMate</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">先了解一下你的基本情况</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          这些信息只用来估算你的每日营养目标，全部保存在本机浏览器。计算结果是估算，不是医学建议。
        </p>

        <div className="card mt-6 p-5">
          <div className="flex gap-2">
            {(Object.keys(SEX_LABEL) as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`flex-1 rounded-xl border px-3 py-2 text-[13px] ${
                  sex === s ? "border-primary bg-primary-soft text-[#3c4d41]" : "border-line text-muted"
                }`}
              >
                {SEX_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">年龄</span>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="field" min={PROFILE_LIMITS.age[0]} max={PROFILE_LIMITS.age[1]} />
            </label>
            <label className="block">
              <span className="label">身高（cm）</span>
              <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="label">当前体重（kg）</span>
              <input type="number" step={0.1} value={currentWeightKg} onChange={(e) => setCurrentWeightKg(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="label">目标体重（kg）</span>
              <input type="number" step={0.1} value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="label">每周运动时长（小时）</span>
              <input type="number" step={0.5} value={weeklyExerciseHours} onChange={(e) => setWeeklyExerciseHours(e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="label">运动类型（可选）</span>
              <input value={exerciseType} onChange={(e) => setExerciseType(e.target.value)} className="field" placeholder="力量训练" />
            </label>
          </div>

          {problem ? <p className="mt-3 text-[12px] text-danger">{problem}</p> : null}
          {error ? <p className="mt-1 text-[12px] text-danger">{error}</p> : null}

          {preview ? (
            <div className="mt-4 rounded-xl bg-[#fafbf8] p-3 text-[12px] text-muted">
              <p className="text-[13px] text-ink">
                预计目标 {preview.goal.dailyCaloriesKcal} kcal · 蛋白 {preview.goal.proteinG} g · 碳水 {preview.goal.carbohydratesG} g · 脂肪 {preview.goal.fatG} g
              </p>
              <p className="mt-1">
                基础代谢 {preview.bmr} kcal × {preview.band.label}（{preview.band.factor}） − {preview.deficitAppliedKcal} kcal 缺口
                {preview.floorApplied ? "，已触发热量下限" : ""}
              </p>
              <p className="mt-1">规则版本 1.0.0，基于公开的 Mifflin-St Jeor 公式与蛋白质摄入建议，属估算值。</p>
            </div>
          ) : null}

          <button type="button" onClick={submit} className="btn btn-primary mt-4 w-full" disabled={Boolean(problem)}>
            生成目标并开始
          </button>
        </div>
      </div>
    </div>
  );
}
