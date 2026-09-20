import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getTransactionsByUser } from '../services/databaseService';
import { parseBRLToCentavos } from '../utils/money';
import TransactionItem from '../components/TransactionItem';
import EmptyState from '../components/EmptyState';
import ReceiptModal from '../components/ReceiptModal';
import type { Transaction, TransactionCategory } from '../types';
import { Inbox } from 'lucide-react';

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

export default function Extrato() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [filtro, setFiltro] = useState<'todas' | TransactionCategory>('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [detalhe, setDetalhe] = useState<Transaction | null>(null);

  const all = useMemo(() => (user ? getTransactionsByUser(user.id) : []), [user]);

  // Abre o detalhe automaticamente quando vem de /app/extrato?tx=ID
  useEffect(() => {
    const id = params.get('tx');
    if (id && user) {
      const found = all.find((t) => t.id === id);
      if (found) setDetalhe(found);
    }
  }, [params, all, user]);

  const minCentavos = valorMin ? parseBRLToCentavos(valorMin) : null;

  const filtered = all.filter((t) => {
    if (filtro === 'entrada' && t.direction !== 'in') return false;
    if (filtro === 'saida' && t.direction !== 'out') return false;
    if (filtro !== 'todas' && filtro !== 'entrada' && filtro !== 'saida' && t.category !== filtro) return false;
    if (dataInicio) {
      const start = new Date(dataInicio + 'T00:00:00').getTime();
      if (t.createdAt < start) return false;
    }
    if (dataFim) {
      const end = new Date(dataFim + 'T23:59:59').getTime();
      if (t.createdAt > end) return false;
    }
    if (minCentavos !== null && minCentavos > 0 && t.amount < minCentavos) return false;
    return true;
  });

  if (!user) return null;

  return (
    <>
      <h1 className="page-title">Extrato financeiro</h1>
      <p className="page-subtitle">Todas as suas movimentações virtuais, com filtros e comprovantes.</p>

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${filtro === f.key ? 'active' : ''}`} onClick={() => setFiltro(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="di">Data inicial</label>
            <input id="di" type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="df">Data final</label>
            <input id="df" type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="vm">Valor mínimo (R$)</label>
            <input id="vm" className="input" inputMode="decimal" placeholder="0,00" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
          </div>
        </div>
        {(dataInicio || dataFim || valorMin || filtro !== 'todas') && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDataInicio('');
              setDataFim('');
              setValorMin('');
              setFiltro('todas');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Inbox size={22} />} title="Nenhuma movimentação encontrada" message="Ajuste os filtros ou realize novas operações." />
        </div>
      ) : (
        <div className="tx-list">
          {filtered.map((tx) => (
            <TransactionItem key={tx.id} tx={tx} onDetails={setDetalhe} />
          ))}
        </div>
      )}

      <p className="text-muted mt-2 center">Exibindo {filtered.length} de {all.length} movimentações.</p>

      <ReceiptModal transaction={detalhe ?? null} onClose={() => setDetalhe(null)} />
    </>
  );
}
