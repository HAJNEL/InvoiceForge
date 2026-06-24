import { X, Check, ListTodo } from 'lucide-react';
import { useMyTasks } from '../hooks/useMyTasks';
import { cn } from '../../../lib/utils';

interface MyTasksDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Slide-in panel for team members on the Team Dashboard. Lists tasks assigned to
// them and lets them check tasks off; the toggle writes straight to Firestore so the
// owner's board updates live via onSnapshot.
export function MyTasksDrawer({ open, onClose }: MyTasksDrawerProps) {
  const { tasks, loading, toggleDone } = useMyTasks();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-zinc-950/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-xl flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <header className="h-16 px-4 flex items-center justify-between border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-brand-accent" />
            <span className="font-bold text-zinc-900">My Tasks</span>
          </div>
          <button title='Close' onClick={onClose} className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-brand-accent" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No tasks assigned</p>
              <p className="text-sm text-zinc-400 mt-1">You're all caught up.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200/80 hover:bg-zinc-50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleDone(task.id, !task.done)}
                  className={cn(
                    'w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center transition-colors shrink-0',
                    task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 hover:border-brand-accent'
                  )}
                  title={task.done ? 'Mark as not done' : 'Mark as done'}
                >
                  {task.done && <Check className="w-4 h-4" />}
                </button>
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium break-words', task.done ? 'text-zinc-400 line-through' : 'text-zinc-900')}>
                    {task.title}
                  </p>
                  {task.note && <p className="text-xs text-zinc-500 mt-0.5 break-words">{task.note}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
