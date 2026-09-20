// ============================================================
// supabaseService — autenticação e dados REAIS via Supabase.
//
// - Cadastro/login: supabase.auth (hash de senha no servidor,
//   sessão JWT persistida pelo SDK — nunca em texto puro)
// - Dados: tabelas públicas (profiles, transactions, fees, boletos)
//   protegidas por RLS
// - Operações financeiras: funções RPC (security definer) atômicas
//
// SQL completo: supabase/setup.sql
// ============================================================

import type { User, Transaction, Fee, Boleto, PixKey, PixKeyType } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any; // cliente Supabase (tipagem completa em supabaseClient)

export function mapProfile(row: Record<string, unknown>, email?: string): User {
  return {
    id: row.id as string,
    nomeCompleto: row.nome_completo as string,
    username: row.username as string,
    email: (email ?? '') as string,
    senhaHash: '', // nunca trafega — hash vive no Supabase Auth
    dataNascimento: (row.data_nascimento as string) ?? '',
    telefone: (row.telefone as string) ?? '',
    endereco: (row.endereco as string) ?? '',
    bairro: (row.bairro as string) ?? '',
    balance: row.balance as number,
    role: (row.role as 'user' | 'admin') ?? 'user',
    blocked: row.blocked as boolean,
    createdAt: Date.parse((row.created_at as string) ?? '') || Date.now(),
    lastSalaryAt: Date.parse((row.last_salary_at as string) ?? '') || Date.now(),
    pixKeys: (row.pix_keys as PixKey[]) ?? [],
  };
}

export function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as Transaction['type'],
    category: row.category as Transaction['category'],
    description: row.description as string,
    amount: row.amount as number,
    direction: row.direction as 'in' | 'out',
    balanceAfter: row.balance_after as number,
    status: (row.status as Transaction['status']) ?? 'concluida',
    createdAt: Date.parse(row.created_at as string),
    senderName: (row.sender_name as string) ?? undefined,
    receiverName: (row.receiver_name as string) ?? undefined,
    pixKey: (row.pix_key as string) ?? undefined,
    reference: (row.reference as string) ?? undefined,
  };
}

export function mapFee(row: Record<string, unknown>): Fee {
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    dueDate: row.due_date as string,
    bairro: (row.bairro as string) ?? '',
    status: row.status as Fee['status'],
    paidBy: (row.paid_by as string) ?? undefined,
    paidAt: row.paid_at ? Date.parse(row.paid_at as string) : undefined,
    createdAt: Date.parse((row.created_at as string) ?? '') || Date.now(),
  };
}

// ------------------------------------------------------------
// Autenticação
// ------------------------------------------------------------

export async function signUp(
  sb: Sb,
  data: {
    nomeCompleto: string; username: string; email: string; senha: string;
    dataNascimento: string; telefone: string; endereco: string; bairro: string;
  },
): Promise<{ error?: string }> {
  const { error } = await sb.auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.senha,
    options: {
      data: {
        username: data.username.trim(),
        nome_completo: data.nomeCompleto.trim(),
        telefone: data.telefone,
        data_nascimento: data.dataNascimento,
        endereco: data.endereco,
        bairro: data.bairro,
      },
    },
  });
  if (error) {
    const msg = String(error.message ?? '');
    if (/already registered/i.test(msg)) return { error: 'Este e-mail já está cadastrado.' };
    if (/User already exists/i.test(msg)) return { error: 'Este e-mail já está cadastrado.' };
    return { error: msg };
  }
  return {};
}

export async function signInWithLogin(
  sb: Sb,
  login: string,
  senha: string,
): Promise<{ user?: User; error?: string }> {
  let email = login.trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isEmail) {
    // Login por nome de usuário → resolve o e-mail via RPC
    const { data: resolved } = await sb.rpc('email_de_username', { p_username: login.trim() });
    if (!resolved) return { error: 'Usuário ou senha incorretos.' };
    email = resolved;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    const msg = String(error.message ?? '');
    if (/Invalid login credentials/i.test(msg)) return { error: 'Usuário ou senha incorretos.' };
    if (/Email not confirmed/i.test(msg)) return { error: 'Confirmação de e-mail está ativada no Supabase. Desative "Confirm email" ( Authentication → Providers → Email ).' };
    return { error: msg };
  }
  const profile = await fetchProfile(sb);
  if (!profile) return { error: 'Perfil não encontrado. Execute o supabase/setup.sql (trigger handle_new_user).' };
  if (profile.blocked) {
    await sb.auth.signOut();
    return { error: 'Sua conta está bloqueada. Fale com o administrador.' };
  }
  return { user: profile };
}

export async function fetchProfile(sb: Sb): Promise<User | undefined> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return undefined;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error || !data) return undefined;
  return mapProfile(data, auth.user.email);
}

export async function creditarSalarioPendente(sb: Sb, user: User): Promise<{ user: User; credited: number }> {
  const { data, error } = await sb.rpc('creditar_salario');
  if (error || data === null || data === undefined) return { user, credited: 0 };
  const credited = Number(data);
  if (credited <= 0) return { user, credited: 0 };
  const fresh = await fetchProfile(sb);
  return { user: fresh ?? user, credited };
}

export async function updateProfileFields(
  sb: Sb,
  userId: string,
  patch: { nomeCompleto?: string; telefone?: string; endereco?: string; bairro?: string },
): Promise<{ user?: User; error?: string }> {
  const map: Record<string, string> = {};
  if (patch.nomeCompleto !== undefined) map.nome_completo = patch.nomeCompleto;
  if (patch.telefone !== undefined) map.telefone = patch.telefone;
  if (patch.endereco !== undefined) map.endereco = patch.endereco;
  if (patch.bairro !== undefined) map.bairro = patch.bairro;
  const { error } = await sb.from('profiles').update(map).eq('id', userId);
  if (error) return { error: String(error.message) };
  const fresh = await fetchProfile(sb);
  return { user: fresh };
}

export async function changePassword(sb: Sb, novaSenha: string): Promise<{ error?: string }> {
  const { error } = await sb.auth.updateUser({ password: novaSenha });
  return error ? { error: String(error.message) } : {};
}

// ------------------------------------------------------------
// Transações e operações
// ------------------------------------------------------------

export async function getMyTransactions(sb: Sb, userId: string): Promise<Transaction[]> {
  const { data, error } = await sb
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapTransaction);
}

export async function getAllTransactionsAdmin(sb: Sb): Promise<Transaction[]> {
  const { data, error } = await sb
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapTransaction);
}

export async function enviarPix(
  sb: Sb, chave: string, centavos: number, descricao: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  const { data, error } = await sb.rpc('enviar_pix', {
    p_chave: chave, p_valor: centavos, p_descricao: descricao || 'Pix virtual',
  });
  if (error) return { error: friendly(error) };
  return { transaction: mapTransaction(data) };
}

export async function resolverPix(
  sb: Sb, chave: string,
): Promise<{ nome?: string; username?: string } | null> {
  const { data, error } = await sb.rpc('resolver_pix', { p_chave: chave });
  if (error || !data || data.length === 0) return null;
  return { nome: data[0].nome_completo, username: data[0].username };
}

export async function criarChavePix(
  sb: Sb, tipo: PixKeyType, valor: string,
): Promise<{ key?: PixKey; error?: string }> {
  const { data, error } = await sb.rpc('criar_chave_pix', { p_tipo: tipo, p_valor: valor });
  if (error) return { error: friendly(error) };
  const labels: Record<PixKeyType, string> = { email: 'E-mail', telefone: 'Telefone', cpf: 'CPF', aleatoria: 'Chave aleatória' };
  return { key: { value: String(data), type: tipo, label: labels[tipo], createdAt: Date.now() } };
}

export async function deleteChavePix(sb: Sb, userId: string, value: string): Promise<{ error?: string }> {
  const profile = await fetchProfile(sb);
  if (!profile) return { error: 'Usuário não encontrado.' };
  const novas = profile.pixKeys.filter((k) => k.value !== value);
  if (novas.length === profile.pixKeys.length) return { error: 'Chave não encontrada.' };
  const { error } = await sb.from('profiles').update({ pix_keys: novas }).eq('id', userId);
  return error ? { error: String(error.message) } : {};
}

export async function registrarDizimo(
  sb: Sb, centavos: number, descricao: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  const { data, error } = await sb.rpc('registrar_dizimo', { p_valor: centavos, p_descricao: descricao });
  if (error) return { error: friendly(error) };
  return { transaction: mapTransaction(data) };
}

// ------------------------------------------------------------
// Boletos e cobranças
// ------------------------------------------------------------

export async function getBoletos(sb: Sb): Promise<Boleto[]> {
  const { data, error } = await sb.from('boletos').select('*').order('due_date');
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    code: r.code as string,
    beneficiary: r.beneficiary as string,
    amount: r.amount as number,
    dueDate: r.due_date as string,
    description: r.description as string,
    status: r.status as Boleto['status'],
  }));
}

export async function pagarBoleto(
  sb: Sb, codigo: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  const { data, error } = await sb.rpc('pagar_boleto', { p_codigo: codigo });
  if (error) return { error: friendly(error) };
  return { transaction: mapTransaction(data) };
}

export async function getFees(sb: Sb): Promise<Fee[]> {
  const { data, error } = await sb.from('fees').select('*').order('due_date');
  if (error || !data) return [];
  return data.map(mapFee);
}

export async function pagarTaxa(
  sb: Sb, feeId: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  const { data, error } = await sb.rpc('pagar_taxa', { p_fee_id: feeId });
  if (error) return { error: friendly(error) };
  return { transaction: mapTransaction(data) };
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

export async function adminGetUsers(sb: Sb): Promise<User[]> {
  const { data: auth } = await sb.auth.getUser();
  const myEmail = auth?.user?.email;
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  // Busca e-mails de auth (admin lê auth.users via view? não exposto) —
  // usamos o próprio e-mail quando disponível; demais ficam sem.
  return data.map((r: Record<string, unknown>) => mapProfile(r, r.id === auth?.user?.id ? myEmail : undefined));
}

export async function adminSetBlocked(sb: Sb, userId: string, blocked: boolean): Promise<{ error?: string }> {
  const { error } = await sb.from('profiles').update({ blocked }).eq('id', userId);
  return error ? { error: String(error.message) } : {};
}

export async function adminAdjustFunds(
  sb: Sb, userId: string, centavos: number, motivo: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  const { data: profileRow } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!profileRow) return { error: 'Usuário não encontrado.' };
  const target = mapProfile(profileRow);
  if (centavos === 0) return { error: 'O valor não pode ser zero.' };
  if (centavos < 0 && Math.abs(centavos) > target.balance) return { error: 'Saldo do usuário insuficiente para este débito.' };

  const novoSaldo = target.balance + centavos;
  const txId = `TX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const { error: errTx } = await sb.from('transactions').insert({
    id: txId, user_id: userId,
    type: centavos > 0 ? 'admin_credito' : 'admin_debito',
    category: centavos > 0 ? 'entrada' : 'saida',
    description: motivo || (centavos > 0 ? 'Crédito manual do administrador' : 'Débito manual do administrador'),
    amount: Math.abs(centavos), direction: centavos > 0 ? 'in' : 'out',
    balance_after: novoSaldo,
    sender_name: 'Administrador', receiver_name: target.nomeCompleto,
  });
  if (errTx) return { error: friendly(errTx) };
  const { error: errUpd } = await sb.from('profiles').update({ balance: novoSaldo }).eq('id', userId);
  if (errUpd) return { error: friendly(errUpd) };
  const { data: txRow } = await sb.from('transactions').select('*').eq('id', txId).maybeSingle();
  return { transaction: txRow ? mapTransaction(txRow) : undefined };
}

export async function adminSaveFee(
  sb: Sb, fee: { id?: string; description: string; amount: number; dueDate: string; bairro: string },
): Promise<{ error?: string }> {
  if (fee.id) {
    const { error } = await sb.from('fees').update({
      description: fee.description, amount: fee.amount, due_date: fee.dueDate, bairro: fee.bairro,
    }).eq('id', fee.id);
    return error ? { error: friendly(error) } : {};
  }
  const id = `FEE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { error } = await sb.from('fees').insert({
    id, description: fee.description, amount: fee.amount, due_date: fee.dueDate, bairro: fee.bairro,
  });
  return error ? { error: friendly(error) } : {};
}

export async function adminCancelFee(sb: Sb, feeId: string): Promise<{ error?: string }> {
  const { error } = await sb.from('fees').update({ status: 'cancelada' }).eq('id', feeId);
  return error ? { error: String(error.message) } : {};
}

export async function adminStats(sb: Sb): Promise<{
  totalUsers: number; totalBalance: number; totalTransactions: number;
  totalDizimos: number; totalBoletosPagos: number; totalTaxasPagas: number;
}> {
  const [users, txs, boletos, fees] = await Promise.all([
    adminGetUsers(sb),
    getAllTransactionsAdmin(sb),
    getBoletos(sb),
    getFees(sb),
  ]);
  const reais = users.filter((u) => u.role !== 'admin');
  return {
    totalUsers: reais.length,
    totalBalance: reais.reduce((s, u) => s + u.balance, 0),
    totalTransactions: txs.length,
    totalDizimos: txs.filter((t) => t.type === 'dizimo').reduce((s, t) => s + t.amount, 0),
    totalBoletosPagos: boletos.filter((b) => b.status === 'pago').length,
    totalTaxasPagas: fees.filter((f) => f.status === 'paga').length,
  };
}

function friendly(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error ?? '');
  if (/saldo insuficiente/i.test(msg)) return 'Saldo insuficiente para esta operação.';
  if (/valor maior que zero/i.test(msg)) return 'Informe um valor maior que zero.';
  if (/bloqueada/i.test(msg)) return 'Sua conta está bloqueada.';
  return msg;
}
