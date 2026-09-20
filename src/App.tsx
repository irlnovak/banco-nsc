import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Pix from './pages/Pix';
import Boletos from './pages/Boletos';
import Dizimo from './pages/Dizimo';
import Taxas from './pages/Taxas';
import Extrato from './pages/Extrato';
import Perfil from './pages/Perfil';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminFees from './pages/admin/AdminFees';
import AdminTransactions from './pages/admin/AdminTransactions';
import Loading from './components/Loading';
import type { ReactNode } from 'react';

function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/cadastro" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/admin-login" element={<PublicOnly><AdminLogin /></PublicOnly>} />

            {/* Usuário autenticado */}
            <Route path="/app" element={<Protected><AppLayout><Dashboard /></AppLayout></Protected>} />
            <Route path="/app/pix" element={<Protected><AppLayout><Pix /></AppLayout></Protected>} />
            <Route path="/app/boletos" element={<Protected><AppLayout><Boletos /></AppLayout></Protected>} />
            <Route path="/app/dizimo" element={<Protected><AppLayout><Dizimo /></AppLayout></Protected>} />
            <Route path="/app/taxas" element={<Protected><AppLayout><Taxas /></AppLayout></Protected>} />
            <Route path="/app/extrato" element={<Protected><AppLayout><Extrato /></AppLayout></Protected>} />
            <Route path="/app/perfil" element={<Protected><AppLayout><Perfil /></AppLayout></Protected>} />

            {/* Administrativo */}
            <Route path="/admin" element={<Protected adminOnly><AppLayout><Admin /></AppLayout></Protected>} />
            <Route path="/admin/usuarios" element={<Protected adminOnly><AppLayout><AdminUsers /></AppLayout></Protected>} />
            <Route path="/admin/cobrancas" element={<Protected adminOnly><AppLayout><AdminFees /></AppLayout></Protected>} />
            <Route path="/admin/transacoes" element={<Protected adminOnly><AppLayout><AdminTransactions /></AppLayout></Protected>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </NotificationProvider>
  );
}
