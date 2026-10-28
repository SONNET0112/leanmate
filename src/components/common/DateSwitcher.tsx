import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateCN, weekdayCN } from "../../utils/date";

export function DateSwitcher({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const isToday = date === today;
  const label = isToday ? "今天" : date === addDays(today, -1) ? "昨天" : `${formatDateCN(date)} ${weekdayCN(date)}`;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(addDays(date, -1))}
        className="grid size-8 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink"
        aria-label="前一天"
      >
        <ChevronLeft size={15} />
      </button>
      <label className="relative flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] whitespace-nowrap">
        <CalendarDays size={14} className="text-muted" aria-hidden />
        <span className={`whitespace-nowrap ${isToday ? "font-medium" : ""}`}>{label}</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="选择日期"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        className="grid size-8 place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink disabled:opacity-40"
        aria-label="后一天"
      >
        <ChevronRight size={15} />
      </button>
      {!isToday ? (
        <button type="button" onClick={() => onChange(today)} className="ml-1 text-[12px] text-primary hover:underline">
          回到今天
        </button>
      ) : null}
    </div>
  );
}
