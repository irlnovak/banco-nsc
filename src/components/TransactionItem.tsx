import type { Transaction } from '../types';
import { formatBRL, formatDate, formatTime } from '../utils/money';
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  ReceiptText,
  Landmark,
  Banknote,
  Repeat,
  Wallet,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

const ICONS: Record<Transaction['type'], React.ReactNode> = {
  deposito: <Wallet size={19} />,
  pix_enviado: <ArrowUpRight size={19} />,
  pix_recebido: <ArrowDownLeft size={19} />,
  boleto: <ReceiptText size={19} />,
  dizimo: <HandCoins size={19} />,
  taxa: <Landmark size={19} />,
  transferencia: <Repeat size={19} />,
  salario: <Banknote size={19} />,
  admin_credito: <ShieldCheck size={19} />,
  admin_debito: <ShieldAlert size={19} />,
};

const LABELS: Record<Transaction['type'], string> = {
  deposito: 'Depósito',
  pix_enviado: 'Pix enviado',
  pix_recebido: 'Pix recebido',
  boleto: 'Boleto',
  dizimo: 'Dízimo',
  taxa: 'Taxa do bairro',
  transferencia: 'Transferência',
  salario: 'Salário semanal',
  admin_credito: 'Crédito do admin',
  admin_debito: 'Débito do admin',
};

export function transactionLabel(type: Transaction['type']): string {
  return LABELS[type] ?? type;
}

export default function TransactionItem({ tx, onDetails }: { tx: Transaction; onDetails?: (tx: Transaction) => void }) {
  return (
    <div className="tx-item" onClick={() => onDetails?.(tx)} style={onDetails ? { cursor: 'pointer' } : undefined}>
      <div className={`tx-icon ${tx.direction}`}>{ICONS[tx.type]}</div>
      <div className="tx-info">
        <strong>{tx.description}</strong>
        <div className="tx-meta">
          <span>{formatDate(tx.createdAt)}</span>
          <span>{formatTime(tx.createdAt)}</span>
          <span>{LABELS[tx.type]}</span>
          <span className={`badge ${tx.status}`}>{tx.status}</span>
        </div>
      </div>
      <div className={`tx-amount ${tx.direction}`}>
        {tx.direction === 'in' ? '+' : '-'} {formatBRL(tx.amount)}
      </div>
    </div>
  );
}
