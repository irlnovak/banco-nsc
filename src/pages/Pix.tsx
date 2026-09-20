import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  enviarPixVirtual,
  resolverChavePix,
  getPixKeys,
  criarChavePix,
  removerChavePix,
  findUserByPixKey,
  isCloudMode,
} from '../services/databaseService';
import { formatBRL, parseBRLToCentavos, formatDateTime } from '../utils/money';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptModal from '../components/ReceiptModal';
import Modal from '../components/Modal';
import type { Transaction, PixKeyType } from '../types';
import { Zap, KeyRound, PlusCircle, Trash2, Copy, Check } from 'lucide-react';

export default function Pix() {
  const { user, refreshUser } = useAuth();
  const notify = useNotifications();
  const [params] = useSearchParams();
  const isTransferencia = params.get('modo') === 'transferencia';
  const [aba, setAba] = useState<'enviar' | 'chaves'>(isTransferencia ? 'enviar' : 'enviar');

  // ---- Enviar Pix ----
  const [chave, setChave] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [destNome, setDestNome] = useState<string | null>(null);
  const [destUsername, setDestUsername] = useState<string | null>(null);

  // ---- Minhas chaves ----
  const [keysVersion, setKeysVersion] = useState(0);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<PixKeyType>('aleatoria');
  const [novoValor, setNovoValor] = useState('');
  const [keyError, setKeyError] = useState('');
  const [copied, setCopied] = useState('');

  const centavos = useMemo(() => parseBRLToCentavos(valor) ?? 0, [valor]);

  if (!user) return null;

  const minhasChaves = getPixKeys(user.id);
  void keysVersion; // força releitura do cache após cada alteração

  // Resolve a chave no BANCO (nuvem) ou no cache local, com debounce
  useEffect(() => {
    const key = chave.trim();
    if (!key) {
      setDestNome(null);
      setDestUsername(null);
      return;
    }
    const t = setTimeout(async () => {
      if (isCloudMode()) {
        const res = await resolverChavePix(key);
        setDestNome(res?.nome ?? null);
        setDestUsername(res?.username ?? null);
      } else {
        const found = findUserByPixKey(key);
        setDestNome(found?.nomeCompleto ?? null);
        setDestUsername(found?.username ?? null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [chave]);

  const destinatarioValido = !!destNome && destUsername !== user.username;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!chave.trim()) {
      setError('Informe a chave Pix virtual do destinatário.');
      return;
    }
    if (!destNome) {
      setError('Chave Pix virtual não encontrada. Veja as chaves válidas na aba "Minhas chaves".');
      return;
    }
    if (destUsername === user.username) {
      setError('Você não pode enviar um Pix para si mesmo.');
      return;
    }
    if (centavos <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (centavos > user.balance) {
      setError('Saldo insuficiente para esta operação.');
      return;
    }
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (!destNome) return;
    setLoading(true);
    const result = await enviarPixVirtual(chave.trim(), centavos, descricao.trim());
    setLoading(false);
    if (result.error || !result.transaction) {
      setConfirmOpen(false);
      notify.error('Erro na operação', result.error ?? 'Tente novamente.');
      return;
    }
    setConfirmOpen(false);
    setReceipt(result.transaction);
    await refreshUser();
    setKeysVersion((v) => v + 1);
    notify.success('Transferência realizada com sucesso!', 'Seu Pix virtual foi processado.');
    setChave('');
    setValor('');
    setDescricao('');
  };

  // ---- Chaves ----
  const addKey = async () => {
    setKeyError('');
    const result = await criarChavePix(user.id, novoTipo, novoValor);
    if (result.error || !result.key) {
      setKeyError(result.error ?? 'Não foi possível criar a chave.');
      return;
    }
    setAddKeyOpen(false);
    setNovoValor('');
    setKeysVersion((v) => v + 1);
    notify.success('Chave Pix criada', `${result.key.label}: ${result.key.value}`);
  };

  const removeKey = async (value: string) => {
    const result = await removerChavePix(user.id, value);
    if (result.error) {
      notify.error('Erro', result.error);
      return;
    }
    setKeysVersion((v) => v + 1);
    notify.info('Chave removida', value);
  };

  const copyKey = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied(''), 2000);
      },
      () => notify.error('Erro', 'Não foi possível copiar.'),
    );
  };

  const placeholderFor = (t: PixKeyType): string =>
    t === 'email' ? 'maria@habblet.com (fictício)'
    : t === 'telefone' ? '(11) 98888-7777 (fictício)'
    : t === 'cpf' ? '123.456.789-00 (fictício)'
    : 'ex.: chave-da-vila-conceicao';

  return (
    <>
      <h1 className="page-title">{isTransferencia ? 'Transferência virtual' : 'Pix Virtual'}</h1>
      <p className="page-subtitle">
        Pix interno e fictício da paróquia. Envie usando e-mail, telefone, CPF ou chave aleatória cadastrados em
        "Minhas chaves" — nada é enviado ao Pix real.
      </p>

      <div className="filters">
        <button className={`chip ${aba === 'enviar' ? 'active' : ''}`} onClick={() => setAba('enviar')}>
          <Zap size={14} style={{ verticalAlign: '-2px' }} /> Enviar Pix
        </button>
        <button className={`chip ${aba === 'chaves' ? 'active' : ''}`} onClick={() => setAba('chaves')}>
          <KeyRound size={14} style={{ verticalAlign: '-2px' }} /> Minhas chaves ({minhasChaves.length})
        </button>
      </div>

      {aba === 'enviar' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="chave">Chave Pix virtual do destinatário</label>
              <input
                id="chave"
                className={`input ${error ? 'input-error' : ''}`}
                placeholder="email@ficticio.com, telefone ou chave aleatória"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
              />
              {chave.trim() && (
                <p className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                  {destNome
                    ? `✅ Destinatário: ${destNome} (@${destUsername})`
                    : 'Chave ainda não encontrada no banco de dados.'}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="valor">Valor (R$)</label>
              <input
                id="valor"
                className={`input ${error ? 'input-error' : ''}`}
                placeholder="0,00"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="desc">Descrição (opcional)</label>
              <input
                id="desc"
                className="input"
                placeholder="Ex.: lanche da festa junina"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={!destinatarioValido && !!chave.trim()}>
              <Zap size={17} /> {isTransferencia ? 'Transferir' : 'Enviar Pix'}
            </button>
          </form>

          <p className="text-muted mt-2" style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
            💡 O formato clássico <code>usuario@nsconceicao</code> também funciona. As chaves de cada pessoa ficam na
            aba <strong>Minhas chaves</strong>.
          </p>
        </div>
      )}

      {aba === 'chaves' && (
        <>
          <div className="section-head">
            <h2>Minhas chaves Pix virtuais</h2>
            <button className="btn btn-primary btn-sm" onClick={() => { setNovoTipo('aleatoria'); setNovoValor(''); setKeyError(''); setAddKeyOpen(true); }}>
              <PlusCircle size={15} /> Nova chave
            </button>
          </div>

          {minhasChaves.length === 0 ? (
            <div className="card">
              <p className="text-muted">Você ainda não possui chaves. Crie uma para receber Pix virtuais.</p>
            </div>
          ) : (
            <div className="tx-list">
              {minhasChaves.map((k) => (
                <div className="tx-item" key={k.value}>
                  <div className="tx-icon in"><KeyRound size={18} /></div>
                  <div className="tx-info">
                    <strong style={{ overflow: 'visible', whiteSpace: 'normal' }}>{k.value}</strong>
                    <div className="tx-meta">
                      <span>{k.label}</span>
                      <span>criada em {new Date(k.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyKey(k.value)} title="Copiar chave">
                    {copied === k.value ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeKey(k.value)} title="Remover chave">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>
            As chaves do cadastro (e-mail e telefone fictícios) são criadas automaticamente quando você cria a conta.
          </p>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Confirme sua transferência"
        message="Revise os dados antes de confirmar. Operações Pix não podem ser desfeitas."
        confirmLabel="Confirmar transferência"
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="mt-2">
          <div className="receipt-row"><span className="k">Destinatário</span><span className="v">{destNome}</span></div>
          <div className="receipt-row"><span className="k">Chave</span><span className="v">{chave}</span></div>
          <div className="receipt-row"><span className="k">Valor</span><span className="v">{formatBRL(centavos)}</span></div>
          <div className="receipt-row"><span className="k">Data</span><span className="v">{formatDateTime(Date.now())}</span></div>
          {descricao && <div className="receipt-row"><span className="k">Descrição</span><span className="v">{descricao}</span></div>}
        </div>
      </ConfirmationModal>

      <Modal open={addKeyOpen} title="Nova chave Pix virtual" onClose={() => setAddKeyOpen(false)}>
        <div className="field">
          <label htmlFor="ktipo">Tipo de chave</label>
          <select id="ktipo" className="input" value={novoTipo} onChange={(e) => { setNovoTipo(e.target.value as PixKeyType); setNovoValor(''); }}>
            <option value="aleatoria">Chave aleatória</option>
            <option value="email">E-mail (fictício)</option>
            <option value="telefone">Telefone (fictício)</option>
            <option value="cpf">CPF (fictício)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="kvalor">{novoTipo === 'aleatoria' ? 'Nome da chave aleatória' : 'Valor da chave'}</label>
          <input id="kvalor" className={`input ${keyError ? 'input-error' : ''}`} placeholder={placeholderFor(novoTipo)} value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
          {novoTipo !== 'aleatoria' && (
            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
              Use um dado fictício do seu personagem do Habblet — nada real é validado.
            </p>
          )}
        </div>
        {keyError && <p className="field-error">{keyError}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setAddKeyOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={addKey}>Criar chave</button>
        </div>
      </Modal>

      <ReceiptModal transaction={receipt} onClose={() => setReceipt(null)} />
    </>
  );
}
