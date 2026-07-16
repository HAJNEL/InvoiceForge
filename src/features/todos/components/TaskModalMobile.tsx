import { useEffect, useState } from 'react';
import { Loader2, ListTodo } from 'lucide-react';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { Task } from '../../../types';

export interface AssigneeOption {
  id: string;     // owner uid (self) or team_members doc id
  email: string;
  name: string;
}

interface TaskModalMobileProps {
  open: boolean;
  editingTask: Task | null;
  assigneeOptions: AssigneeOption[];
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    note?: string;
    assigneeId: string;
    assigneeEmail: string;
    assigneeName: string;
  }) => Promise<unknown>;
}

export function TaskModalMobile({ open, editingTask, assigneeOptions, onClose, onSubmit }: TaskModalMobileProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingTask) {
      setTitle(editingTask.title);
      setNote(editingTask.note || '');
      setAssigneeId(editingTask.assigneeId);
    } else {
      setTitle('');
      setNote('');
      setAssigneeId(assigneeOptions[0]?.id || '');
    }
  }, [open, editingTask, assigneeOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Task title is required.');
      return;
    }
    const assignee = assigneeOptions.find((a) => a.id === assigneeId);
    if (!assignee) {
      setError('Please choose who this task is for.');
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({
      title: trimmed,
      note: note.trim(),
      assigneeId: assignee.id,
      assigneeEmail: assignee.email,
      assigneeName: assignee.name,
    });
    setSubmitting(false);
    if (result !== null) onClose();
  };

  return (
    <MobileSheet
      isOpen={open}
      onClose={onClose}
      title={editingTask ? 'Edit task' : 'New task'}
      headerLeft={<ListTodo className="w-5 h-5 text-brand-accent shrink-0" />}
      fullHeight={false}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            title="Cancel"
            className="flex-1 px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-modal-mobile-form"
            disabled={submitting}
            title={editingTask ? 'Save task' : 'Create task'}
            className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mobile-tap-target"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingTask ? 'Save' : 'Create task'}
          </button>
        </div>
      }
    >
      <form id="task-modal-mobile-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Task</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pack truck 2"
            autoFocus
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Assign to</label>
          <select
            title="Assign to"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          >
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Note <span className="text-zinc-400 normal-case font-normal">(optional)</span></label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Any extra detail…"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </MobileSheet>
  );
}
