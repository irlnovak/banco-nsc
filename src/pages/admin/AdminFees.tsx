import { useMemo, useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { getAllFees, createFee, updateFee, cancelFee } from '../../services/databaseService';
import { formatBRL, parseBRLToCentavos, centavosToInput } from '../../utils/money';
import { formatDateBR } from '../../utils/format';
import Modal from '../../components/Modal';
import ConfirmationModal from '../../components/ConfirmationModal';
import EmptyState from '../../components/EmptyState';
import { Landmark, PlusCircle, Pencil, Ban } from 'lucide-react';
import type { Fee } from '../../types';

export default function AdminFees() {
  const notify = useNotifications();
  const [version, setVersion] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [form, setForm] = useState({ description: '', valor: '', dueDate: '', bairro: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Fee | null>(null);

  const fees = useMemo(() => {
    void version;
    return getAllFees();
  }, [version]);

  const openCreate = () => {
    setEditing(null);
    setForm({ description: '', valor: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), bairro: '' });
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (f: Fee) => {
    setEditing(f);
    setForm({ description: f.description, valor: centavosToInput(f.amount), dueDate: f.dueDate, bairro: f.bairro });
    setError('');
    setEditorOpen(true);
  };

  const save = async () => {
    const centavos = parseBRLToCentavos(form.valor) ?? 0;
    if (!form.description.trim()) { setError('Informe a descrição.'); return; }
    if (centavos <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!form.dueDate) { setError('Informe o vencimento.'); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    try {
      if (editing) {
        updateFee(editing.id, { description: form.description, amount: centavos, dueDate: form.dueDate, bairro: form.bairro });
        notify.success('Cobrança atualizada', form.description);
      } else {
        createFee({ description: form.description, amount: centavos, dueDate: form.dueDate, bairro: form.bairro });
        notify.success('Cobrança criada', form.description);
      }
      setEditorOpen(false);
      setVersion((v) => v + 1);
    } catch (e) {
      notify.error('Erro', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancelFee(cancelTarget.id);
    notify.info('Cobrança cancelada', cancelTarget.description);
    setCancelTarget(null);
    setVersion((v) => v + 1);
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">Cobranças do bairro</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Crie, edite e cancele taxas e impostos virtuais.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <PlusCircle size={17} /> Nova cobrança
        </button>
      </div>

      {fees.length === 0 ? (
        <div className="card"><EmptyState icon={<Landmark size={22} />} title="Nenhuma cobrança criada" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Descrição</th><th>Bairro</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.description}</strong></td>
                  <td>{f.bairro || 'Todos'}</td>
                  <td>{formatBRL(f.amount)}</td>
                  <td>{formatDateBR(f.dueDate)}</td>
                  <td>
                    <span className={`badge ${f.status === 'paga' ? 'concluida' : f.status === 'pendente' ? 'pendente' : 'cancelada'}`}>{f.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(f)} disabled={f.status !== 'pendente'}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setCancelTarget(f)} disabled={f.status !== 'pendente'}>
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editorOpen} title={editing ? 'Editar cobrança' : 'Nova cobrança'} onClose={() => setEditorOpen(false)}>
        <div className="field">
          <label htmlFor="cdesc">Descrição</label>
          <input id="cdesc" className="input" placeholder="Ex.: Taxa de iluminação — setembro" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cvalor">Valor (R$)</label>
            <input id="cvalor" className={`input ${error ? 'input-error' : ''}`} inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cdue">Vencimento</label>
            <input id="cdue" type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cbai">Bairro (opcional — vazio = todos)</label>
          <input id="cbai" className="input" placeholder="Ex.: Vila Conceição" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </Modal>

      <ConfirmationModal
        open={!!cancelTarget}
        title="Cancelar cobrança"
        message={`Cancelar "${cancelTarget?.description}" no valor de ${formatBRL(cancelTarget?.amount ?? 0)}? Os usuários não poderão mais pagá-la.`}
        confirmLabel="Cancelar cobrança"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  );
}
