import { useMemo, useState } from 'react';
import { getAllTransactions, getAllUsers } from '../../services/databaseService';
import { formatBRL, formatDate, formatTime } from '../../utils/money';
import ReceiptModal from '../../components/ReceiptModal';
import EmptyState from '../../components/EmptyState';
import type { Transaction, TransactionCategory, TransactionType } from '../../types';
import { ListOrdered, Search } from 'lucide-react';

const FILTERS: { key: 'todas' | TransactionCategory; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'entrada', label: 'Entradas' },
  { key: 'saida', label: 'Saídas' },
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boletos' },
  { key: 'dizimo', label: 'Dízimos' },
  { key: 'taxa', label: 'Taxas' },
  { key: 'transferencia', label: 'Transferências' },
];

const TYPE_LABELS: Record<TransactionType, string> = {
  deposito: 'Depósito',
  pix_enviado: 'Pix enviado',
  pix_recebido: 'Pix recebido',
  boleto: 'Boleto',
  dizimo: 'Dízimo',
  taxa: 'Taxa',
  transferencia: 'Transferência',
  salario: 'Salário semanal',
  admin_credito: 'Crédito do admin',
  admin_debito: 'Débito do admin',
};

export default function AdminTransactions() {
  const [filtro, setFiltro] = useState<'todas' | TransactionCategory>('todas');
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);

  const users = useMemo(() => getAllUsers(), []);
  const all = useMemo(() => getAllTransactions(), []);

  const userName = (id: string) => users.find((u) => u.id === id)?.nomeCompleto ?? '—';

  const filtered = all.filter((t) => {
    if (filtro === 'entrada' && t.direction !== 'in') return false;
    if (filtro === 'saida' && t.direction !== 'out') return false;
    if (filtro !== 'todas' && filtro !== 'entrada' && filtro !== 'saida' && t.category !== filtro) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const haystack = `${t.description} ${t.id} ${userName(t.userId)} ${t.pixKey ?? ''} ${t.reference ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <h1 className="page-title">Transações</h1>
      <p className="page-subtitle">{all.length} movimentações registradas no sistema.</p>

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${filtro === f.key ? 'active' : ''}`} onClick={() => setFiltro(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 380 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--cinza-texto)' }} />
          <input className="input" placeholder="Buscar por descrição, ID, usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<ListOrdered size={22} />} title="Nenhuma transação encontrada" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Usuário</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data/Hora</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td><code style={{ fontSize: '0.72rem' }}>{t.id}</code></td>
                  <td>{userName(t.userId)}</td>
                  <td>{TYPE_LABELS[t.type]}</td>
                  <td>{t.description}</td>
                  <td style={{ color: t.direction === 'in' ? 'var(--verde)' : 'var(--vermelho)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.createdAt)} {formatTime(t.createdAt)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetalhe(t)}>Ver comprovante</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted mt-2">Exibindo {filtered.length} de {all.length}.</p>
      <ReceiptModal transaction={detalhe} onClose={() => setDetalhe(null)} />
    </>
  );
}
