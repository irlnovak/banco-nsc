import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAdminStats, getAllTransactions, getAllFees, getAllBoletos } from '../services/databaseService';
import { formatBRL } from '../utils/money';
import {
  Users,
  Wallet,
  ListOrdered,
  HandCoins,
  ReceiptText,
  Landmark,
  UserRound,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  CalendarDays,
} from 'lucide-react';

function Bar({ label, value, max, color = '' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-row-head">
        <span>{label}</span>
        <strong>{formatBRL(value)}</strong>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const stats = useMemo(() => getAdminStats(), []);
  const txs = useMemo(() => getAllTransactions(), []);
  const fees = useMemo(() => getAllFees(), []);
  const boletos = useMemo(() => getAllBoletos(), []);

  const entradas = txs.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
  const saidas = txs.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
  const maxChart = Math.max(entradas, saidas, stats.totalDizimos, 1);

  // Movimentações dos últimos 7 dias (por dia)
  const last7 = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000;
      const total = txs.filter((t) => t.createdAt >= start && t.createdAt < end).reduce((s, t) => s + t.amount, 0);
      days.push({ label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), total });
    }
    return days;
  }, [txs]);
  const max7 = Math.max(...last7.map((d) => d.total), 1);

  const dizimosList = txs.filter((t) => t.type === 'dizimo');
  const taxasPagas = fees.filter((f) => f.status === 'paga');
  const boletosPagos = boletos.filter((b) => b.status === 'pago');

  return (
    <>
      <h1 className="page-title">
        <ShieldCheck size={22} style={{ verticalAlign: '-4px', color: 'var(--azul)' }} /> Painel Administrativo
      </h1>
      <p className="page-subtitle">Visão geral das finanças virtuais da paróquia. Bem-vindo(a), {user?.nomeCompleto}.</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Users size={20} /></div>
          <div><div className="stat-label">Usuários cadastrados</div><div className="stat-value">{stats.totalUsers}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Wallet size={20} /></div>
          <div><div className="stat-label">Saldo virtual total</div><div className="stat-value">{formatBRL(stats.totalBalance)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ListOrdered size={20} /></div>
          <div><div className="stat-label">Transações realizadas</div><div className="stat-value">{stats.totalTransactions}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><HandCoins size={20} /></div>
          <div><div className="stat-label">Dízimos registrados</div><div className="stat-value">{formatBRL(stats.totalDizimos)}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ReceiptText size={20} /></div>
          <div><div className="stat-label">Boletos pagos</div><div className="stat-value">{stats.totalBoletosPagos}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Landmark size={20} /></div>
          <div><div className="stat-label">Taxas pagas</div><div className="stat-value">{stats.totalTaxasPagas}</div></div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3><TrendingUp size={17} style={{ verticalAlign: '-3px' }} /> Entradas x Saídas</h3>
          <div className="bar-chart">
            <Bar label="Entradas" value={entradas} max={maxChart} color="green" />
            <Bar label="Saídas" value={saidas} max={maxChart} color="red" />
            <Bar label="Dízimos" value={stats.totalDizimos} max={maxChart} color="gold" />
          </div>
        </div>
        <div className="card">
          <h3><CalendarDays size={17} style={{ verticalAlign: '-3px' }} /> Movimentação — últimos 7 dias</h3>
          <div className="bar-chart">
            {last7.map((d) => (
              <Bar key={d.label} label={d.label} value={d.total} max={max7} />
            ))}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3><HandCoins size={17} style={{ verticalAlign: '-3px' }} /> Últimos dízimos ({dizimosList.length})</h3>
          {dizimosList.length === 0 ? (
            <p className="text-muted">Nenhum dízimo registrado ainda.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Usuário</th><th>Valor</th><th>Data</th></tr></thead>
                <tbody>
                  {dizimosList.slice(0, 5).map((t) => (
                    <tr key={t.id}>
                      <td>{t.userId === user?.id ? 'Administrador' : t.receiverName ?? t.userId.slice(-6)}</td>
                      <td>{formatBRL(t.amount)}</td>
                      <td>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h3><TrendingDown size={17} style={{ verticalAlign: '-3px' }} /> Pagamentos recentes</h3>
          {taxasPagas.length === 0 && boletosPagos.length === 0 ? (
            <p className="text-muted">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
                <tbody>
                  {taxasPagas.slice(0, 3).map((f) => (
                    <tr key={f.id}><td>Taxa</td><td>{f.description}</td><td>{formatBRL(f.amount)}</td></tr>
                  ))}
                  {boletosPagos.slice(0, 3).map((b) => (
                    <tr key={b.code}><td>Boleto</td><td>{b.beneficiary}</td><td>{formatBRL(b.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="features-grid mt-3">
        <Link to="/admin/usuarios" className="feature-card" style={{ textDecoration: 'none' }}>
          <div className="feature-icon"><UserRound size={22} /></div>
          <h3>Gerenciar usuários</h3>
          <p>Ver saldos, bloquear/desbloquear contas e adicionar ou remover dinheiro.</p>
        </Link>
        <Link to="/admin/cobrancas" className="feature-card" style={{ textDecoration: 'none' }}>
          <div className="feature-icon"><Landmark size={22} /></div>
          <h3>Gerenciar cobranças</h3>
          <p>Criar, editar e cancelar taxas e impostos do bairro.</p>
        </Link>
        <Link to="/admin/transacoes" className="feature-card" style={{ textDecoration: 'none' }}>
          <div className="feature-icon"><ListOrdered size={22} /></div>
          <h3>Consultar transações</h3>
          <p>Histórico completo de todas as movimentações do sistema.</p>
        </Link>
      </div>
    </>
  );
}
