import { useEffect, useState } from 'react';
import { Loader2, X, FileDown, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '../supabase';
import { useStore } from '../store';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

export default function SignInModal({
  open,
  onClose,
  onSuccess,
  title = 'Sign in to export your PDF',
  subtitle = 'Your paper and questions will be saved to your QuestForma account, and your print-ready PDF will download immediately.',
  ctaLabel,
}: SignInModalProps) {
  const setUser = useStore((s) => s.setUser);
  const syncGuestWorkspaceToAccount = useStore((s) => s.syncGuestWorkspaceToAccount);
  const fetchQuestionPapers = useStore((s) => s.fetchQuestionPapers);
  const fetchCourses = useStore((s) => s.fetchCourses);
  const fetchSubjects = useStore((s) => s.fetchSubjects);
  const fetchClasses = useStore((s) => s.fetchClasses);
  const fetchQuestions = useStore((s) => s.fetchQuestions);
  const fetchLookups = useStore((s) => s.fetchLookups);

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const completeSession = async (sessionUser: { id: string; email?: string }) => {
    await syncGuestWorkspaceToAccount(sessionUser.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, school_name, keep_questions_private, created_at, updated_at')
      .eq('id', sessionUser.id)
      .maybeSingle();

    const privacyPref =
      profileData?.keep_questions_private !== undefined
        ? Boolean(profileData.keep_questions_private)
        : localStorage.getItem('questforma_privacy_pref') === 'true';

    setUser({
      id: sessionUser.id,
      fullName: profileData?.full_name || name.trim() || sessionUser.email?.split('@')[0] || 'User',
      schoolName: profileData?.school_name || schoolName.trim() || '',
      email: sessionUser.email || email.trim(),
      keepQuestionsPrivate: privacyPref,
      createdAt: profileData?.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
      updatedAt: profileData?.updated_at ? new Date(profileData.updated_at).getTime() : Date.now(),
    });

    await Promise.allSettled([
      fetchCourses(),
      fetchSubjects(),
      fetchClasses(),
      fetchQuestionPapers(),
      fetchQuestions(),
      fetchLookups(),
    ]);

    onClose();
    onSuccess?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              school_name: schoolName.trim(),
            },
          },
        });
        if (signUpError) throw signUpError;

        if (data.session?.user) {
          await completeSession(data.session.user);
        } else {
          setNotice('Account created! Please check your email to confirm your address, then sign in to export.');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        if (data.session?.user) {
          await completeSession(data.session.user);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(11, 27, 51, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qf-signin-modal-title"
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#ffffff',
          color: '#0b1b33',
          borderRadius: 20,
          border: '1px solid #e7ebf1',
          boxShadow: '0 32px 72px -20px rgba(11, 27, 51, 0.38)',
          padding: '28px 28px 24px',
          position: 'relative',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close sign in popup"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            color: '#6b778c',
            background: '#f6f8fb',
            border: '1px solid #e7ebf1',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#eef4fc',
              color: '#034089',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <FileDown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#034089' }}>
              QuestForma
            </div>
            <h2 id="qf-signin-modal-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#0b1b33' }}>
              {title}
            </h2>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: '#6b778c' }}>
          {subtitle}
        </p>

        {/* Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 4,
            borderRadius: 11,
            background: '#f4f6fa',
            border: '1px solid #e7ebf1',
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); setNotice(''); }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              background: !isSignUp ? '#ffffff' : 'transparent',
              color: !isSignUp ? '#0b1b33' : '#6b778c',
              boxShadow: !isSignUp ? '0 1px 3px rgba(11,27,51,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); setNotice(''); }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              background: isSignUp ? '#ffffff' : 'transparent',
              color: isSignUp ? '#0b1b33' : '#6b778c',
              boxShadow: isSignUp ? '0 1px 3px rgba(11,27,51,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ padding: '10px 12px', borderRadius: 9, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontSize: 13, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          {isSignUp && (
            <>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#33415a' }}>Your Name</span>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    background: '#f9fafc',
                    color: '#0b1b33',
                    border: '1px solid #dce2ec',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#33415a' }}>Institution Name (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Greenfield International School"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  style={{
                    background: '#f9fafc',
                    color: '#0b1b33',
                    border: '1px solid #dce2ec',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </label>
            </>
          )}

          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#33415a' }}>Email</span>
            <input
              type="email"
              required
              autoFocus
              placeholder="teacher@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                background: '#f9fafc',
                color: '#0b1b33',
                border: '1px solid #dce2ec',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#33415a' }}>Password</span>
            <input
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                background: '#f9fafc',
                color: '#0b1b33',
                border: '1px solid #dce2ec',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 11,
              background: '#034089',
              color: '#ffffff',
              fontSize: 14.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <>
                <Lock size={15} />
                <span>{ctaLabel || (isSignUp ? 'Create Account & Export PDF' : 'Sign In & Export PDF')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

