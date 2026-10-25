import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Copy, Edit, FolderOpen, LogOut, Loader2, BookOpen, Users, GraduationCap, Search, Lock, Bell, Bookmark, Tags, ListFilter } from 'lucide-react';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    questionPapers,
    courses,
    subjects,
    classes,
    chapters,
    topics,
    categories,
    notifications,
    fetchCourses,
    fetchSubjects,
    fetchClasses,
    fetchQuestionPapers,
    fetchNotifications,
    fetchLookups,
    markNotificationAsRead,
    clearNotifications,
    createQuestionPaper,
    deleteQuestionPaper,
    duplicateQuestionPaper,
    createCourse,
    createSubject,
    createClass,
    createChapter,
    deleteChapter,
    createTopic,
    deleteTopic,
    createCategory,
    deleteCategory,
  } = useStore();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // New Paper form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState(100);
  const [newCourseId, setNewCourseId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newDuration, setNewDuration] = useState(180);
  const [creating, setCreating] = useState(false);

  // Settings form state
  const [settingsTab, setSettingsTab] = useState<'courses' | 'subjects' | 'classes' | 'chapters' | 'topics' | 'categories' | 'privacy'>('courses');
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const toggleKeepQuestionsPrivate = useStore((s) => s.toggleKeepQuestionsPrivate);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionPapers();
    fetchCourses();
    fetchSubjects();
    fetchClasses();
    fetchNotifications();
    fetchLookups();
  }, []);

  const filteredPapers = useMemo(() => {
    return questionPapers
      .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => !courseFilter || p.courseId === courseFilter)
      .filter((p) => !subjectFilter || p.subjectId === subjectFilter)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [questionPapers, search, courseFilter, subjectFilter]);

  const handleCreatePaper = async () => {
    if (
      newTitle.trim() &&
      newSubjectId &&
      newClassId &&
      newMaxMarks > 0 &&
      newDate &&
      newDuration > 0
    ) {
      setCreating(true);
      try {
        const id = await createQuestionPaper(
          newTitle.trim(),
          newDate || undefined,
          newMaxMarks,
          newCourseId || undefined,
          newSubjectId || undefined,
          newClassId || undefined,
          newInstructions || undefined,
          newDuration || undefined
        );
        
        if (!id) {
          alert('Failed to create paper. Please check your database connection and try again.');
          setCreating(false);
          return;
        }

        setShowNewModal(false);
        setNewTitle('');
        setNewDate('');
        setNewMaxMarks(100);
        setNewCourseId('');
        setNewSubjectId('');
        setNewClassId('');
        setNewInstructions('');
        setNewDuration(180);
        navigate(`/editor/${id}`);
      } catch (err) {
        console.error('Create paper error:', err);
        alert('Failed to create paper. Please try again.');
      } finally {
        setCreating(false);
      }
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    setAddingItem(true);

    try {
      if (settingsTab === 'courses') {
        await createCourse(newItemName.trim());
      } else if (settingsTab === 'subjects') {
        await createSubject(newItemName.trim());
      } else if (settingsTab === 'classes') {
        await createClass(newItemName.trim());
      } else if (settingsTab === 'chapters') {
        await createChapter(newItemName.trim());
      } else if (settingsTab === 'topics') {
        await createTopic(newItemName.trim());
      } else if (settingsTab === 'categories') {
        await createCategory(newItemName.trim());
      }
      setNewItemName('');
    } finally {
      setAddingItem(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicateQuestionPaper(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteQuestionPaper(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCourseName = (id?: string) => courses.find(c => c.id === id)?.name || '-';
  const getSubjectName = (id?: string) => subjects.find(s => s.id === id)?.name || '-';
  const getClassName = (id?: string) => classes.find(c => c.id === id)?.name || '-';

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <img src="/questforma-q.svg" alt="QuestForma Logo" />
            </div>
            <span className="logo-text">QuestForma</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className="new-paper-btn" onClick={() => setShowNewModal(true)} style={{ marginBottom: 16 }}>
            <Plus size={20} />
            <span>New Paper</span>
          </button>
          <div className="nav-item active">
            <FolderOpen size={20} />
            <span>My Papers</span>
          </div>
          <div className="nav-item" onClick={() => setShowSettingsModal(true)}>
            <BookOpen size={20} />
            <span>Paper Details</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.fullName || 'User'}</span>
              <span className="user-email">{user?.email}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="dashboard">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">My Question Papers</h1>
              <p className="dashboard-subtitle">Welcome back, {user?.fullName}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="filters">
                <div className="search-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search papers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                  <option value="">All Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Notifications bell button with dropdown */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button
                  className="notif-bell-btn"
                  onClick={() => setShowNotifications(!showNotifications)}
                  title="Notifications"
                >
                  <Bell size={18} color="#034089" />
                  {unreadNotifCount > 0 && (
                    <span className="notif-badge-count">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">
                      <div className="notifications-header-title">
                        <Bell size={16} color="#034089" />
                        <span>Notifications</span>
                        {unreadNotifCount > 0 && (
                          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                            ({unreadNotifCount} new)
                          </span>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <button
                          className="hover-action-btn"
                          onClick={() => clearNotifications()}
                          style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="notifications-list">
                      {notifications.length === 0 ? (
                        <div className="notifications-empty">
                          <Bell size={24} style={{ opacity: 0.35, marginBottom: 4 }} />
                          <span>No notifications yet</span>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            className={`notification-item ${!n.read ? 'unread' : ''}`}
                            onClick={() => markNotificationAsRead(n.id)}
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: 'var(--text-primary)' }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                              {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {filteredPapers.length === 0 ? (
            <div className="empty-paper">
              <div className="empty-paper-icon">
                <FileText size={28} />
              </div>
              <h3>No question papers yet</h3>
              <p>Create your first exam paper to get started</p>
            </div>
          ) : (
            <div className="paper-grid">
              {filteredPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="paper-card"
                  onClick={() => navigate(`/editor/${paper.id}`)}
                >
                  <div className="paper-preview">
                    <div className="paper-preview-inner">
                      <div className="paper-preview-header">{getCourseName(paper.courseId)}</div>
                      <div>{paper.title}</div>
                    </div>
                  </div>
                  <div className="paper-card-content">
                    <h3 className="paper-title">{paper.title}</h3>
                    <div className="paper-meta">
                      <span className="paper-tag">{getSubjectName(paper.subjectId)}</span>
                      <span className="paper-tag">{getClassName(paper.classId)}</span>
                    </div>
                    <p className="paper-date">
                      {paper.qpCode} • {formatDate(paper.date)} • {paper.maxMarks || 0} marks
                    </p>
                    <div className="paper-actions">
                      <button
                        className="paper-action-btn primary"
                        onClick={(e) => { e.stopPropagation(); navigate(`/editor/${paper.id}`); }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        className="paper-action-btn secondary"
                        onClick={(e) => handleDuplicate(e, paper.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="paper-action-btn danger"
                        onClick={(e) => handleDelete(e, paper.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Paper Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Question Paper</h2>
            </div>
            <div className="modal-content" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="property-field">
                <label className="property-label">Paper Title *</label>
                <input
                  type="text"
                  className="property-input"
                  placeholder="e.g., Mid-Term Examination"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Course (Optional)</label>
                  <select
                    className="property-input"
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                  >
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="property-field">
                  <label className="property-label">Subject *</label>
                  <select
                    className="property-input"
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Class *</label>
                  <select
                    className="property-input"
                    value={newClassId}
                    onChange={(e) => setNewClassId(e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="property-field">
                  <label className="property-label">Max Marks *</label>
                  <input
                    type="number"
                    className="property-input"
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(parseInt(e.target.value) || 100)}
                    min={1}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="property-field">
                  <label className="property-label">Date *</label>
                  <input
                    type="date"
                    className="property-input"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="property-field">
                  <label className="property-label">Duration (minutes) *</label>
                  <input
                    type="number"
                    className="property-input"
                    value={newDuration}
                    onChange={(e) => setNewDuration(parseInt(e.target.value) || 180)}
                    min={1}
                  />
                </div>
              </div>
              <div className="property-field">
                <label className="property-label">Instructions (Optional)</label>
                <textarea
                  className="property-textarea"
                  placeholder="General instructions for the exam..."
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  style={{ minHeight: 60 }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)} disabled={creating}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreatePaper}
                disabled={creating || !newTitle.trim() || !newSubjectId || !newClassId || !newDate}
              >
                {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Paper'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">Paper Details</h2>
            </div>
            <div className="modal-content">
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                  className={`btn ${settingsTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('courses')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <GraduationCap size={16} style={{ marginRight: 6 }} />
                  Courses
                </button>
                <button
                  className={`btn ${settingsTab === 'subjects' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('subjects')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <BookOpen size={16} style={{ marginRight: 6 }} />
                  Subjects
                </button>
                <button
                  className={`btn ${settingsTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('classes')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <Users size={16} style={{ marginRight: 6 }} />
                  Classes
                </button>
                <button
                  className={`btn ${settingsTab === 'chapters' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('chapters')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <Bookmark size={16} style={{ marginRight: 6 }} />
                  Chapters
                </button>
                <button
                  className={`btn ${settingsTab === 'topics' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('topics')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <ListFilter size={16} style={{ marginRight: 6 }} />
                  Topics
                </button>
                <button
                  className={`btn ${settingsTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('categories')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <Tags size={16} style={{ marginRight: 6 }} />
                  Categories / Streams
                </button>
                <button
                  className={`btn ${settingsTab === 'privacy' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsTab('privacy')}
                  style={{ fontSize: 13, padding: '6px 12px' }}
                >
                  <Lock size={16} style={{ marginRight: 6 }} />
                  Privacy & Sharing
                </button>
              </div>

              {settingsTab !== 'privacy' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="property-input"
                      placeholder={`Add new ${settingsTab === 'categories' ? 'category / stream' : settingsTab.slice(0, -1)}...`}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleAddItem} disabled={addingItem}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'privacy' && (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, padding: 16, backgroundColor: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>Keep my questions private</h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        When disabled (default), questions you create and edit are automatically synced to QuestForma's shared question bank for peer teachers to discover, citing you as the original author. Enable this setting if you wish to keep your authored questions exclusively in your private workspace.
                      </p>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={user?.keepQuestionsPrivate || false}
                        onChange={(e) => toggleKeepQuestionsPrivate(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: user?.keepQuestionsPrivate ? 'var(--primary-color, #2563eb)' : '#cbd5e1',
                          borderRadius: 24, transition: '.3s'
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute', content: '""', height: 18, width: 18, left: user?.keepQuestionsPrivate ? 22 : 3, bottom: 3,
                            backgroundColor: 'white', borderRadius: '50%', transition: '.3s'
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {settingsTab === 'courses' && courses.map((c) => (
                  <span key={c.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {c.name}
                    <button
                      onClick={() => useStore.getState().deleteCourse(c.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'subjects' && subjects.map((s) => (
                  <span key={s.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {s.name}
                    <button
                      onClick={() => useStore.getState().deleteSubject(s.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'classes' && classes.map((c) => (
                  <span key={c.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {c.name}
                    <button
                      onClick={() => useStore.getState().deleteClass(c.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'chapters' && chapters.map((ch) => (
                  <span key={ch.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {ch.name}
                    <button
                      onClick={() => deleteChapter(ch.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'topics' && topics.map((tp) => (
                  <span key={tp.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {tp.name}
                    <button
                      onClick={() => deleteTopic(tp.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'categories' && categories.map((cat) => (
                  <span key={cat.id} className="paper-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
                    {cat.name}
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)', padding: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {settingsTab === 'courses' && courses.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No courses yet. Add one above.</p>
                )}
                {settingsTab === 'subjects' && subjects.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No subjects yet. Add one above.</p>
                )}
                {settingsTab === 'classes' && classes.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No classes yet. Add one above.</p>
                )}
                {settingsTab === 'chapters' && chapters.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No chapters yet. Add one above.</p>
                )}
                {settingsTab === 'topics' && topics.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No topics yet. Add one above.</p>
                )}
                {settingsTab === 'categories' && categories.length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No categories yet. Add one above.</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Paper</h2>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to delete this paper? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}