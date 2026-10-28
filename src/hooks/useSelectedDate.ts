import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../app/store";
import { toISODate } from "../utils/date";

/** 选中日期放在 URL（?date=YYYY-MM-DD），刷新与分享都保留；默认今天。 */
export function useSelectedDate(): { date: string; today: string; setDate: (date: string) => void } {
  const { today } = useStore();
  const [params, setParams] = useSearchParams();
  const raw = params.get("date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;

  const setDate = useCallback(
    (next: string) => {
      const safe = next > toISODate() ? toISODate() : next;
      setParams(safe === toISODate() ? {} : { date: safe }, { replace: true });
    },
    [setParams],
  );

  return { date, today, setDate };
}
