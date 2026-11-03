import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useStore } from '../../store';
import Dialog from './Dialog';

interface Option { id: string; name: string }

function CreatableSelect({
  id,
  label,
  required,
  value,
  onChange,
  options,
  placeholder,
  onCreate,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  onCreate: (name: string) => Promise<string>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const newId = await onCreate(name.trim());
      if (newId) onChange(newId);
      setName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qf-field">
      <div className="qf-field__label-row">
        <label htmlFor={id} className="qf-label">
          {label} {required ? <span className="qf-required">*</span> : <span className="qf-optional">Optional</span>}
        </label>
        {!adding && (
          <button type="button" className="qf-link-btn" onClick={() => setAdding(true)}>
            <Plus size={13} /> New
          </button>
        )}
      </div>
      {adding ? (
        <div className="qf-inline-add">
          <input
            id={id}
            className="qf-input"
            autoFocus
            placeholder={`New ${label.toLowerCase()} name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false); }
            }}
          />
          <button type="button" className="qf-btn qf-btn--primary qf-btn--sm" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={14} className="qf-spin" /> : 'Add'}
          </button>
          <button type="button" className="qf-btn qf-btn--ghost qf-btn--sm" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <select id={id} className="qf-input qf-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{options.length ? placeholder : `No ${label.toLowerCase()}s yet — click “New”`}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function NewPaperDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { courses, subjects, classes, createQuestionPaper, createCourse, createSubject, createClass } = useStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(180);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const valid = title.trim() && subjectId && classId && maxMarks > 0 && date && duration > 0;

  const reset = () => {
    setTitle(''); setDate(''); setMaxMarks(100); setCourseId(''); setSubjectId('');
    setClassId(''); setInstructions(''); setDuration(180); setError('');
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    setCreating(true);
    setError('');
    try {
      const id = await createQuestionPaper(
        title.trim(), date, maxMarks, courseId || undefined, subjectId, classId, instructions || undefined, duration,
      );
      if (!id) {
        setError('We couldn’t create the paper. Check your connection and try again.');
        return;
      }
      reset();
      onClose();
      window.open(`/editor/${id}`, '_blank');
    } catch (err) {
      console.error('Create paper error:', err);
      setError('Something went wrong while creating the paper. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={creating}
      size="lg"
      title="Create a new paper"
      description="Add the basics now — you can change any of these later from the editor."
      footer={
        <>
          <button type="button" className="qf-btn qf-btn--secondary" onClick={onClose} disabled={creating}>Cancel</button>
          <button type="submit" form="qf-new-paper" className="qf-btn qf-btn--primary" disabled={creating || !valid}>
            {creating ? <><Loader2 size={16} className="qf-spin" /> Creating…</> : 'Create & open editor'}
          </button>
        </>
      }
    >
      <form id="qf-new-paper" onSubmit={handleCreate} className="qf-form">
        <div className="qf-field">
          <label htmlFor="np-title" className="qf-label">Paper title <span className="qf-required">*</span></label>
          <input
            id="np-title"
            className="qf-input"
            placeholder="e.g. Mid-Term Examination 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <fieldset className="qf-form__group">
          <legend className="qf-form__legend">Class details</legend>
          <div className="qf-grid-2">
            <CreatableSelect id="np-subject" label="Subject" required value={subjectId} onChange={setSubjectId} options={subjects} placeholder="Select subject" onCreate={createSubject} />
            <CreatableSelect id="np-class" label="Class" required value={classId} onChange={setClassId} options={classes} placeholder="Select class" onCreate={createClass} />
          </div>
          <CreatableSelect id="np-course" label="Course" value={courseId} onChange={setCourseId} options={courses} placeholder="Select course" onCreate={createCourse} />
        </fieldset>

        <fieldset className="qf-form__group">
          <legend className="qf-form__legend">Exam details</legend>
          <div className="qf-grid-3">
            <div className="qf-field">
              <label htmlFor="np-date" className="qf-label">Exam date <span className="qf-required">*</span></label>
              <input id="np-date" type="date" className="qf-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="qf-field">
              <label htmlFor="np-duration" className="qf-label">Duration <span className="qf-required">*</span></label>
              <div className="qf-input-suffix">
                <input id="np-duration" type="number" min={1} className="qf-input" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} />
                <span>min</span>
              </div>
            </div>
            <div className="qf-field">
              <label htmlFor="np-marks" className="qf-label">Max marks <span className="qf-required">*</span></label>
              <input id="np-marks" type="number" min={1} className="qf-input" value={maxMarks} onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </fieldset>

        <div className="qf-field">
          <label htmlFor="np-instructions" className="qf-label">General instructions <span className="qf-optional">Optional</span></label>
          <textarea
            id="np-instructions"
            className="qf-input qf-textarea"
            placeholder="e.g. All questions are compulsory. Write neatly."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="qf-form__error" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
}

