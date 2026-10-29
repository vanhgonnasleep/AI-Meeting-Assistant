import { ListTodo, Check, Users, Clock } from 'lucide-react';

/**
 * Action Deliverables Checklist Section Component
 */
export default function TasksSection({
  actionItems = [],
  completedTasks = {},
  updatingTasks = {},
  onToggleTask,
  isContentSaving = false,
  currentMeetingId,
}) {
  const totalTasks = actionItems.length;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const completionPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
            <ListTodo className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Extracted Action Deliverables</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-600">{completedCount} of {totalTasks} completed</span>
          {currentMeetingId && (
            <span className="text-xs text-emerald-700 bg-emerald-500/10 px-1.5 py-0.2 rounded-sm border border-emerald-500/20">
              Saved to your library
            </span>
          )}
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${completionPercent}%` }} 
          />
        </div>
      )}

      <ul className="space-y-2">
        {actionItems.map((item, idx) => {
          const isDone = completedTasks[idx];
          const isUpdating = updatingTasks[idx];

          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => onToggleTask(idx)}
                disabled={isUpdating || isContentSaving}
                aria-pressed={Boolean(isDone)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer group hover:translate-x-0.5 hover:shadow-xs ${
                  isDone 
                    ? 'bg-emerald-50/20 border-emerald-500/30 text-slate-600'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200/90 text-slate-900 shadow-xs'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150 ${
                  isDone 
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-xs shadow-emerald-500/20' 
                    : 'border-slate-300 group-hover:border-indigo-400'
                }`}>
                  {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm sm:text-base font-medium leading-relaxed ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {typeof item === 'object' ? item.task : String(item)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                    <span className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Users className="w-2.5 h-2.5 text-indigo-700" />
                      {(typeof item === 'object' ? item.assignee : null) || 'Unassigned'}
                    </span>
                    {typeof item === 'object' && item.deadline && (
                      <span className="flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-2.5 h-2.5" /> Due: {item.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
