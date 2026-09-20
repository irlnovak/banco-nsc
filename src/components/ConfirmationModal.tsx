import type { ReactNode } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  return (
    <ModalBridge open={open} title={title} onClose={onCancel}>
      <p className="text-muted" style={{ lineHeight: 1.6 }}>{message}</p>
      {children}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processando…' : confirmLabel}
        </button>
      </div>
    </ModalBridge>
  );
}

// Envolve o Modal base
import Modal from './Modal';
function ModalBridge({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {children}
    </Modal>
  );
}
