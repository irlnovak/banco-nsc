import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getAllUsers, setUserBlocked, adminAdjustFunds } from '../../services/databaseService';
import { formatBRL, parseBRLToCentavos } from '../../utils/money';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import { Users, ShieldOff, ShieldCheck, PlusCircle, MinusCircle, Search } from 'lucide-react';
import type { User } from '../../types';

export default function AdminUsers() {
  const { user: admin } = useAuth();
  const { refreshUser } = useAuth();
  const notify = useNotifications();
  const [version, setVersion] = useState(0);

  // Recarrega os usuários do BANCO ao abrir a página
  useEffect(() => {
    (async () => {
      await refreshUser();
      setVersion((v) => v + 1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [busca, setBusca] = useState('');
  const [fundsTarget, setFundsTarget] = useState<User | null>(null);
  const [fundsMode, setFundsMode] = useState<'add' | 'remove'>('add');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const users = useMemo(() => {
    void version;
    return getAllUsers().filter((u) => u.role !== 'admin');
  }, [version]);

  const filtered = users.filter(
    (u) =>
      u.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      u.username.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase()),
  );

  const toggleBlock = async (u: User) => {
    const result = await setUserBlocked(u.id, !u.blocked);
    if (result?.error) {
      notify.error('Erro', result.error);
      return;
    }
    setVersion((v) => v + 1);
    notify.info(u.blocked ? 'Usuário desbloqueado' : 'Usuário bloqueado', `@${u.username}`);
  };

  const openFunds = (u: User, mode: 'add' | 'remove') => {
    setFundsTarget(u);
    setFundsMode(mode);
    setValor('');
    setMotivo('');
    setError('');
  };

  const confirmFunds = async () => {
    if (!fundsTarget) return;
    const centavos = parseBRLToCentavos(valor) ?? 0;
    if (centavos <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    const signed = fundsMode === 'add' ? centavos : -centavos;
    setLoading(true);
    const result = await adminAdjustFunds(fundsTarget.id, signed, motivo || (fundsMode === 'add' ? 'Crédito manual do administrador' : 'Débito manual do administrador'));
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setFundsTarget(null);
    setVersion((v) => v + 1);
    notify.success(
      fundsMode === 'add' ? 'Saldo adicionado' : 'Saldo removido',
      `${fundsMode === 'add' ? '+' : '-'} ${formatBRL(centavos)} para @${fundsTarget.username}.`,
    );
  };

  return (
    <>
      <h1 className="page-title">Usuários</h1>
      <p className="page-subtitle">{users.length} usuários cadastrados. Gerencie saldos, bloqueios e ajustes manuais.</p>

      <div className="field" style={{ maxWidth: 380 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--cinza-texto)' }} />
          <input className="input" placeholder="Buscar por nome, @usuário ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Users size={22} />} title="Nenhum usuário encontrado" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Bairro</th>
                <th>Saldo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nomeCompleto}</strong>
                    <br />
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>@{u.username}</span>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.bairro}</td>
                  <td><strong>{formatBRL(u.balance)}</strong></td>
                  <td>
                    <span className={`badge ${u.blocked ? 'cancelada' : 'concluida'}`}>{u.blocked ? 'bloqueado' : 'ativo'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openFunds(u, 'add')} title="Adicionar saldo">
                        <PlusCircle size={14} /> Add
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openFunds(u, 'remove')} title="Remover saldo">
                        <MinusCircle size={14} /> Remover
                      </button>
                      <button
                        className={`btn btn-sm ${u.blocked ? 'btn-outline' : 'btn-danger'}`}
                        onClick={() => toggleBlock(u)}
                        disabled={u.id === admin?.id}
                      >
                        {u.blocked ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!fundsTarget}
        title={fundsMode === 'add' ? 'Adicionar dinheiro' : 'Remover dinheiro'}
        onClose={() => setFundsTarget(null)}
      >
        <p className="text-muted">
          {fundsMode === 'add' ? 'Creditar' : 'Debitar'} saldo de <strong>@{fundsTarget?.username}</strong> (saldo atual: {formatBRL(fundsTarget?.balance ?? 0)}).
        </p>
        <div className="field mt-2">
          <label htmlFor="fvalor">Valor (R$)</label>
          <input id="fvalor" className={`input ${error ? 'input-error' : ''}`} inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fmotivo">Motivo / descrição</label>
          <input id="fmotivo" className="input" placeholder="Ex.: premiação do concurso do bairro" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setFundsTarget(null)} disabled={loading}>Cancelar</button>
          <button className={`btn ${fundsMode === 'add' ? 'btn-primary' : 'btn-danger'}`} onClick={confirmFunds} disabled={loading}>
            {loading ? 'Processando…' : fundsMode === 'add' ? 'Adicionar' : 'Remover'}
          </button>
        </div>
      </Modal>
    </>
  );
}
