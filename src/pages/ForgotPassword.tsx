import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Recuperação de senha SIMULADA.
 * Como não há backend/e-mail, a senha só pode ser redefinida
 * pelo administrador (painel admin) ou limpando os dados no
 * navegador. Esta tela apenas orienta o usuário.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const notify = useNotifications();
  const [sent, setSent] = useState(false);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo height={64} />
          <h1>Recuperar acesso</h1>
        </div>
        {sent ? (
          <p className="text-muted" style={{ lineHeight: 1.7 }}>
            Solicitação registrada (simulação). Em um sistema real você receberia um e-mail com um link de redefinição.
            <br />
            <br />
            Nesta versão virtual, peça ao <strong>administrador da paróquia</strong> para redefinir sua senha pelo
            painel administrativo.
          </p>
        ) : (
          <p className="text-muted" style={{ lineHeight: 1.7 }}>
            Informe seu usuário ou e-mail para solicitar a redefinição de senha (ambiente de demonstração — nenhum
            e-mail é enviado de verdade).
          </p>
        )}
        {!sent && (
          <button
            className="btn btn-primary btn-block mt-2"
            onClick={() => {
              setSent(true);
              notify.info('Solicitação registrada', 'Nenhum e-mail real é enviado — ambiente virtual.');
            }}
          >
            Solicitar redefinição
          </button>
        )}
        <div className="auth-links">
          <Link to="/login">Voltar ao login</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Início</button>
        </div>
      </div>
    </div>
  );
}
