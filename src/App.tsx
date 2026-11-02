import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { supabase } from './supabase';
import Login from './pages/Login';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Papers from './pages/dashboard/Papers';
import Schedule from './pages/dashboard/Schedule';
import QuestionBank from './pages/dashboard/QuestionBank';
import Notifications from './pages/dashboard/Notifications';
import SettingsPage from './pages/dashboard/Settings';
import Editor from './pages/Editor';

import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);
  const fetchQuestionPapers = useStore((s) => s.fetchQuestionPapers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let loadedUserId: string | null = useStore.getState().user?.id ?? null;
    let fetchInFlight = false;

    // Function to handle user session and profile
    const handleSession = async (session: any) => {
      if (session?.user) {
        if (loadedUserId === session.user.id || fetchInFlight) {
          if (mounted) setLoading(false);
          return;
        }
        fetchInFlight = true;
        try {
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
            await Promise.allSettled([
              fetchQuestionPapers(),
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
        loadedUserId = null;
        if (mounted) logout();
      }
      
      if (mounted) setLoading(false);
    };

    // Listen for auth changes (INITIAL_SESSION fires automatically on registration)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Defer out of GoTrue's internal auth lock before making Supabase DB queries
        setTimeout(() => {
          if (mounted) void handleSession(session);
        }, 0);
      } else if (event === 'TOKEN_REFRESHED') {
        if (!loadedUserId && session?.user) {
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
    }, 5000);

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
      <Routes>
        <Route path="/login" element={user?.id ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={user?.id ? <DashboardLayout /> : <Navigate to="/login" replace />}>
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
            user?.id ? (
              <ErrorBoundary>
                <Editor />
              </ErrorBoundary>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;