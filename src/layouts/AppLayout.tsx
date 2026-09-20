import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import {
  LayoutDashboard,
  Zap,
  ReceiptText,
  HandCoins,
  Landmark,
  ListOrdered,
  UserRound,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const links = [
    { to: '/app', icon: <LayoutDashboard size={18} />, label: 'Início' },
    { to: '/app/pix', icon: <Zap size={18} />, label: 'Pix Virtual' },
    { to: '/app/boletos', icon: <ReceiptText size={18} />, label: 'Pagar boleto' },
    { to: '/app/dizimo', icon: <HandCoins size={18} />, label: 'Dízimo' },
    { to: '/app/taxas', icon: <Landmark size={18} />, label: 'Taxas do bairro' },
    { to: '/app/extrato', icon: <ListOrdered size={18} />, label: 'Extrato' },
    { to: '/app/perfil', icon: <UserRound size={18} />, label: 'Meu perfil' },
  ];

  if (user.role === 'admin') {
    links.push({ to: '/admin', icon: <ShieldCheck size={18} />, label: 'Painel admin' });
  }

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo height={58} />
          <span>Banco Nossa Senhora da Conceição</span>
        </div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/app'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.icon}
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user.nomeCompleto}</strong>
            <span>@{user.username}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={doLogout}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button className="btn btn-ghost menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--azul)' }}>
            <Logo height={30} />
            <span style={{ fontSize: '0.9rem' }}>N. Sra. da Conceição</span>
          </div>
          <div className="topbar-right">
            <span className="virtual-badge">🔒 Ambiente virtual</span>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
