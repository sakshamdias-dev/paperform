import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Trash2, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { PageHeader, EmptyState } from './components';
import Dialog from './Dialog';
import { relativeTime, stripHtml } from './utils';

type Filter = 'all' | 'unread';

function dayBucket(ts: number) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

export default function Notifications() {
  const { notifications, markNotificationAsRead, clearNotifications } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const unread = notifications.filter((n) => !n.read);

  const groups = useMemo(() => {
    const list = filter === 'unread' ? unread : notifications;
    const map = new Map<string, typeof list>();
    [...list].sort((a, b) => b.createdAt - a.createdAt).forEach((n) => {
      const k = dayBucket(n.createdAt);
      map.set(k, [...(map.get(k) || []), n]);
    });
    return [...map.entries()];
  }, [notifications, unread, filter]);

  return (
    <div className="qf-stack qf-narrow">
      <PageHeader
        title="Notifications"
        description="Updates about how other teachers are using your shared questions."
        actions={
          <>
            <button type="button" className="qf-btn qf-btn--secondary" disabled={!unread.length} onClick={() => unread.forEach((n) => markNotificationAsRead(n.id))}>
              <CheckCheck size={16} /> Mark all read
            </button>
            <button type="button" className="qf-btn qf-btn--ghost" disabled={!notifications.length} onClick={() => setConfirmClear(true)}>
              <Trash2 size={16} /> Clear all
            </button>
          </>
        }
      />

      <div className="qf-tabs" role="tablist" aria-label="Filter notifications">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`qf-tab ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          All <span className="qf-tab__count">{notifications.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} className={`qf-tab ${filter === 'unread' ? 'is-active' : ''}`} onClick={() => setFilter('unread')}>
          Unread <span className="qf-tab__count">{unread.length}</span>
        </button>
      </div>

      <div className="qf-card qf-card--flush">
        {groups.length === 0 ? (
          <EmptyState
            icon={<Bell size={22} />}
            title={filter === 'unread' ? 'No unread notifications' : 'You’re all caught up'}
            description="When another teacher uses one of your shared questions, you’ll hear about it here."
          />
        ) : (
          groups.map(([label, items]) => (
            <div key={label} className="qf-notif-group">
              <h2 className="qf-notif-group__title">{label}</h2>
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={`qf-notif-item ${n.read ? '' : 'is-unread'}`} onClick={() => !n.read && markNotificationAsRead(n.id)}>
                      <span className="qf-notif-item__icon"><Sparkles size={16} /></span>
                      <span className="qf-notif-item__body">
                        <span className="qf-notif-item__head">
                          <span className="qf-notif-item__title">{n.title}</span>
                          <span className="qf-notif-item__time">{relativeTime(n.createdAt)}</span>
                        </span>
                        <span className="qf-notif-item__msg">{n.message}</span>
                        {n.questionContent && <span className="qf-notif-item__quote">{stripHtml(n.questionContent)}</span>}
                      </span>
                      {!n.read && <span className="qf-notif-item__dot" aria-label="Unread" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        size="sm"
        title="Clear all notifications?"
        description="This removes every notification from your inbox. This can’t be undone."
        footer={
          <>
            <button type="button" className="qf-btn qf-btn--secondary" onClick={() => setConfirmClear(false)} autoFocus>Cancel</button>
            <button type="button" className="qf-btn qf-btn--danger" onClick={() => { clearNotifications(); setConfirmClear(false); }}>Clear all</button>
          </>
        }
      />
    </div>
  );
}

