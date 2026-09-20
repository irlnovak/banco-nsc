import { Link, useNavigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import { DISCLAIMER } from '../config';
import {
  Zap,
  ReceiptText,
  HandCoins,
  Landmark,
  ListOrdered,
  FileText,
} from 'lucide-react';

const FEATURES = [
  { icon: <Zap size={22} />, title: 'Pix Virtual', text: 'Envie e receba valores com chaves internas @nsconceicao, na hora e sem custo.' },
  { icon: <ReceiptText size={22} />, title: 'Pagamento de boletos', text: 'Consulte pelo código e pague boletos de parceiros da paróquia virtual.' },
  { icon: <HandCoins size={22} />, title: 'Dízimo', text: 'Contribua com a paróquia de forma organizada e acompanhe seu histórico de ofertas.' },
  { icon: <Landmark size={22} />, title: 'Taxas e impostos do bairro', text: 'Quite taxas de manutenção, iluminação e impostos territoriais virtuais.' },
  { icon: <ListOrdered size={22} />, title: 'Extrato financeiro', text: 'Acompanhe cada movimentação com filtros por tipo, data e valor.' },
  { icon: <FileText size={22} />, title: 'Comprovantes', text: 'Gere comprovantes virtuais de todas as operações e imprima quando quiser.' },
];

export default function Home() {
  const navigate = useNavigate();
  return (
    <PublicLayout>
      <div className="page" style={{ width: '100%' }}>
        <section className="hero">
          <h1>Bem-vindo ao Banco Nossa Senhora da Conceição</h1>
          <p>
            A plataforma financeira <strong>virtual</strong> da Paróquia Nossa Senhora da Conceição, criada para a
            comunidade do Habblet. Gerencie contribuições, dízimos, taxas do bairro e movimentações fictícias com a
            praticidade de um internet banking — tudo em um ambiente 100% simulado.
          </p>
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Acessar minha conta
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/cadastro')}>
              Criar minha conta
            </button>
          </div>
        </section>

        <div className="section-head">
          <h2>O que você encontra aqui</h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>

        <div className="card mt-3" style={{ borderLeft: '4px solid var(--azul)' }}>
          <h3>Aviso importante</h3>
          <p className="text-muted" style={{ lineHeight: 1.7 }}>
            {DISCLAIMER} O “Pix Virtual”, os boletos e as taxas existem <strong>apenas dentro deste sistema</strong>.
            Nenhum valor real é movimentado.
          </p>
          <p className="text-muted mt-1">
            Já tem conta? <Link to="/login">Entre aqui</Link> — e conheça também o{' '}
            <Link to="/admin-login">painel do administrador</Link>.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
