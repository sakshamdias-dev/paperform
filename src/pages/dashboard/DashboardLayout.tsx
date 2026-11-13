import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard, FileText, CalendarDays, Library, Bell, Settings, Plus, Search, LogIn,
  PanelLeftClose, PanelLeftOpen, ChevronsUpDown, UserRound, CheckCheck, Sun, Moon, ArrowLeft,
} from 'lucide-react';
import { useStore } from '../../store';
import { isGuestUser } from '../../utils/guestWorkspace';
import SignInModal from '../../components/SignInModal';
import NewPaperDialog from './NewPaperDialog';
import Menu, { useClickOutside } from './Menu';
import { initials, relativeTime, cleanNotificationMessage } from './utils';
import { toggleColorScheme } from './theme';
import './dashboard.css';

export interface DashboardContext {
  openNewPaper: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  return useOutletContext<DashboardContext>();
}

function NotificationsPopover() {
  const navigate = useNavigate();
  const { notifications, markNotificationAsRead } = useStore();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(open, close);
  const unread = notifications.filter((n) => !n.read);

  const markAll = () => unread.forEach((n) => markNotificationAsRead(n.id));

  return (
    <div className="qf-menu" ref={ref}>
      <button
        type="button"
        className={`qf-icon-btn qf-icon-btn--bordered ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread.length > 0 && <span className="qf-dot-badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="qf-menu__panel qf-menu__panel--end qf-notif-popover">
          <div className="qf-notif-popover__head">
            <strong>Notifications</strong>
            {unread.length > 0 && (
              <button type="button" className="qf-link-btn" onClick={markAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="qf-notif-popover__list">
            {notifications.length === 0 ? (
              <div className="qf-notif-popover__empty">
                <Bell size={20} />
                <span>You’re all caught up</span>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={`qf-notif-row ${n.read ? '' : 'is-unread'}`}
                  onClick={() => markNotificationAsRead(n.id)}
                >
                  <span className="qf-notif-row__dot" aria-hidden />
                  <span className="qf-notif-row__body">
                    <span className="qf-notif-row__title">{n.title}</span>
                    <span className="qf-notif-row__msg">{cleanNotificationMessage(n.message)}</span>
                    <span className="qf-notif-row__time">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            className="qf-notif-popover__footer"
            onClick={() => { setOpen(false); navigate('/dashboard/notifications'); }}
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const {
    user, questionPapers, notifications,
    fetchQuestionPapers, fetchCourses, fetchSubjects, fetchClasses, fetchNotifications, fetchLookups, fetchQuestions, fetchSharedQuestions,
  } = useStore();
  const [showNewPaper, setShowNewPaper] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const isGuest = isGuestUser(user);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 900 : true));
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchQuestionPapers();
    fetchCourses();
    fetchSubjects();
    fetchClasses();
    fetchNotifications();
    fetchLookups();
    fetchQuestions();
    fetchSharedQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  // "/" focuses search, like most modern SaaS apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;
  const openNewPaper = useCallback(() => setShowNewPaper(true), []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/dashboard/papers?q=${encodeURIComponent(q)}` : '/dashboard/papers');
    searchRef.current?.blur();
  };

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/papers', label: 'My Papers', icon: FileText, count: questionPapers.length },
    { to: '/dashboard/schedule', label: 'Exam Schedule', icon: CalendarDays },
    { to: '/dashboard/question-bank', label: 'Question Bank', icon: Library },
    { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, count: unread, highlight: unread > 0 },
  ];

  return (
    <div className={`qf-app ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-closed'}`}>
      <aside className="qf-sidebar" aria-label="Main navigation">
        <div className="qf-sidebar__brand">
          <img src="/questforma-q.svg" alt="" className="qf-sidebar__logo" />
          <span className="qf-sidebar__name">QuestForma</span>
          <button
            type="button"
            className="qf-icon-btn qf-sidebar__toggle"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="qf-sidebar__cta">
          <button type="button" className="qf-btn qf-btn--primary qf-btn--block" onClick={openNewPaper}>
            <Plus size={16} strokeWidth={2.5} /> New paper
          </button>
        </div>

        <nav className="qf-sidebar__nav">
          <span className="qf-sidebar__section">Workspace</span>
          {navItems.map(({ to, label, icon: Icon, end, count, highlight }) => (
            <NavLink key={to} to={to} end={end} onClick={closeOnMobile} className={({ isActive }) => `qf-nav-item ${isActive ? 'is-active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
              {!!count && <span className={`qf-nav-item__count ${highlight ? 'is-highlight' : ''}`}>{count}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="qf-sidebar__bottom">
          <NavLink to="/dashboard/settings" onClick={closeOnMobile} className={({ isActive }) => `qf-nav-item ${isActive ? 'is-active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>

          <Menu
            align="start"
            placement="top"
            header={
              <div className="qf-menu__header">
                <span className="qf-menu__header-name">{user?.fullName}</span>
                <span className="qf-menu__header-email">{isGuest ? 'Preview mode · Sign in to export' : user?.email}</span>
              </div>
            }
            items={
              isGuest
                ? [
                  { label: 'Sign in', icon: <LogIn size={16} />, onSelect: () => setShowSignInModal(true) },
                  'divider',
                  { label: 'Profile', icon: <UserRound size={16} />, onSelect: () => navigate('/dashboard/settings?tab=profile') },
                  { label: 'Settings', icon: <Settings size={16} />, onSelect: () => navigate('/dashboard/settings') },
                ]
                : [
                  { label: 'Profile', icon: <UserRound size={16} />, onSelect: () => navigate('/dashboard/settings?tab=profile') },
                  { label: 'Settings', icon: <Settings size={16} />, onSelect: () => navigate('/dashboard/settings') },
                ]
            }
            trigger={({ open, toggle }) => (
              <button type="button" className={`qf-user-chip ${open ? 'is-active' : ''}`} onClick={toggle} aria-expanded={open}>
                <span className="qf-avatar">{initials(user?.fullName)}</span>
                <span className="qf-user-chip__info">
                  <span className="qf-user-chip__name">{user?.fullName || 'Teacher'}</span>
                  <span className="qf-user-chip__sub">{isGuest ? 'Preview mode' : (user?.schoolName || user?.email)}</span>
                </span>
                <ChevronsUpDown size={16} className="qf-user-chip__chev" />
              </button>
            )}
          />
        </div>
      </aside>

      {sidebarOpen && <div className="qf-scrim" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <div className="qf-main">
        <header className="qf-topbar">
          {!sidebarOpen && (
            <button
              type="button"
              className="qf-icon-btn qf-icon-btn--bordered"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
          <form className="qf-search" role="search" onSubmit={handleSearch}>
            <Search size={16} className="qf-search__icon" />
            <input
              ref={searchRef}
              type="search"
              className="qf-search__input"
              placeholder="Search papers…"
              aria-label="Search papers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="qf-kbd">/</kbd>
          </form>
          <div className="qf-topbar__actions">
            {isGuest && (
              <button
                type="button"
                className="qf-btn qf-btn--secondary qf-btn--sm"
                onClick={() => setShowSignInModal(true)}
                title="Sign in or create an account"
              >
                <LogIn size={14} /> Sign in
              </button>
            )}
            <button
              type="button"
              className="qf-icon-btn qf-icon-btn--bordered qf-theme-toggle"
              onClick={toggleColorScheme}
              title="Toggle light / dark mode"
            >
              <span className="qf-theme-toggle__dark">
                <Moon size={17} />
                <span className="sr-only">Switch to dark theme</span>
              </span>
              <span className="qf-theme-toggle__light">
                <Sun size={17} />
                <span className="sr-only">Switch to light theme</span>
              </span>
            </button>
            <NotificationsPopover />
          </div>
        </header>

        <main className="qf-page">
          <Outlet context={{ openNewPaper } satisfies DashboardContext} />
        </main>
      </div>

      <NewPaperDialog open={showNewPaper} onClose={() => setShowNewPaper(false)} />
      {isGuest && (
        <button
          type="button"
          className="qf-floating-lp-btn"
          onClick={() => navigate('/')}
          title="Back to Home"
        >
          <ArrowLeft size={15} />
          <span>Back to Home</span>
        </button>
      )}
      <SignInModal
        open={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        title="Sign in to save your workspace"
        subtitle="Sign in or create a free account to keep your papers and export print-ready PDFs anytime."
        ctaLabel="Sign In & Save Workspace"
      />
    </div>
  );
}

