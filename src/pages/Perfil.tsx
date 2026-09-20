import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { isValidEmail, isValidPhone } from '../utils/money';
import { verifyPassword, updateUserPassword } from '../services/databaseService';

export default function Perfil() {
  const { user, updateProfile } = useAuth();
  const notify = useNotifications();
  const [form, setForm] = useState(() => ({
    nomeCompleto: user?.nomeCompleto ?? '',
    email: user?.email ?? '',
    telefone: user?.telefone ?? '',
    endereco: user?.endereco ?? '',
    bairro: user?.bairro ?? '',
  }));
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nomeCompleto.trim() || !isValidEmail(form.email) || !isValidPhone(form.telefone)) {
      notify.error('Dados inválidos', 'Verifique nome, e-mail e telefone.');
      return;
    }
    setSaving(true);
    await updateProfile({ ...form });
    setSaving(false);
    notify.success('Perfil atualizado', 'Seus dados foram salvos com sucesso.');
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaError('');
    const ok = await verifyPassword(user.username, senhaAtual);
    if (!ok) {
      setSenhaError('Senha atual incorreta.');
      return;
    }
    if (novaSenha.length < 8 || !/[A-Za-z]/.test(novaSenha) || !/\d/.test(novaSenha)) {
      setSenhaError('A nova senha precisa de 8+ caracteres, letras e números.');
      return;
    }
    if (novaSenha !== confirmar) {
      setSenhaError('As senhas não coincidem.');
      return;
    }
    const res = await updateUserPassword(novaSenha);
    if (res?.error) {
      setSenhaError(res.error);
      return;
    }
    notify.success('Senha alterada', 'Sua senha foi atualizada com sucesso.');
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmar('');
  };

  return (
    <>
      <h1 className="page-title">Meu perfil</h1>
      <p className="page-subtitle">Gerencie seus dados cadastrais da conta virtual.</p>

      <div className="card" style={{ maxWidth: 640 }}>
        <h3>Dados cadastrais</h3>
        <form onSubmit={saveProfile}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="pnome">Nome completo</label>
              <input id="pnome" className="input" value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="puser">Nome de usuário</label>
              <input id="puser" className="input" value={`@${user.username}`} disabled />
            </div>
            <div className="field">
              <label htmlFor="pnasc">Data de nascimento</label>
              <input id="pnasc" className="input" value={user.dataNascimento} disabled />
            </div>
            <div className="field">
              <label htmlFor="pemail">E-mail</label>
              <input id="pemail" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ptel">Telefone</label>
              <input id="ptel" className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pend">Endereço</label>
              <input id="pend" className="input" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pbai">Bairro</label>
              <input id="pbai" className="input" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </div>

      <div className="card mt-3" style={{ maxWidth: 640 }}>
        <h3>Alterar senha</h3>
        <form onSubmit={changePassword}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="satual">Senha atual</label>
              <input id="satual" type="password" className="input" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="snova">Nova senha</label>
              <input id="snova" type="password" className="input" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="sconf">Confirmar nova senha</label>
              <input id="sconf" type="password" className="input" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          {senhaError && <p className="field-error">{senhaError}</p>}
          <button className="btn btn-outline" type="submit">Alterar senha</button>
        </form>
      </div>

      <p className="text-muted mt-2" style={{ maxWidth: 640, lineHeight: 1.7 }}>
        <strong>Nota de segurança:</strong> esta versão roda 100% no navegador (LocalStorage). Para proteção real de
        credenciais, é necessário um backend — veja o README.
      </p>
    </>
  );
}
