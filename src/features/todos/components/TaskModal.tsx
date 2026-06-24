import { useEffect, useState } from 'react';
import { X, Loader2, ListTodo } from 'lucide-react';
import { Task } from '../../../types';

export interface AssigneeOption {
  id: string;     // owner uid (self) or team_members doc id
  email: string;
  name: string;
}

interface TaskModalProps {
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

export function TaskModal({ open, editingTask, assigneeOptions, onClose, onSubmit }: TaskModalProps) {
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-brand-accent" />
            <h2 className="font-bold text-zinc-900">{editingTask ? 'Edit task' : 'New task'}</h2>
          </div>
          <button title='Close' onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Task</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pack truck 2"
              autoFocus
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Assign to</label>
            <select
              title='set assigned'
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
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
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTask ? 'Save' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
