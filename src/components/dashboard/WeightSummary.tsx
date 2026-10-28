import { Activity, ArrowDownRight, ArrowUpRight, Minus, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { sevenDayAverage, weightChange, weightForDate } from "../../modules/tracking/tracking.service";
import type { WeightRecord } from "../../modules/tracking/tracking.types";
import { formatDateCN } from "../../utils/date";
import { kg } from "../../utils/format";

/** 14 天内的体重折线，直接画 SVG：只为一张小卡片不值得把 Recharts 拉回首屏。 */
function Sparkline({ values, target }: { values: number[]; target?: number }) {
  if (values.length < 2) {
    return <div className="grid h-[76px] place-items-center text-[11px] text-muted">记录两次以上就能看到趋势</div>;
  }
  const all = target ? [...values, target] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max((max - min) * 0.35, 0.4);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const y = (v: number) => 36 - ((v - lo) / (hi - lo)) * 30 + 2;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-[76px] w-full" aria-hidden>
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d8f74" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6d8f74" stopOpacity="0" />
        </linearGradient>
      </defs>
      {target ? (
        <line x1="0" y1={y(target)} x2="100" y2={y(target)} stroke="#c9d6c2" strokeWidth="0.8" strokeDasharray="2 2" />
      ) : null}
      <polygon points={`0,40 ${points} 100,40`} fill="url(#weight-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function WeightSummary({
  records,
  date,
  today,
  targetWeightKg,
}: {
  records: WeightRecord[];
  date: string;
  today?: string;
  targetWeightKg?: number;
}) {
  const isToday = !today || today === date;
  const record = weightForDate(records, date);
  const average = sevenDayAverage(records, date);
  const { deltaKg } = weightChange(records);
  const recent = [...records].filter((r) => r.date <= date).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const hasTrend = recent.length >= 2;

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">体重趋势</h2>
        <Link to="/profile" className="flex items-center gap-1 text-[12px] text-primary hover:underline">
          <Pencil size={11} aria-hidden />
          {record ? "查看趋势" : "记录体重"}
        </Link>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <div className="flex items-baseline gap-1">
          {record ? (
            <>
              <span className="text-[26px] font-semibold leading-none tracking-tight">{kg(record.weightKg)}</span>
              <span className="text-[12px] text-muted">kg</span>
            </>
          ) : (
            <span className="text-[13px] text-muted">还没有体重记录</span>
          )}
        </div>
        <div className="ml-auto text-right text-[11px] leading-relaxed text-muted">
          <p>目标 {targetWeightKg ? `${kg(targetWeightKg)} kg` : "未设置"}</p>
          <p className="mt-0.5 flex items-center justify-end gap-0.5">
            {!record ? (
              <span>暂无记录</span>
            ) : deltaKg === null || deltaKg === 0 ? (
              <>
                <Minus size={12} aria-hidden /> 持平
              </>
            ) : deltaKg < 0 ? (
              <>
                <ArrowDownRight size={12} className="text-primary" aria-hidden /> {kg(Math.abs(deltaKg))} kg
              </>
            ) : (
              <>
                <ArrowUpRight size={12} aria-hidden /> +{kg(deltaKg)} kg
              </>
            )}
          </p>
        </div>
      </div>

      {hasTrend ? (
        <div className="mt-1">
          <Sparkline values={recent.map((r) => r.weightKg)} target={targetWeightKg} />
          <div className="flex justify-between text-[10.5px] text-muted">
            <span>{formatDateCN(recent[0].date)}</span>
            <span>{formatDateCN(recent[recent.length - 1].date)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-[#fafbf6] px-3 py-5 text-center">
          <Activity size={18} className="text-primary/70" aria-hidden />
          <p className="text-[11.5px] leading-relaxed text-muted">
            记录两天以上就能看到曲线
          </p>
          <Link to="/profile" className="text-[11.5px] text-primary hover:underline">
            记录今天的体重 →
          </Link>
        </div>
      )}

      {record ? (
        <p className="mt-auto pt-2 text-[11px] leading-relaxed text-muted">
          {isToday ? "今日" : "当日"}测量 · 7 日均值 {average ? `${kg(average)} kg` : "—"}
        </p>
      ) : null}
    </section>
  );
}
