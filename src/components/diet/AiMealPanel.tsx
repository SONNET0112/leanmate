import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Send, Sparkles, Trash2, Wand2 } from "lucide-react";
import { aiHealth, parseMealWithAi, scale } from "../../modules/ai/ai.client";
import { parseMealLocally } from "../../modules/ai/local-parser";
import type { AiError, DraftFoodItem } from "../../modules/ai/ai.types";
import { calculateFoodNutrition } from "../../modules/nutrition/nutrition.calculator";
import { findFood, findFoodByName } from "../../modules/nutrition/nutrition.service";
import { FOOD_STATE_LABEL, type FoodState } from "../../modules/nutrition/nutrition.types";
import { MEAL_LABEL, MEAL_ORDER, type MealType } from "../../modules/records/records.types";
import { grams } from "../../utils/format";

const STATES: FoodState[] = ["raw", "cooked", "ready_to_eat"];
const money = (n: number) => Math.round(n * 10) / 10;

function withAmount(item: DraftFoodItem, amountG: number): DraftFoodItem {
  const food = item.foodId ? findFood(item.foodId) : undefined;
  return {
    ...item,
    amountG,
    nutrition: food ? calculateFoodNutrition(food, amountG) : scale(item.per100g, amountG),
  };
}

function withNutrition(item: DraftFoodItem): DraftFoodItem {
  const food = item.foodId ? findFood(item.foodId) : undefined;
  return { ...item, nutrition: food ? calculateFoodNutrition(food, item.amountG) : scale(item.per100g, item.amountG) };
}

/** 改名后重新对齐食物库；库里有就换成库内数值，没有就保留原估算并标记来源。 */
function withName(item: DraftFoodItem, name: string): DraftFoodItem {
  const clean = name.trim().slice(0, 40) || item.name;
  const food = findFoodByName(clean, item.foodState);
  if (food) {
    return {
      ...item,
      name: food.name,
      foodId: food.id,
      per100g: food.nutritionPer100g,
      foodState: food.state,
      source: "database",
      confidence: 1,
      basis: "手动匹配到食物库",
      nutrition: calculateFoodNutrition(food, item.amountG),
    };
  }
  return { ...item, name: clean, foodId: null, source: item.source === "local-match" ? "local-match" : "model-estimate" };
}

function withState(item: DraftFoodItem, state: FoodState): DraftFoodItem {
  const food = findFoodByName(item.name, state);
  if (food) {
    return {
      ...item,
      foodId: food.id,
      foodState: food.state,
      per100g: food.nutritionPer100g,
      source: "database",
      nutrition: calculateFoodNutrition(food, item.amountG),
    };
  }
  return { ...item, foodState: state, foodId: null, source: item.source === "local-match" ? "local-match" : "model-estimate" };
}

const SOURCE_LABEL: Record<DraftFoodItem["source"], string> = {
  database: "食物库",
  "model-estimate": "模型估算",
  "local-match": "本地匹配",
};

export function AiMealPanel({
  date,
  defaultMeal,
  onSave,
  hero = false,
  chips = [],
}: {
  date: string;
  defaultMeal: MealType;
  onSave: (items: DraftFoodItem[]) => void;
  /** 首页大面板：同一套识别流程，只换成主视觉板块 */
  hero?: boolean;
  /** hero 下的快捷短语，点一下填进输入框 */
  chips?: { label: string; text: string }[];
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<DraftFoodItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    aiHealth().then((health) => setConfigured(health.configured));
  }, []);

  const runAi = async () => {
    if (text.trim().length < 2) {
      setError({ code: "BAD_TEXT", message: "请先描述吃了什么，例如「中午一碗米饭、一份青菜」" });
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = await parseMealWithAi(text.trim());
      setItems(parsed);
      setUnmatched([]);
      setNotice(`AI 识别出 ${parsed.length} 项，请核对后确认保存。`);
    } catch (e) {
      setError(e as AiError);
    } finally {
      setBusy(false);
    }
  };

  const runLocal = () => {
    setError(null);
    const { items: localItems, unmatched: rest } = parseMealLocally(text, defaultMeal);
    setItems(localItems);
    setUnmatched(rest);
    setNotice(
      localItems.length
        ? `本地食物库匹配到 ${localItems.length} 项${rest.length ? `，另有 ${rest.length} 项需要手动添加` : ""}。`
        : "本地食物库里没有匹配到食物，请用上面的搜索框手动添加。",
    );
  };

  const totals = items.reduce(
    (acc, item) => ({
      caloriesKcal: acc.caloriesKcal + item.nutrition.caloriesKcal,
      proteinG: acc.proteinG + item.nutrition.proteinG,
      carbohydratesG: acc.carbohydratesG + item.nutrition.carbohydratesG,
      fatG: acc.fatG + item.nutrition.fatG,
    }),
    { caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 },
  );

  return (
    <section className={hero ? "hero p-4 sm:p-5" : "card p-4"}>
      {hero ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface text-primary-deep shadow-[0_6px_16px_-12px_rgba(31,39,35,0.6)]">
            <Sparkles size={15} strokeWidth={2} aria-hidden />
          </span>
          <h2 className="shrink-0 text-[14px] font-semibold tracking-tight text-primary-deep">LeanMate AI 助手</h2>
          <p className="hidden min-w-0 truncate text-[11.5px] text-[#5f7263] sm:block">说一句吃了什么，我来算营养并记账</p>
          {items.length ? (
            <button
              type="button"
              onClick={() => {
                setItems([]);
                setUnmatched([]);
                setNotice(null);
                setError(null);
              }}
              className="ml-auto shrink-0 text-[11.5px] text-[#5f7263] hover:underline"
            >
              清空结果
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[15px] font-medium">
            <Sparkles size={15} className="text-primary" aria-hidden /> 一句话记录
          </h2>
        </div>
      )}

      {hero ? (
        <>
          <div className="mt-3 flex items-end gap-2 rounded-2xl border border-white bg-surface p-2 pl-3.5 shadow-[0_2px_4px_rgba(31,39,35,0.04),0_20px_40px_-28px_rgba(31,39,35,0.65)] focus-within:ring-2 focus-within:ring-primary/25">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="说一句你吃了什么，例如：中午一碗米饭和一份青菜"
              className="max-h-28 min-h-[52px] w-full resize-none border-0 bg-transparent px-0.5 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-[#9aa49b]"
              aria-label="AI 一句话描述"
            />
            <button
              type="button"
              onClick={runAi}
              disabled={busy || configured === false}
              aria-label="AI 识别"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-deep text-white transition-colors hover:bg-[#3f5a48] disabled:opacity-50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button key={chip.label} type="button" onClick={() => setText(chip.text)} className="chip">
                {chip.label}
              </button>
            ))}
            <button type="button" onClick={runLocal} disabled={busy} className="chip">
              <Wand2 size={12} aria-hidden /> 离线匹配
            </button>
          </div>
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="例如：中午一碗米饭、一份红烧肉和一份青菜"
            className="field mt-2 resize-none"
            aria-label="饮食描述"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={runAi} disabled={busy} className="btn btn-primary text-[13px]">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI 识别
            </button>
            <button type="button" onClick={runLocal} disabled={busy} className="btn btn-ghost text-[13px]">
              <Wand2 size={14} /> 离线匹配
            </button>
            {items.length ? (
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setUnmatched([]);
                  setNotice(null);
                  setError(null);
                }}
                className="btn btn-ghost text-[13px] text-muted"
              >
                清空结果
              </button>
            ) : null}
          </div>
        </>
      )}

      {configured === false ? (
        <p className="mt-2 rounded-lg border border-[#f0e6cf] bg-[#fdf8ec] px-3 py-2 text-[11px] leading-relaxed text-[#7a6231]">
          AI 识别当前未启用（线上版本未接入 AI 服务）。饮食记录、营养统计、体重和模板都不受影响：
          可以直接点「离线匹配」按食物库填，或用上面的搜索框手动记录。
        </p>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-lg border border-[#eed6d3] bg-[#fdf4f3] px-3 py-2 text-[12px] text-danger" role="alert">
          <p className="flex items-center gap-1.5">
            <AlertCircle size={13} /> {error.message}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {error.code !== "NOT_CONFIGURED" ? (
              <button type="button" onClick={runAi} className="text-[12px] underline">
                重试
              </button>
            ) : null}
            <button type="button" onClick={runLocal} className="text-[12px] underline">
              改用离线匹配
            </button>
          </div>
        </div>
      ) : null}

      {notice ? <p className="mt-2 text-[12px] text-muted">{notice}</p> : null}

      {items.some((item) => item.source === "model-estimate") ? (
        <p className="mt-2 rounded-lg border border-[#f0e6cf] bg-[#fdf8ec] px-3 py-2 text-[11px] leading-relaxed text-[#7a6231]">
          其中「模型估算」项不在食物库中，红烧肉这类复合菜/外卖误差可达 ±30%。请按实际份量核对克数，能对上食物库的改成库内食物再保存。
        </p>
      ) : null}

      {unmatched.length ? (
        <p className="mt-2 rounded-lg bg-[#fafbf8] px-3 py-2 text-[11px] text-muted">
          未匹配：{unmatched.join("、")}。这些食物不在食物库中，请用搜索框手动添加或换一个说法。
        </p>
      ) : null}

      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    defaultValue={item.name}
                    key={`${item.key}-${item.name}`}
                    onBlur={(e) => setItems((list) => list.map((it, i) => (i === index ? withName(it, e.target.value) : it)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-full border-0 border-b border-transparent bg-transparent p-0 text-[14px] focus:border-line"
                    aria-label={`第 ${index + 1} 项食物名称`}
                  />
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span className={item.source === "model-estimate" ? "text-[#a2711f]" : "text-primary"}>{SOURCE_LABEL[item.source]}</span>
                    <span>· 置信度 {Math.round(item.confidence * 100)}%</span>
                    {item.basis ? <span>· {item.basis}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
                  className="rounded-lg p-1 text-muted hover:text-danger"
                  aria-label={`移除 ${item.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={2000}
                  value={item.amountG}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setItems((list) => list.map((it, i) => (i === index ? withAmount(it, Number.isFinite(next) ? next : it.amountG) : it)));
                  }}
                  onBlur={(e) => {
                    const next = Math.min(2000, Math.max(1, Number(e.target.value) || 1));
                    setItems((list) => list.map((it, i) => (i === index ? withNutrition(withAmount(it, next)) : it)));
                  }}
                  className="w-20 rounded-lg border border-line px-2 py-1 text-right text-[13px]"
                  aria-label={`${item.name} 克数`}
                />
                <span className="text-[12px] text-muted">克</span>
                <select
                  value={item.mealType}
                  onChange={(e) => setItems((list) => list.map((it, i) => (i === index ? { ...it, mealType: e.target.value as MealType } : it)))}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px]"
                  aria-label={`${item.name} 餐次`}
                >
                  {MEAL_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABEL[m]}
                    </option>
                  ))}
                </select>
                <select
                  value={item.foodState}
                  onChange={(e) => setItems((list) => list.map((it, i) => (i === index ? withState(it, e.target.value as FoodState) : it)))}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px]"
                  aria-label={`${item.name} 生熟状态`}
                >
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {FOOD_STATE_LABEL[state]}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-[13px]">{Math.round(item.nutrition.caloriesKcal)} kcal</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                蛋白 {grams(item.nutrition.proteinG)} · 碳水 {grams(item.nutrition.carbohydratesG)} · 脂肪 {grams(item.nutrition.fatG)} g
              </p>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-xl bg-[#fafbf8] px-3 py-2 text-[13px]">
            <span className="text-muted">合计</span>
            <span>
              {Math.round(totals.caloriesKcal)} kcal · 蛋白 {grams(money(totals.proteinG))} g · 碳水 {grams(money(totals.carbohydratesG))} g ·
              脂肪 {grams(money(totals.fatG))} g
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onSave(items);
                setItems([]);
                setUnmatched([]);
                setText("");
                setNotice("已保存到当天记录。");
              }}
              className="btn btn-primary flex-1"
            >
              确认并保存 {items.length} 项
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
