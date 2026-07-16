import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, ListTodo, Check } from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { useTeamMembers } from '../settings/hooks/useTeamMembers';
import { useTasks } from './hooks/useTasks';
import { TaskModal, AssigneeOption } from './components/TaskModal';
import { TaskModalMobile } from './components/TaskModalMobile';
import { Task } from '../../types';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TodoBoardMobile } from './TodoBoardMobile';

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

function AssigneeChip({ name, idKey }: { name: string; idKey: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', colorFor(idKey))}>
        {initials(name)}
      </span>
      <span className="text-sm text-zinc-700 truncate">{name}</span>
    </div>
  );
}

export function TodoBoard() {
  const { user } = useAuth();
  const { members } = useTeamMembers();
  const { tasks, loading, addTask, updateTask, toggleDone, deleteTask } = useTasks();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTodo, setShowTodo] = useState(true);
  const [showDone, setShowDone] = useState(true);

  const assigneeOptions: AssigneeOption[] = useMemo(() => {
    const self: AssigneeOption = {
      id: user?.uid || '',
      email: user?.email || '',
      name: 'Me',
    };
    const memberOptions = members.map((m) => ({
      id: m.id,
      email: m.email,
      name: `${m.firstName} ${m.lastName}`.trim() || m.email,
    }));
    return [self, ...memberOptions];
  }, [user, members]);

  const todo = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const openAdd = () => { setEditingTask(null); setModalOpen(true); };
  const openEdit = (task: Task) => { setEditingTask(task); setModalOpen(true); };

  const handleSubmit = async (data: {
    title: string; note?: string; assigneeId: string; assigneeEmail: string; assigneeName: string;
  }) => {
    if (editingTask) return updateTask(editingTask, data);
    return addTask(data);
  };

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        <TodoBoardMobile
          tasks={tasks}
          loading={loading}
          toggleDone={toggleDone}
          deleteTask={deleteTask}
          onAdd={openAdd}
          onEdit={openEdit}
        />
        <TaskModalMobile
          open={modalOpen}
          editingTask={editingTask}
          assigneeOptions={assigneeOptions}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      </>
    );
  }

  const renderRow = (task: Task) => (
    <div
      key={task.id}
      className="grid grid-cols-[auto_2fr_1.2fr_2fr_auto] items-center gap-3 px-4 py-3 border-t border-zinc-100 hover:bg-zinc-50/60 transition-colors group"
    >
      <button
        type="button"
        onClick={() => toggleDone(task.id, !task.done)}
        className={cn(
          'w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0',
          task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 hover:border-brand-accent'
        )}
        title={task.done ? 'Mark as not done' : 'Mark as done'}
      >
        {task.done && <Check className="w-3.5 h-3.5" />}
      </button>

      <span className={cn('text-sm font-medium truncate', task.done ? 'text-zinc-400 line-through' : 'text-zinc-900')}>
        {task.title}
      </span>

      <AssigneeChip name={task.assigneeName || task.assigneeEmail} idKey={task.assigneeId} />

      <span className="text-sm text-zinc-500 truncate">{task.note}</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors" title="Edit">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderGroup = (
    label: string, items: Task[], open: boolean, setOpen: (v: boolean) => void, accent: string
  ) => (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
        <span className={cn('w-2 h-2 rounded-full', accent)} />
        <span className="text-sm font-bold text-zinc-800">{label}</span>
        <span className="text-xs font-semibold text-zinc-400">{items.length}</span>
      </button>

      {open && items.length > 0 && (
        <div>
          <div className="grid grid-cols-[auto_2fr_1.2fr_2fr_auto] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-t border-zinc-100">
            <span></span>
            <span>Task</span>
            <span>Assignee</span>
            <span>Note</span>
            <span></span>
          </div>
          {items.map(renderRow)}
        </div>
      )}
      {open && items.length === 0 && (
        <p className="px-4 py-4 text-sm text-zinc-400 border-t border-zinc-100">No tasks here.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-brand-accent" /> Todo Lists
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Create tasks and assign them to your team or yourself.</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-12 text-center">
          <ListTodo className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">No tasks yet</p>
          <p className="text-sm text-zinc-400 mt-1">Click “Add task” to create your first one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderGroup('To Do', todo, showTodo, setShowTodo, 'bg-amber-500')}
          {renderGroup('Done', done, showDone, setShowDone, 'bg-emerald-500')}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        editingTask={editingTask}
        assigneeOptions={assigneeOptions}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
