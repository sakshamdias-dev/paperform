import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useStore } from './store';
import { supabase } from './supabase';
import { isGuestUser } from './utils/guestWorkspace';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Papers from './pages/dashboard/Papers';
import Schedule from './pages/dashboard/Schedule';
import Notifications from './pages/dashboard/Notifications';
import SettingsPage from './pages/dashboard/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';

const QuestionBank = lazy(() => import('./pages/dashboard/QuestionBank'));
const Editor = lazy(() => import('./pages/Editor'));
const Landing = lazy(() => import('./pages/landing/Landing'));

function RouteLoader() {
  return (
    <div style={{
      minHeight: '45vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(3, 64, 137, 0.14)',
        borderTopColor: '#ff5b0f',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const user = useStore((s) => s.user);

  if (!user?.id) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

function HomeRoute() {
  const user = useStore((s) => s.user);

  if (user?.id && !isGuestUser(user)) {
    return <Navigate to="/" replace />;
  }
  return <Landing />;
}

function App() {
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);
  const fetchQuestionPapers = useStore((s) => s.fetchQuestionPapers);
  // If we already have a persisted user in store, don't show the full-screen blocking loader
  const [loading, setLoading] = useState(() => !useStore.getState().user?.id);

  useEffect(() => {
    let mounted = true;
    let loadedUserId: string | null = useStore.getState().user?.id ?? null;
    let fetchInFlight = false;

    // Function to handle user session and profile
    const handleSession = async (session: Session | null) => {
      if (session?.user) {
        if (loadedUserId === session.user.id || fetchInFlight) {
          if (mounted) setLoading(false);
          return;
        }
        fetchInFlight = true;
        try {
          // Migrate any guest-mode paper/questions before fetching account papers
          await useStore.getState().syncGuestWorkspaceToAccount(session.user.id);

          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, school_name, keep_questions_private, created_at, updated_at')
            .eq('id', session.user.id)
            .maybeSingle();

          const privacyPref = profileData?.keep_questions_private !== undefined
            ? Boolean(profileData.keep_questions_private)
            : localStorage.getItem('questforma_privacy_pref') === 'true';

          if (mounted) {
            loadedUserId = session.user.id;
            setUser({
              id: session.user.id,
              fullName: profileData?.full_name || session.user.email?.split('@')[0] || 'User',
              schoolName: profileData?.school_name || '',
              email: session.user.email || '',
              keepQuestionsPrivate: privacyPref,
              createdAt: profileData?.created_at ? new Date(profileData.created_at).getTime() : Date.now(),
              updatedAt: profileData?.updated_at ? new Date(profileData.updated_at).getTime() : Date.now(),
            });
            // Background pre-fetch without blocking the UI
            void Promise.allSettled([
              fetchQuestionPapers(),
              useStore.getState().fetchCourses(),
              useStore.getState().fetchSubjects(),
              useStore.getState().fetchClasses(),
              useStore.getState().fetchSharedQuestions(),
              useStore.getState().fetchNotifications(),
              useStore.getState().fetchLookups(),
            ]);
          }
        } catch (err) {
          console.error('Profile fetch error:', err);
        } finally {
          fetchInFlight = false;
        }
      } else {
        if (!isGuestUser(useStore.getState().user)) {
          loadedUserId = null;
          if (mounted) logout();
        }
      }
      
      if (mounted) setLoading(false);
    };

    // 1. Initial session check via getSession()
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) {
          void handleSession(session);
        } else {
          // Preserve guest preview session if the user clicked "Create paper"
          if (!isGuestUser(useStore.getState().user)) {
            loadedUserId = null;
            logout();
          }
          setLoading(false);
        }
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
        setTimeout(() => {
          if (mounted) void handleSession(session);
        }, 0);
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setTimeout(() => {
            if (mounted) void handleSession(session);
          }, 0);
        }
      } else if (event === 'SIGNED_OUT') {
        loadedUserId = null;
        if (mounted) {
          logout();
          setLoading(false);
        }
      }
    });

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [setUser, logout, fetchQuestionPapers]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #022652 0%, #034089 100%)' 
      }}>
        <div style={{ 
          width: 44, 
          height: 44, 
          border: '3px solid rgba(255,255,255,0.15)', 
          borderTopColor: '#ff5b0f',
          borderRightColor: '#ffd41f',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/home" element={<HomeRoute />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="papers" element={<Papers />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="question-bank" element={<QuestionBank />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="/editor/:id"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <Editor />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;