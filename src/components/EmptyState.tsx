export default function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="empty-state">
      {icon && <div className="feature-icon">{icon}</div>}
      <strong style={{ color: '#1c2b3a' }}>{title}</strong>
      {message && <p className="text-muted mt-1">{message}</p>}
    </div>
  );
}
