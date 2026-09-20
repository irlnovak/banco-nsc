import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Login administrativo.
 *
 * ⚠️ SIMULAÇÃO: em um build frontend-only as credenciais ficam
 * embutidas no JavaScript (vindas de variáveis VITE_*) e são
 * visíveis a quem inspecionar o código. Autenticação realmente
 * segura exige backend — veja o README, seção "Segurança".
 */
export default function AdminLogin() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const notify = useNotifications();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await loginUser(usuario.trim(), senha);
    setLoading(false);
    if (result.user) {
      notify.success('Acesso administrativo liberado', 'Bem-vindo(a), tesoureiro(a).');
      navigate('/admin');
      return;
    }

    setLoading(false);
    setError(result.error ?? 'Credenciais administrativas inválidas.');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo height={64} />
          <h1>Painel Administrativo</h1>
          <span className="virtual-badge">🔒 Acesso restrito · Paróquia virtual</span>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="admuser">Usuário administrativo</label>
            <input id="admuser" className={`input ${error ? 'input-error' : ''}`} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="admsenha">Senha</label>
            <input id="admsenha" type="password" className={`input ${error ? 'input-error' : ''}`} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Verificando…' : 'Entrar no painel'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Área do usuário</Link>
          <Link to="/">Início</Link>
        </div>
        <p className="text-muted center mt-2" style={{ fontSize: '0.75rem' }}>
          Autenticação de demonstração — a segurança real exige backend.
        </p>
      </div>
    </div>
  );
}
