import { Check } from "lucide-react";
import type { DailyTask } from "../../modules/tasks/tasks.types";

export function DailyTasks({ tasks, onToggle }: { tasks: DailyTask[]; onToggle: (id: string) => void }) {
  const done = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">今日任务</h2>
        <span className="text-[11px] text-muted">
          {done}/{tasks.length} 完成
        </span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1e8]">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-2.5 space-y-0.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-[#fafbf6]">
              <input type="checkbox" checked={task.completed} onChange={() => onToggle(task.id)} className="sr-only" />
              <span
                className={`grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors ${
                  task.completed ? "border-primary bg-primary text-white" : "border-line bg-surface"
                }`}
                aria-hidden
              >
                {task.completed ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className={`text-[13px] ${task.completed ? "text-muted line-through" : ""}`}>{task.title}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
