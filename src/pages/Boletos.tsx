import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { findBoleto, payBoleto, getAllBoletos } from '../services/databaseService';
import { formatBRL, formatDateBR } from '../utils/format';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptModal from '../components/ReceiptModal';
import type { Boleto, Transaction } from '../types';
import { ReceiptText, Search } from 'lucide-react';

export default function Boletos() {
  const { user, refreshUser } = useAuth();
  const notify = useNotifications();
  const [codigo, setCodigo] = useState('');
  const [boleto, setBoleto] = useState<Boleto | null>(null);
  const [error, setError] = useState('');
  const [consultLoading, setConsultLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  if (!user) return null;

  const consultar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setBoleto(null);
    if (!codigo.trim()) {
      setError('Digite o código do boleto.');
      return;
    }
    setConsultLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const found = findBoleto(codigo);
    setConsultLoading(false);
    if (!found) {
      setError('Boleto não encontrado. Confira o código ou use um dos códigos de demonstração abaixo.');
      return;
    }
    setBoleto(found);
  };

  const confirmPay = async () => {
    if (!boleto) return;
    setPayLoading(true);
    const result = await payBoleto(boleto.code);
    setPayLoading(false);
    if (result.error || !result.transaction) {
      setPayOpen(false);
      notify.error('Erro no pagamento', result.error ?? 'Tente novamente.');
      return;
    }
    setPayOpen(false);
    setReceipt(result.transaction);
    await refreshUser();
    notify.success('Boleto pago com sucesso', 'O pagamento foi registrado no seu extrato.');
    setBoleto(result.boleto ?? null);
  };

  const demoCodes = getAllBoletos()
    .filter((b) => b.status === 'aberto')
    .slice(0, 4);

  return (
    <>
      <h1 className="page-title">Pagar boleto</h1>
      <p className="page-subtitle">Boletos fictícios emitidos por parceiros da paróquia virtual.</p>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={consultar}>
          <div className="field">
            <label htmlFor="codigo">Código do boleto</label>
            <input
              id="codigo"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="Ex.: 2379100010000010000000000000001"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={consultLoading}>
            <Search size={17} /> {consultLoading ? 'Consultando…' : 'Consultar boleto'}
          </button>
        </form>
      </div>

      {boleto && (
        <div className="card mt-3" style={{ maxWidth: 560 }}>
          <h3>Dados do boleto</h3>
          <div className="receipt-row"><span className="k">Beneficiário</span><span className="v">{boleto.beneficiary}</span></div>
          <div className="receipt-row"><span className="k">Valor</span><span className="v">{formatBRL(boleto.amount)}</span></div>
          <div className="receipt-row"><span className="k">Vencimento</span><span className="v">{formatDateBR(boleto.dueDate)}</span></div>
          <div className="receipt-row"><span className="k">Descrição</span><span className="v">{boleto.description}</span></div>
          <div className="receipt-row"><span className="k">Status</span><span className="v"><span className={`badge ${boleto.status === 'pago' ? 'concluida' : 'pendente'}`}>{boleto.status}</span></span></div>
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => setPayOpen(true)}
              disabled={boleto.status === 'pago'}
            >
              <ReceiptText size={17} /> Pagar boleto
            </button>
          </div>
        </div>
      )}

      <div className="card mt-3" style={{ maxWidth: 560 }}>
        <h3>Códigos de demonstração</h3>
        <p className="text-muted" style={{ fontSize: '0.83rem', marginBottom: 10 }}>
          Use um destes códigos fictícios para testar:
        </p>
        {demoCodes.map((b) => (
          <button
            key={b.code}
            className="chip"
            style={{ marginBottom: 6, display: 'block', width: '100%', textAlign: 'left' }}
            onClick={() => { setCodigo(b.code); setError(''); }}
          >
            <strong>{formatBRL(b.amount)}</strong> · {b.beneficiary} — <code style={{ fontSize: '0.72rem' }}>{b.code}</code>
          </button>
        ))}
      </div>

      <ConfirmationModal
        open={payOpen}
        title="Confirmar pagamento"
        message={`Deseja pagar o boleto de ${boleto?.beneficiary} no valor de ${formatBRL(boleto?.amount ?? 0)}? O valor será debitado do seu saldo virtual.`}
        confirmLabel="Pagar boleto"
        loading={payLoading}
        onConfirm={confirmPay}
        onCancel={() => setPayOpen(false)}
      />

      <ReceiptModal transaction={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
