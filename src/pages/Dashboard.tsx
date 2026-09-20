import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getTransactionsByUser } from '../services/databaseService';
import { formatBRL } from '../utils/money';
import TransactionItem from '../components/TransactionItem';
import EmptyState from '../components/EmptyState';
import type { Transaction } from '../types';
import { Eye, EyeOff, Zap, ReceiptText, HandCoins, Landmark, Repeat, ListOrdered, Inbox, ArrowRight, Banknote } from 'lucide-react';

const SHORTCUTS = [
  { to: '/app/pix', icon: <Zap size={22} />, label: 'Pix' },
  { to: '/app/boletos', icon: <ReceiptText size={22} />, label: 'Pagar boleto' },
  { to: '/app/dizimo', icon: <HandCoins size={22} />, label: 'Dízimo' },
  { to: '/app/taxas', icon: <Landmark size={22} />, label: 'Impostos' },
  { to: '/app/pix?modo=transferencia', icon: <Repeat size={22} />, label: 'Transferência' },
  { to: '/app/extrato', icon: <ListOrdered size={22} />, label: 'Extrato' },
];

export default function Dashboard() {
  const { user, refreshUser, salaryCreditedNotice, markSalaryNoticeRead } = useAuth();
  const notify = useNotifications();
  const navigate = useNavigate();
  const [hideBalance, setHideBalance] = useState(false);

  const transactions = useMemo(
    () => (user ? getTransactionsByUser(user.id) : []),
    [user],
  );

  useEffect(() => {
    if (salaryCreditedNotice > 0) {
      notify.success(
        'Salário semanal creditado',
        `Você recebeu ${formatBRL(salaryCreditedNotice)} referente ao salário semanal da paróquia (virtual).`,
      );
      refreshUser();
      markSalaryNoticeRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryCreditedNotice]);

  if (!user) return null;
  const recent = transactions.slice(0, 6);

  return (
    <>
      <h1 className="page-title">Olá, {user.nomeCompleto.split(' ')[0]} 👋</h1>
      <p className="page-subtitle">Bem-vindo(a) ao seu internet banking virtual da paróquia.</p>

      <div className="balance-card">
        <span className="label">Saldo disponível</span>
        <div className="balance-value">
          {hideBalance ? 'R$ ••••••' : formatBRL(user.balance)}
          <button
            className="balance-eye"
            onClick={() => setHideBalance((h) => !h)}
            aria-label={hideBalance ? 'Exibir saldo' : 'Ocultar saldo'}
          >
            {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <span className="balance-meta">
          <Banknote size={13} style={{ verticalAlign: '-2px' }} /> Salário semanal de R$ 1.620,00 creditado automaticamente (virtual).
        </span>
      </div>

      <div className="shortcuts">
        {SHORTCUTS.map((s) => (
          <Link className="shortcut" to={s.to} key={s.label}>
            <div className="feature-icon">{s.icon}</div>
            {s.label}
          </Link>
        ))}
      </div>

      <div className="section-head">
        <h2>Últimas movimentações</h2>
        <Link to="/app/extrato" className="btn btn-ghost btn-sm">
          Ver extrato completo <ArrowRight size={15} />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Inbox size={22} />}
            title="Nenhuma movimentação ainda"
            message="Suas operações aparecerão aqui assim que você realizá-las."
          />
        </div>
      ) : (
        <div className="tx-list">
          {recent.map((tx) => (
            <TransactionItem key={tx.id} tx={tx} onDetails={(t: Transaction) => navigate(`/app/extrato?tx=${t.id}`)} />
          ))}
        </div>
      )}
    </>
  );
}
