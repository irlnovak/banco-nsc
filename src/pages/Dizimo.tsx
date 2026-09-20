import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { performOperation } from '../services/databaseService';
import { formatBRL, parseBRLToCentavos } from '../utils/money';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptModal from '../components/ReceiptModal';
import type { Transaction } from '../types';
import { HandCoins } from 'lucide-react';

export default function Dizimo() {
  const { user, refreshUser } = useAuth();
  const notify = useNotifications();
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  if (!user) return null;
  const centavos = parseBRLToCentavos(valor) ?? 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (centavos <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (centavos > user.balance) {
      setError('Saldo insuficiente para esta contribuição.');
      return;
    }
    setConfirmOpen(true);
  };

  const confirm = async () => {
    setLoading(true);
    const result = await performOperation({
      userId: user.id,
      type: 'dizimo',
      category: 'dizimo',
      description: observacao.trim()
        ? `Dízimo — ${observacao.trim()}`
        : 'Dízimo — Paróquia Nossa Senhora da Conceição',
      amount: centavos,
      direction: 'out',
      receiverName: 'Paróquia Nossa Senhora da Conceição',
      reference: data,
    });
    setLoading(false);
    if (result.error || !result.transaction) {
      setConfirmOpen(false);
      notify.error('Erro na operação', result.error ?? 'Tente novamente.');
      return;
    }
    setConfirmOpen(false);
    setReceipt(result.transaction);
    await refreshUser();
    notify.success('Dízimo registrado com sucesso.', 'Obrigado pela sua contribuição. 🙏');
    setValor('');
    setObservacao('');
  };

  return (
    <>
      <h1 className="page-title">Dízimo</h1>
      <p className="page-subtitle">Contribua com a manutenção da Paróquia Nossa Senhora da Conceição (valores virtuais).</p>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="valor">Valor (R$)</label>
            <input
              id="valor"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="Ex.: 50,00"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <p className="text-muted mt-1" style={{ fontSize: '0.78rem' }}>
              Sugestões: <button type="button" className="chip" onClick={() => setValor('20,00')}>R$ 20</button>{' '}
              <button type="button" className="chip" onClick={() => setValor('50,00')}>R$ 50</button>{' '}
              <button type="button" className="chip" onClick={() => setValor('100,00')}>R$ 100</button>
            </p>
          </div>
          <div className="field">
            <label htmlFor="data">Data da contribuição</label>
            <input id="data" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="obs">Observação (opcional)</label>
            <input id="obs" className="input" placeholder="Ex.: intenção de missa de domingo" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit">
            <HandCoins size={17} /> Contribuir com o dízimo
          </button>
        </form>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Confirmar contribuição"
        message={`Contribuir com ${formatBRL(centavos)} ao dízimo da paróquia? O valor será debitado do seu saldo virtual.`}
        confirmLabel="Confirmar dízimo"
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <ReceiptModal transaction={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
