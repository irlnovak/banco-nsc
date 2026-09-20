import { Loader2 } from 'lucide-react';

export default function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Loader2 size={34} className="spin" style={{ animation: 'spin 0.9s linear infinite', color: 'var(--azul)' }} />
      <span>{label}</span>
    </div>
  );
}
