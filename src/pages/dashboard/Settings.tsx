import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserRound, BookOpen, ShieldCheck, Plus, X, GraduationCap, Users, Bookmark, ListFilter, Tags, Loader2, Check, LogOut, Sun, Moon, Monitor,
} from 'lucide-react';
import { useStore } from '../../store';
import { supabase } from '../../supabase';
import { PageHeader } from './components';
import { initials } from './utils';
import { useColorScheme, type ColorSchemePref } from './theme';

type Tab = 'profile' | 'academic' | 'privacy';

interface Item { id: string; name: string }

function TagManager({
  title, description, icon, items, placeholder, onAdd, onDelete,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: Item[];
  placeholder: string;
  onAdd: (name: string) => Promise<unknown>;
  onDelete: (id: string) => unknown;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) { setValue(''); return; }
    setBusy(true);
    try { await onAdd(name); setValue(''); } finally { setBusy(false); }
  };

  return (
    <section className="qf-card qf-tag-manager">
      <div className="qf-tag-manager__head">
        <span className="qf-tag-manager__icon">{icon}</span>
        <div>
          <h3 className="qf-card__title">{title} <span className="qf-count-pill">{items.length}</span></h3>
          <p className="qf-card__subtitle">{description}</p>
        </div>
      </div>
      <form className="qf-inline-add" onSubmit={add}>
        <input className="qf-input" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Add ${title.toLowerCase()}`} />
        <button type="submit" className="qf-btn qf-btn--secondary qf-btn--sm" disabled={busy || !value.trim()}>
          {busy ? <Loader2 size={14} className="qf-spin" /> : <Plus size={14} />} Add
        </button>
      </form>
      {items.length === 0 ? (
        <p className="qf-tag-manager__empty">Nothing added yet.</p>
      ) : (
        <ul className="qf-tag-list">
          {items.map((i) => (
            <li key={i.id} className="qf-tag">
              <span>{i.name}</span>
              <button type="button" onClick={() => onDelete(i.id)} aria-label={`Remove ${i.name}`}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AppearanceSection() {
  const { pref, systemScheme, setColorScheme } = useColorScheme();
  const options: { value: ColorSchemePref; label: string; sub: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', sub: 'Crisp warm paper', icon: Sun },
    { value: 'dark', label: 'Dark', sub: 'Low-glare midnight', icon: Moon },
    { value: 'light dark', label: 'System', sub: `Currently ${systemScheme}`, icon: Monitor },
  ];

  return (
    <section className="qf-card">
      <div className="qf-card__head">
        <div>
          <h2 className="qf-card__title">Appearance</h2>
          <p className="qf-card__subtitle">Choose how QuestForma looks on this device.</p>
        </div>
      </div>
      <div className="qf-theme-cards" role="radiogroup" aria-label="Color theme">
        {options.map((opt) => {
          const active = pref === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`qf-theme-card ${active ? 'is-active' : ''}`}
              onClick={() => setColorScheme(opt.value)}
            >
              <span className="qf-theme-card__icon"><opt.icon size={18} /></span>
              <span className="qf-theme-card__text">
                <strong>{opt.label}</strong>
                <span>{opt.sub}</span>
              </span>
              {active && <span className="qf-theme-card__check"><Check size={14} strokeWidth={3} /></span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProfileTab() {
  const { user, updateProfile } = useStore();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [schoolName, setSchoolName] = useState(user?.schoolName || '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const dirty = fullName.trim() !== (user?.fullName || '') || schoolName.trim() !== (user?.schoolName || '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setState('saving');
    const ok = await updateProfile({ fullName: fullName.trim(), schoolName: schoolName.trim() });
    setState(ok ? 'saved' : 'error');
    if (ok) setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="qf-stack">
      <section className="qf-card">
        <div className="qf-card__head">
          <div>
            <h2 className="qf-card__title">Profile</h2>
            <p className="qf-card__subtitle">How you and your school appear in QuestForma.</p>
          </div>
        </div>
        <form className="qf-form qf-settings-form" onSubmit={save}>
          <div className="qf-profile-row">
            <span className="qf-avatar qf-avatar--lg">{initials(fullName || user?.fullName)}</span>
            <div>
              <strong>{fullName || 'Your name'}</strong>
              <span className="qf-muted">{user?.email}</span>
            </div>
          </div>
          <div className="qf-grid-2">
            <div className="qf-field">
              <label htmlFor="pf-name" className="qf-label">Full name</label>
              <input id="pf-name" className="qf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="qf-field">
              <label htmlFor="pf-email" className="qf-label">Email</label>
              <input id="pf-email" className="qf-input" value={user?.email || ''} disabled />
            </div>
          </div>
          <div className="qf-field">
            <label htmlFor="pf-school" className="qf-label">School / institution name</label>
            <input id="pf-school" className="qf-input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. St. Xavier’s High School" autoComplete="organization" />
            <span className="qf-hint">Printed at the top of every question paper.</span>
          </div>
          <div className="qf-form__actions">
            {state === 'saved' && <span className="qf-success"><Check size={14} /> Saved</span>}
            {state === 'error' && <span className="qf-form__error">Couldn’t save. Please try again.</span>}
            <button type="submit" className="qf-btn qf-btn--primary" disabled={!dirty || state === 'saving' || !fullName.trim()}>
              {state === 'saving' ? <><Loader2 size={16} className="qf-spin" /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <AppearanceSection />

      <section className="qf-card qf-row-card">
        <div>
          <h2 className="qf-card__title">Sign out</h2>
          <p className="qf-card__subtitle">Sign out of QuestForma on this device.</p>
        </div>
        <button type="button" className="qf-btn qf-btn--secondary" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
      </section>
    </div>
  );
}

function AcademicTab() {
  const s = useStore();
  return (
    <div className="qf-stack">
      <div>
        <h2 className="qf-section-title">Academic setup</h2>
        <p className="qf-muted">These lists power the dropdowns when you create papers and tag questions.</p>
      </div>
      <div className="qf-tag-grid">
        <TagManager title="Subjects" description="e.g. Physics, Mathematics" icon={<BookOpen size={16} />} items={s.subjects} placeholder="Add a subject" onAdd={s.createSubject} onDelete={s.deleteSubject} />
        <TagManager title="Classes" description="e.g. Grade 10, Class XII-B" icon={<Users size={16} />} items={s.classes} placeholder="Add a class" onAdd={s.createClass} onDelete={s.deleteClass} />
        <TagManager title="Courses" description="e.g. CBSE, ICSE, IB" icon={<GraduationCap size={16} />} items={s.courses} placeholder="Add a course" onAdd={s.createCourse} onDelete={s.deleteCourse} />
        <TagManager title="Categories / Streams" description="e.g. Science, Commerce" icon={<Tags size={16} />} items={s.categories} placeholder="Add a category" onAdd={s.createCategory} onDelete={s.deleteCategory} />
        <TagManager title="Chapters" description="Used to tag questions" icon={<Bookmark size={16} />} items={s.chapters} placeholder="Add a chapter" onAdd={(n) => s.createChapter(n)} onDelete={s.deleteChapter} />
        <TagManager title="Topics" description="Finer-grained question tags" icon={<ListFilter size={16} />} items={s.topics} placeholder="Add a topic" onAdd={(n) => s.createTopic(n)} onDelete={s.deleteTopic} />
      </div>
    </div>
  );
}

function PrivacyTab() {
  const { user, toggleKeepQuestionsPrivate } = useStore();
  const isPrivate = !!user?.keepQuestionsPrivate;
  return (
    <section className="qf-card">
      <div className="qf-card__head">
        <div>
          <h2 className="qf-card__title">Privacy &amp; sharing</h2>
          <p className="qf-card__subtitle">Control whether your questions help other teachers.</p>
        </div>
      </div>
      <div className="qf-setting-row">
        <div>
          <label htmlFor="pv-private" className="qf-setting-row__title">Keep my questions private</label>
          <p className="qf-setting-row__desc">
            When off, questions you write are added to the shared Question Bank so other teachers can use them — you’re always credited as the author.
            Turn this on to keep your questions only in your own workspace.
          </p>
        </div>
        <label className="qf-switch">
          <input id="pv-private" type="checkbox" role="switch" checked={isPrivate} onChange={(e) => toggleKeepQuestionsPrivate(e.target.checked)} />
          <span className="qf-switch__track" aria-hidden><span className="qf-switch__thumb" /></span>
        </label>
      </div>
      <div className={`qf-callout ${isPrivate ? '' : 'qf-callout--success'}`}>
        <ShieldCheck size={16} />
        <span>{isPrivate ? 'Your new questions stay private to you.' : 'Your questions are being shared with the community.'}</span>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const user = useStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'academic';

  const tabs: { key: Tab; label: string; icon: typeof UserRound; desc: string }[] = [
    { key: 'academic', label: 'Academic setup', icon: BookOpen, desc: 'Subjects, classes & more' },
    { key: 'profile', label: 'Profile', icon: UserRound, desc: 'Name & school' },
    { key: 'privacy', label: 'Privacy & sharing', icon: ShieldCheck, desc: 'Question sharing' },
  ];

  return (
    <div className="qf-stack">
      <PageHeader title="Settings" description="Manage your profile, academic setup and sharing preferences." />
      <div className="qf-settings">
        <nav className="qf-settings__nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`qf-settings__link ${tab === t.key ? 'is-active' : ''}`}
              aria-current={tab === t.key ? 'page' : undefined}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
            >
              <t.icon size={18} />
              <span>
                <span className="qf-settings__link-label">{t.label}</span>
                <span className="qf-settings__link-desc">{t.desc}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="qf-settings__content">
          {tab === 'profile' && <ProfileTab key={`${user?.id || ''}:${user?.fullName || ''}:${user?.schoolName || ''}`} />}
          {tab === 'academic' && <AcademicTab />}
          {tab === 'privacy' && <PrivacyTab />}
        </div>
      </div>
    </div>
  );
}

