// Helpers de exibição reutilizados por comprovantes e extrato.
// Arquivo pequeno e focado para não poluir money.ts com UI.
import type { Transaction } from '../types';
import { formatDate, formatTime } from './money';

// Reexporta para quem monta comprovantes
export { formatBRL } from './money';

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} às ${formatTime(ts)}`;
}

const LABELS: Record<Transaction['type'], string> = {
  deposito: 'Depósito virtual',
  pix_enviado: 'Pix enviado',
  pix_recebido: 'Pix recebido',
  boleto: 'Pagamento de boleto',
  dizimo: 'Dízimo',
  taxa: 'Taxa do bairro',
  transferencia: 'Transferência virtual',
  salario: 'Salário semanal',
  admin_credito: 'Crédito administrativo',
  admin_debito: 'Débito administrativo',
};

export function transactionLabelSafe(tx: Transaction): string {
  return LABELS[tx.type] ?? tx.type;
}
