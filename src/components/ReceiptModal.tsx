import Modal from './Modal';
import type { Transaction } from '../types';
import { formatDateTime, transactionLabelSafe, formatBRL } from '../utils/receipt';
import Logo from './Logo';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

export default function ReceiptModal({ transaction, onClose }: Props) {
  if (!transaction) return null;
  const tx = transaction;
  return (
    <Modal open={!!tx} title="Comprovante virtual" onClose={onClose}>
      <div className="comprovante-header">
        <Logo height={44} />
        <strong>Banco Nossa Senhora da Conceição</strong>
      </div>
      <div className="receipt-row"><span className="k">Tipo da operação</span><span className="v">{transactionLabelSafe(tx)}</span></div>
      <div className="receipt-row"><span className="k">ID da transação</span><span className="v">{tx.id}</span></div>
      <div className="receipt-row"><span className="k">Data e hora</span><span className="v">{formatDateTime(tx.createdAt)}</span></div>
      {tx.senderName && <div className="receipt-row"><span className="k">Remetente</span><span className="v">{tx.senderName}</span></div>}
      {tx.receiverName && <div className="receipt-row"><span className="k">Destinatário</span><span className="v">{tx.receiverName}</span></div>}
      {tx.pixKey && <div className="receipt-row"><span className="k">Chave Pix virtual</span><span className="v">{tx.pixKey}</span></div>}
      {tx.reference && <div className="receipt-row"><span className="k">Referência</span><span className="v">{tx.reference}</span></div>}
      <div className="receipt-row"><span className="k">Valor</span><span className="v" style={{ color: tx.direction === 'in' ? 'var(--verde)' : 'var(--vermelho)' }}>{tx.direction === 'in' ? '+' : '-'} {formatBRL(tx.amount)}</span></div>
      <div className="receipt-row"><span className="k">Descrição</span><span className="v">{tx.description}</span></div>
      <div className="receipt-row"><span className="k">Status</span><span className="v"><span className={`badge ${tx.status}`}>{tx.status}</span></span></div>
      <p className="text-muted center mt-2" style={{ fontSize: '0.75rem' }}>
        Documento simulado, sem valor legal. Operação virtual da Paróquia Nossa Senhora da Conceição (Habblet).
      </p>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={() => window.print()}>
          🖨️ Imprimir / salvar PDF
        </button>
        <button className="btn btn-primary" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
