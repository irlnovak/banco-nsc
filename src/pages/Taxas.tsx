import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getFeesForUser, performOperation } from '../services/databaseService';
import { formatBRL, formatDateBR } from '../utils/format';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptModal from '../components/ReceiptModal';
import EmptyState from '../components/EmptyState';
import type { Fee, Transaction } from '../types';
import { Landmark, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function Taxas() {
  const { user, refreshUser } = useAuth();
  const notify = useNotifications();
  const [, setVersion] = useState(0);
  const [target, setTarget] = useState<Fee | null>(null);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  if (!user) return null;
  const fees = getFeesForUser(user);
  const pendentes = fees.filter((f) => f.status === 'pendente');
  const outras = fees.filter((f) => f.status !== 'pendente');

  const confirmPay = async () => {
    if (!target || !user) return;
    setLoading(true);
    const result = await performOperation({
      userId: user.id,
      type: 'taxa',
      category: 'taxa',
      description: `Taxa paga — ${target.description}`,
      amount: target.amount,
      direction: 'out',
      receiverName: 'Prefeitura/Paróquia do bairro (virtual)',
      reference: target.id,
    });
    setLoading(false);
    if (result.error || !result.transaction) {
      setTarget(null);
      notify.error('Erro no pagamento', result.error ?? 'Tente novamente.');
      await refreshUser();
      return;
    }
    // O status da cobrança já é atualizado no banco (RPC/local) —
    // não é necessário updateFee manual aqui.
    setTarget(null);
    setReceipt(result.transaction);
    await refreshUser();
    setVersion((v) => v + 1);
    notify.success('Taxa paga com sucesso', 'O pagamento foi registrado no seu extrato.');
  };

  const FeeCard = ({ fee }: { fee: Fee }) => {
    const vencida = fee.status === 'pendente' && new Date(fee.dueDate + 'T23:59:59') < new Date();
    return (
      <div className={`card fee-card ${fee.status !== 'pendente' ? 'paid' : ''}`} key={fee.id}>
        <div className="fee-top">
          <div>
            <strong>{fee.description}</strong>
            {fee.bairro && <p className="text-muted" style={{ fontSize: '0.78rem' }}>Bairro: {fee.bairro}</p>}
          </div>
          <span className="fee-amount">{formatBRL(fee.amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: '0.82rem' }}>
            <Clock size={13} style={{ verticalAlign: '-2px' }} /> Vence em {formatDateBR(fee.dueDate)}
          </span>
          {fee.status === 'pendente' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setTarget(fee)}>
              Pagar
            </button>
          ) : fee.status === 'paga' ? (
            <span className="badge concluida"><CheckCircle2 size={12} style={{ verticalAlign: '-2px' }} /> paga</span>
          ) : (
            <span className="badge cancelada"><XCircle size={12} style={{ verticalAlign: '-2px' }} /> cancelada</span>
          )}
          {vencida && <span className="badge pendente">vencida</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <h1 className="page-title">Taxas e impostos do bairro</h1>
      <p className="page-subtitle">Cobranças fictícias da comunidade. Quite com saldo virtual, sem custo.</p>

      <div className="section-head">
        <h2>Cobranças em aberto ({pendentes.length})</h2>
      </div>
      {pendentes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Landmark size={22} />}
            title="Nenhuma cobrança em aberto"
            message="Você está em dia com as taxas do bairro. 🎉"
          />
        </div>
      ) : (
        <div className="fee-grid">
          {pendentes.map((f) => (
            <FeeCard fee={f} key={f.id} />
          ))}
        </div>
      )}

      {outras.length > 0 && (
        <>
          <div className="section-head mt-3">
            <h2>Histórico de cobranças</h2>
          </div>
          <div className="fee-grid">
            {outras.map((f) => (
              <FeeCard fee={f} key={f.id} />
            ))}
          </div>
        </>
      )}

      <ConfirmationModal
        open={!!target}
        title="Confirmar pagamento de taxa"
        message={`Pagar "${target?.description}" no valor de ${formatBRL(target?.amount ?? 0)}? O valor será debitado do seu saldo virtual.`}
        confirmLabel="Pagar taxa"
        loading={loading}
        onConfirm={confirmPay}
        onCancel={() => setTarget(null)}
      />

      <ReceiptModal transaction={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
