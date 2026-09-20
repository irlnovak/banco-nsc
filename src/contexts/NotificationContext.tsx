import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  message?: string;
}

interface NotificationContextValue {
  notify: (type: NotificationType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

let nextId = 1;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const notify = useCallback(
    (type: NotificationType, title: string, message?: string) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-4), { id, type, title, message }]);
      timers.current[id] = setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const value: NotificationContextValue = {
    notify,
    success: (t, m) => notify('success', t, m),
    error: (t, m) => notify('error', t, m),
    info: (t, m) => notify('info', t, m),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notif-container" role="status" aria-live="polite">
        {items.map((n) => (
          <div key={n.id} className={`notif notif-${n.type}`}>
            <span className="notif-icon">
              {n.type === 'success' ? <CheckCircle2 size={20} /> : n.type === 'error' ? <AlertCircle size={20} /> : <Info size={20} />}
            </span>
            <div className="notif-body">
              <strong>{n.title}</strong>
              {n.message && <p>{n.message}</p>}
            </div>
            <button className="notif-close" onClick={() => remove(n.id)} aria-label="Fechar notificação">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
  return ctx;
}
