import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { DISCLAIMER } from '../config';
import { Church } from 'lucide-react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="public-header">
        <div className="public-header-inner">
          <Link to="/" className="brand">
            <Logo />
            <div className="brand-name">
              Banco Nossa Senhora da Conceição
              <small>Paróquia virtual · Habblet</small>
            </div>
          </Link>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => navigate('/login')}>
              Entrar
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/cadastro')}>
              Criar conta
            </button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
      <footer className="public-footer">
        <p>
          <Church size={14} style={{ verticalAlign: '-2px' }} /> <strong>Banco Nossa Senhora da Conceição</strong>
        </p>
        <p>{DISCLAIMER}</p>
        <p>Todas as operações são simuladas — nenhum dinheiro real é movimentado.</p>
      </footer>
    </>
  );
}
