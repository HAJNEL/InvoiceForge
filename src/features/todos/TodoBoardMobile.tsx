import { useMemo, useState } from 'react';
import { Plus, ListTodo, Check, Pencil, Trash2 } from 'lucide-react';
import { Task } from '../../types';
import { cn } from '../../lib/utils';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';

// Deterministic avatar color from a string, so each assignee keeps a stable chip color.
const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
];
function colorFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface TodoBoardMobileProps {
  tasks: Task[];
  loading: boolean;
  toggleDone: (taskId: string, done: boolean) => Promise<unknown>;
  deleteTask: (taskId: string) => Promise<unknown>;
  onAdd: () => void;
  onEdit: (task: Task) => void;
}

export function TodoBoardMobile({ tasks, loading, toggleDone, deleteTask, onAdd, onEdit }: TodoBoardMobileProps) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo');

  const todo = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);
  const activeList = tab === 'todo' ? todo : done;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-brand-accent" /> Todo Lists
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Create tasks and assign them to your team or yourself.</p>
        </div>
      </div>

      <button
        type="button"
        title="Add task"
        onClick={onAdd}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 rounded-xl transition-colors flex items-center justify-center gap-2 mobile-tap-target"
      >
        <Plus className="w-4 h-4" /> Add task
      </button>

      <div className="grid grid-cols-2 gap-2 bg-zinc-100 rounded-xl p-1">
        <button
          type="button"
          title="Show To Do tasks"
          onClick={() => setTab('todo')}
          className={cn(
            'py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 mobile-tap-target',
            tab === 'todo' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          )}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          To Do
          <span className="text-zinc-400">{todo.length}</span>
        </button>
        <button
          type="button"
          title="Show Done tasks"
          onClick={() => setTab('done')}
          className={cn(
            'py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 mobile-tap-target',
            tab === 'done' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          )}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Done
          <span className="text-zinc-400">{done.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-10 text-center">
          <ListTodo className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">No tasks yet</p>
          <p className="text-sm text-zinc-400 mt-1">Tap "Add task" to create your first one.</p>
        </div>
      ) : activeList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-8 text-center">
          <p className="text-sm text-zinc-400">No tasks here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeList.map((task) => (
            <MobileCard key={task.id}>
              <MobileCard.Primary>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleDone(task.id, !task.done)}
                    title={task.done ? 'Mark as not done' : 'Mark as done'}
                    className={cn(
                      'w-6 h-6 rounded-md border flex items-center justify-center transition-colors shrink-0 mobile-tap-target',
                      task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300'
                    )}
                  >
                    {task.done && <Check className="w-4 h-4" />}
                  </button>
                  <span className={cn('text-sm font-medium truncate', task.done ? 'text-zinc-400 line-through' : 'text-zinc-900')}>
                    {task.title}
                  </span>
                </div>
                <MobileCard.Actions>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Edit', icon: Pencil, onClick: () => onEdit(task) },
                      { label: 'Delete', icon: Trash2, onClick: () => deleteTask(task.id), destructive: true },
                    ]}
                  />
                </MobileCard.Actions>
              </MobileCard.Primary>

              <MobileCard.Secondary>
                <div className="flex items-center gap-2">
                  <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', colorFor(task.assigneeId))}>
                    {initials(task.assigneeName || task.assigneeEmail)}
                  </span>
                  <span className="truncate">{task.assigneeName || task.assigneeEmail}</span>
                </div>
                {task.note && <span className="truncate">{task.note}</span>}
              </MobileCard.Secondary>
            </MobileCard>
          ))}
        </div>
      )}
    </div>
  );
}
