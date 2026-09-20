import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { createUser } from '../services/databaseService';
import { isValidEmail, isValidPhone, passwordMeetsRequirements, passwordIssues } from '../utils/money';
import { useNotifications } from '../contexts/NotificationContext';
import { TriangleAlert } from 'lucide-react';

interface FormState {
  nomeCompleto: string;
  username: string;
  email: string;
  senha: string;
  confirmar: string;
  dataNascimento: string;
  telefone: string;
  endereco: string;
  bairro: string;
}

const EMPTY: FormState = {
  nomeCompleto: '',
  username: '',
  email: '',
  senha: '',
  confirmar: '',
  dataNascimento: '',
  telefone: '',
  endereco: '',
  bairro: '',
};

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  onChange: (v: string) => void;
}

// ⚠️ Definido FORA do componente Register — se fosse declarado dentro,
// o React recriaria o componente a cada tecla (perda de foco, "1 letra por vez").
function Field({ id, label, type = 'text', value, error, placeholder, hint, className = '', onChange }: FieldProps) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={`input ${error ? 'input-error' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="field-error">{error}</p>}
      {!error && hint && <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const notify = useNotifications();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.nomeCompleto.trim() || form.nomeCompleto.trim().length < 5)
      errs.nomeCompleto = 'Informe seu nome completo (mínimo 5 caracteres).';
    if (!form.username.trim()) errs.username = 'Escolha um nome de usuário.';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim()))
      errs.username = 'Use de 3 a 20 caracteres: letras, números e _.';
    if (!form.email.trim()) errs.email = 'Informe um e-mail (fictício).';
    else if (!isValidEmail(form.email)) errs.email = 'Informe um e-mail válido.';
    if (!passwordMeetsRequirements(form.senha)) errs.senha = `A senha precisa de: ${passwordIssues(form.senha).join(', ')}.`;
    if (form.confirmar !== form.senha) errs.confirmar = 'As senhas não coincidem.';
    if (!form.dataNascimento) errs.dataNascimento = 'Informe sua data de nascimento.';
    else if (new Date(form.dataNascimento) > new Date()) errs.dataNascimento = 'Data inválida.';
    if (!isValidPhone(form.telefone)) errs.telefone = 'Informe um telefone com DDD (ex.: (11) 98888-7777).';
    if (!form.endereco.trim()) errs.endereco = 'Informe seu endereço.';
    if (!form.bairro.trim()) errs.bairro = 'Informe seu bairro.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      notify.error('Verifique o formulário', 'Corrija os campos destacados e tente novamente.');
      return;
    }
    setLoading(true);
    try {
      await createUser({
        nomeCompleto: form.nomeCompleto,
        username: form.username,
        email: form.email,
        senha: form.senha,
        dataNascimento: form.dataNascimento,
        telefone: form.telefone,
        endereco: form.endereco,
        bairro: form.bairro,
      });
      notify.success('Conta criada com sucesso!', 'Você já começa com R$ 1.620,00 de salário semanal (virtual). Faça login.');
      navigate('/login');
    } catch (err) {
      notify.error('Erro ao criar conta', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card wide">
        <div className="auth-logo">
          <Logo height={64} />
          <h1>Criar conta</h1>
          <span className="virtual-badge">🔒 Sistema virtual da paróquia</span>
        </div>

        <div className="card" style={{ background: 'var(--azul-claro)', borderColor: 'var(--azul)', padding: '12px 16px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <TriangleAlert size={18} style={{ color: 'var(--azul)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--azul-escuro)', lineHeight: 1.55 }}>
            <strong>Use apenas dados fictícios.</strong> Este é um sistema virtual do Habblet: nenhum e-mail é
            enviado, nenhuma ligação é feita e nenhum dado real é armazenado. Invente um e-mail e um telefone
            fictícios para o seu personagem.
          </p>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <Field id="nome" label="Nome completo" value={form.nomeCompleto} onChange={set('nomeCompleto')} placeholder="Ex.: Maria Souza" className="full" error={errors.nomeCompleto} />
            <Field id="username" label="Nome de usuário" value={form.username} onChange={set('username')} placeholder="ex.: maria" error={errors.username} hint="Sua chave Pix virtual será usuario@nsconceicao" />
            <Field id="email" label="E-mail (fictício)" type="email" value={form.email} onChange={set('email')} placeholder="maria@habblet.com" error={errors.email} hint="Fictício — pode inventar. Nenhum e-mail real é enviado." />
            <Field id="senha" label="Senha" type="password" value={form.senha} onChange={set('senha')} placeholder="Mín. 8 caracteres, letras e números" error={errors.senha} />
            <Field id="confirmar" label="Confirmação de senha" type="password" value={form.confirmar} onChange={set('confirmar')} placeholder="Repita a senha" error={errors.confirmar} />
            <Field id="nascimento" label="Data de nascimento" type="date" value={form.dataNascimento} onChange={set('dataNascimento')} error={errors.dataNascimento} />
            <Field id="telefone" label="Telefone (fictício)" value={form.telefone} onChange={set('telefone')} placeholder="(11) 98888-7777" error={errors.telefone} hint="Fictício — invente um número do seu personagem virtual." />
            <Field id="endereco" label="Endereço" value={form.endereco} onChange={set('endereco')} placeholder="Rua, número" className="full" error={errors.endereco} />
            <Field id="bairro" label="Bairro" value={form.bairro} onChange={set('bairro')} placeholder="Ex.: Vila Conceição" error={errors.bairro} />
          </div>

          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '4px 0 14px' }}>
            Ao criar a conta você recebe <strong>R$ 1.620,00 virtuais</strong> e passa a receber o salário semanal da
            paróquia toda semana (também virtual).
          </p>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-links">
          <span className="text-muted">Já tem conta?</span>
          <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
