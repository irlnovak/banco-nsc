import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const notify = useNotifications();
  const [loginName, setLoginName] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!loginName.trim() || !senha) {
      setError('Preencha usuário/e-mail e senha.');
      return;
    }
    setLoading(true);
    const result = await loginUser(loginName.trim(), senha);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    notify.success('Login realizado', 'Bem-vindo de volta ao Banco Nossa Senhora da Conceição.');
    navigate('/app');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo height={72} />
          <h1>Banco Nossa Senhora da Conceição</h1>
          <span className="virtual-badge">🔒 Sistema virtual da paróquia</span>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="login">Usuário ou e-mail</label>
            <input
              id="login"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="ex.: joao ou joao@nsconceicao.hab"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/cadastro">Criar uma conta</Link>
          <Link to="/esqueci-senha">Esqueci minha senha</Link>
        </div>
        <div className="auth-links">
          <Link to="/admin-login" className="text-muted">Painel do administrador</Link>
        </div>

        <p className="text-muted center mt-2" style={{ fontSize: '0.78rem' }}>
          Sistema financeiro virtual para uso dentro do Habblet. Sem integração com bancos reais.
        </p>
      </div>
    </div>
  );
}
