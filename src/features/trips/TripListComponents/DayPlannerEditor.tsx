import { useState, useRef } from 'react';
import { Plus, Edit3, Trash2, GripVertical, Check, Clock, ClipboardList, Loader2 } from 'lucide-react';
import { DayPlannerEntry } from '../../../types';
import { cn } from '../../../lib/utils';

// Entry list + add/edit form, with no modal chrome of its own - reused both inside
// DayPlannerModal (popup, for month/week calendar views and the trips list) and
// embedded directly on the daily planner calendar's Day view.
export function DayPlannerEditor({ entries, onSave, completedByName, emptyStateClassName }: {
  entries: DayPlannerEntry[];
  onSave: (entries: DayPlannerEntry[]) => Promise<boolean>;
  // Whoever is viewing this editor (always the account owner - team members only
  // get the read-only Today's Plan dialog) - recorded on the entry when they tick it.
  completedByName: string;
  emptyStateClassName?: string;
}) {
  // Local, optimistic copy of the entries - initialized once from the live Firestore
  // data when this mounts (parents remount it via `key={date}` per day). Mutations
  // update this immediately so drag-reorder feels instant, and persist to Firestore
  // in the background via onSave.
  const [localEntries, setLocalEntries] = useState<DayPlannerEntry[]>(entries);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draggedIdxRef = useRef<number | null>(null);

  const persist = async (updated: DayPlannerEntry[]) => {
    setLocalEntries(updated);
    setSaving(true);
    await onSave(updated);
    setSaving(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setTime('');
    setNote('');
  };

  const handleAddOrSave = async () => {
    const trimmedNote = note.trim();
    if (!trimmedNote) return;

    // Firestore rejects `undefined` field values, so an unset time must be an
    // omitted key entirely rather than `time: undefined`.
    if (editingId) {
      const updated = localEntries.map(e => {
        if (e.id !== editingId) return e;
        const { time: _oldTime, ...rest } = e;
        return time ? { ...rest, time, note: trimmedNote } : { ...rest, note: trimmedNote };
      });
      await persist(updated);
    } else {
      const newEntry: DayPlannerEntry = {
        id: crypto.randomUUID(),
        note: trimmedNote,
        completed: false,
        ...(time ? { time } : {})
      };
      await persist([...localEntries, newEntry]);
    }
    resetForm();
  };

  const handleEdit = (entry: DayPlannerEntry) => {
    setEditingId(entry.id);
    setTime(entry.time || '');
    setNote(entry.note);
  };

  const handleDelete = async (id: string) => {
    await persist(localEntries.filter(e => e.id !== id));
    if (editingId === id) resetForm();
  };

  const handleToggleCompleted = async (id: string) => {
    // Same Firestore-rejects-undefined constraint as `time`: uncompleting must omit
    // `completedBy` entirely rather than null/undefined it out.
    const updated = localEntries.map(e => {
      if (e.id !== id) return e;
      if (!e.completed) return { ...e, completed: true, completedBy: completedByName };
      const { completedBy: _oldCompletedBy, ...rest } = e;
      return { ...rest, completed: false };
    });
    await persist(updated);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    draggedIdxRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = draggedIdxRef.current;
    draggedIdxRef.current = null;
    if (sourceIdx === null || sourceIdx === targetIdx) return;

    const list = [...localEntries];
    const [dragged] = list.splice(sourceIdx, 1);
    list.splice(targetIdx, 0, dragged);
    await persist(list);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-1 overflow-y-auto space-y-2.5 flex-1">
        {localEntries.length === 0 ? (
          <div className={cn("text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200", emptyStateClassName)}>
            <ClipboardList className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No Entries Yet</p>
            <p className="text-zinc-400 text-xs mt-1 max-w-xs mx-auto">Add your first entry below to start planning the day.</p>
          </div>
        ) : (
          localEntries.map((entry, idx) => (
            <div
              key={entry.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm hover:border-zinc-300 transition-all group select-none"
            >
              <div className="text-zinc-350 group-hover:text-zinc-550 shrink-0 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4" />
              </div>

              <button
                type="button"
                title={entry.completed ? 'Mark as not completed' : 'Mark as completed'}
                onClick={() => handleToggleCompleted(entry.id)}
                className={cn(
                  "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer",
                  entry.completed ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                )}
              >
                {entry.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.time && (
                    <span className="shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-black text-emerald-700 flex items-center gap-1 uppercase tracking-wider leading-none">
                      <Clock className="w-3 h-3 text-emerald-650" />
                      {entry.time}
                    </span>
                  )}
                  <p className={cn(
                    "text-sm font-medium break-words",
                    entry.completed ? "text-zinc-400 line-through" : "text-zinc-800"
                  )}>
                    {entry.note}
                  </p>
                </div>
                {entry.completed && entry.completedBy && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">Completed by {entry.completedBy}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Edit entry"
                  onClick={() => handleEdit(entry)}
                  className="p-1.5 hover:bg-zinc-100 text-zinc-450 hover:text-brand-primary rounded-xl transition-colors border border-transparent hover:border-zinc-200 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Delete entry"
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 hover:bg-red-50 text-zinc-450 hover:text-red-500 rounded-xl transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-4 mt-2 border-t border-zinc-100 shrink-0">
        <div className="flex items-end gap-3">
          <div className="w-28 shrink-0 space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Time (optional)</label>
            <input
              type="time"
              title="Entry time (optional)"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs to happen..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOrSave();
                }
              }}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          {editingId && (
            <button
              type="button"
              title="Cancel edit"
              onClick={resetForm}
              className="px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors shrink-0"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            title={editingId ? 'Save changes' : 'Add entry'}
            onClick={handleAddOrSave}
            disabled={!note.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Save' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
