import { Check, ListTodo } from 'lucide-react';
import { useMyTasks } from '../hooks/useMyTasks';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

interface MyTasksDrawerMobileProps {
  open: boolean;
  onClose: () => void;
}

// Mobile replacement for the side-drawer: a full-screen MobileSheet listing tasks
// assigned to the signed-in team member, with the same live toggle-to-done behavior.
export function MyTasksDrawerMobile({ open, onClose }: MyTasksDrawerMobileProps) {
  const { tasks, loading, toggleDone } = useMyTasks();

  return (
    <MobileSheet
      isOpen={open}
      onClose={onClose}
      title="My Tasks"
      headerLeft={<ListTodo className="w-5 h-5 text-brand-accent shrink-0" />}
    >
      <div className="space-y-2">
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
              className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200/80"
            >
              <button
                type="button"
                onClick={() => toggleDone(task.id, !task.done)}
                className={cn(
                  'w-6 h-6 mt-0.5 rounded-md border flex items-center justify-center transition-colors shrink-0 mobile-tap-target',
                  task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300'
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
    </MobileSheet>
  );
}
