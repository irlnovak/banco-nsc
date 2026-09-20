// ============================================================
// databaseService — camada de dados HÍBRIDA.
//
// MODO NUVO (padrão quando o Supabase está configurado no .env):
//   - Cadastro/login: Supabase Auth (hash de senha no servidor)
//   - Leituras: tabelas reais (profiles, transactions, fees, boletos)
//   - Escritas financeiras: funções RPC atômicas no Postgres
//   - O localStorage é usado apenas como CACHE de renderização —
//     a fonte da verdade é o banco.
//
// MODO LOCAL (fallback, sem .env do Supabase): localStorage puro,
// para desenvolvimento offline.
//
// SQL completo: supabase/setup.sql
// ============================================================

import type { Database, User, Transaction, Fee, Boleto, TransactionType, TransactionCategory, PixKey, PixKeyType } from '../types';
import { generateId, elapsedWeeks } from '../utils/money';
import { ADMIN_PASSWORD } from '../config';
import { getSupabase, ensureSupabaseSession } from './supabaseClient';
import * as cloud from './supabaseService';

export const WEEKLY_SALARY = 162000;
const STORAGE_KEY = 'banco_nsc_db_v2';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** true quando o projeto está conectado ao Supabase (.env configurado) */
export function isCloudMode(): boolean {
  return !!getSupabase();
}

// ============================================================
// CACHE LOCAL (espelho de renderização — não é a fonte da verdade)
// ============================================================
function emptyDb(): Database {
  return { version: 2, users: [], transactions: [], fees: [], boletos: [], seeded: true };
}

function readCache(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const db = JSON.parse(raw) as Database;
    for (const u of db.users) if (!Array.isArray(u.pixKeys)) u.pixKeys = [];
    return db;
  } catch {
    return emptyDb();
  }
}

function writeCache(db: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** Recarrega do Supabase tudo que o usuário logado pode ver. */
export async function reloadCloudCache(): Promise<void> {
  const sb = await ensureSupabaseSession();
  if (!sb) return;
  const profile = await cloud.fetchProfile(sb);
  if (!profile) return;
  const db = emptyDb();
  if (profile.role === 'admin') {
    db.users = await cloud.adminGetUsers(sb);
  } else {
    db.users = [profile];
  }
  db.transactions = await cloud.getMyTransactions(sb, profile.id);
  db.fees = await cloud.getFees(sb);
  db.boletos = await cloud.getBoletos(sb);
  writeCache(db);
}

async function refreshProfileInCache(): Promise<User | undefined> {
  const sb = getSupabase();
  if (!sb) return undefined;
  const profile = await cloud.fetchProfile(sb);
  if (!profile) return undefined;
  const db = readCache();
  const idx = db.users.findIndex((u) => u.id === profile.id);
  if (idx >= 0) db.users[idx] = profile; else db.users.push(profile);
  writeCache(db);
  return profile;
}

async function addTxToCache(tx?: Transaction) {
  if (!tx) return;
  const db = readCache();
  db.transactions.unshift(tx);
  writeCache(db);
}

// ============================================================
// SESSÃO / BOOTSTRAP (chamado pelo AuthContext)
// ============================================================
export async function loadSessionUser(): Promise<{ user?: User; salaryCredited: number }> {
  if (!isCloudMode()) return localRestoreSession();
  const sb0 = getSupabase()!;
  // NÃO cria sessão anônima para visitantes — só restaura se já houver sessão
  const { data: sess } = await sb0.auth.getSession();
  if (!sess?.session) return { salaryCredited: 0 };
  const sb = await ensureSupabaseSession();
  if (!sb) return { salaryCredited: 0 };
  const profile = await cloud.fetchProfile(sb);
  if (!profile) return { salaryCredited: 0 };
  if (profile.blocked) {
    await sb.auth.signOut();
    return { salaryCredited: 0 };
  }
  const { user: updated, credited } = await cloud.creditarSalarioPendente(sb, profile);
  await reloadCloudCache();
  return { user: updated ?? profile, salaryCredited: credited };
}

// ============================================================
// CADASTRO
// ============================================================
export async function createUser(data: {
  nomeCompleto: string; username: string; email: string; senha: string;
  dataNascimento: string; telefone: string; endereco: string; bairro: string;
}): Promise<User> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.signUp(sb, data);
    if (res.error) throw new Error(res.error);
    // O trigger handle_new_user cria o perfil; busca o perfil recém-criado
    await new Promise((r) => setTimeout(r, 600));
    const profile = await cloud.fetchProfile(sb);
    if (profile) {
      const db = readCache();
      if (!db.users.some((u) => u.id === profile.id)) db.users.push(profile);
      writeCache(db);
      return profile;
    }
    throw new Error('Conta criada, mas o perfil ainda não está disponível. Faça login.');
  }
  return localCreateUser(data);
}

export async function usernameExists(username: string): Promise<boolean> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const { data } = await sb.rpc('username_existe', { p_username: username });
    return !!data;
  }
  return localUsernameExists(username);
}

export async function emailExists(email: string): Promise<boolean> {
  // No modo nuvem a verificação real acontece no auth.signUp
  // (retorno amigável "Este e-mail já está cadastrado.")
  if (isCloudMode()) return false;
  return localEmailExists(email);
}

// ============================================================
// LOGIN / AUTENTICAÇÃO
// ============================================================
export async function authenticate(login: string, senha: string): Promise<{ user?: User; error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    return cloud.signInWithLogin(sb, login, senha);
  }
  return localAuthenticate(login, senha);
}

/** Reautentica só para validar a senha atual (troca de senha no perfil). */
export async function verifyPassword(login: string, senha: string): Promise<boolean> {
  const res = await authenticate(login, senha);
  return !!res.user;
}

export async function updateUserPassword(novaSenha: string): Promise<{ error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    return cloud.changePassword(sb, novaSenha);
  }
  return { error: 'Disponível apenas no modo nuvem.' };
}

export async function updateUser(userId: string, patch: Partial<User>): Promise<User> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.updateProfileFields(sb, userId, {
      nomeCompleto: patch.nomeCompleto,
      telefone: patch.telefone,
      endereco: patch.endereco,
      bairro: patch.bairro,
    });
    if (res.error) throw new Error(res.error);
    if (res.user) return res.user;
    return getUserById(userId)!;
  }
  return localUpdateUser(userId, patch);
}

// ============================================================
// SALÁRIO SEMANAL
// ============================================================
export async function applyWeeklySalary(user: User): Promise<{ user: User; credited: number }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.creditarSalarioPendente(sb, user);
    if (res.credited > 0) {
      await refreshProfileInCache();
      await reloadCloudCache();
    }
    return res;
  }
  return localApplyWeeklySalary(user);
}

// ============================================================
// LEITURAS (cache — populado do banco real)
// ============================================================
export function getAllUsers(): User[] {
  return readCache().users;
}

export function getUserById(id: string): User | undefined {
  return readCache().users.find((u) => u.id === id);
}

export function getPixKeys(userId: string): PixKey[] {
  return readCache().users.find((u) => u.id === userId)?.pixKeys ?? [];
}

export function getTransactionsByUser(userId: string): Transaction[] {
  return readCache()
    .transactions.filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllTransactions(): Transaction[] {
  return readCache().transactions.sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllFees(): Fee[] {
  return readCache().fees.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getFeesForUser(user: { id: string; bairro: string }): Fee[] {
  return getAllFees().filter((f) => !f.bairro || f.bairro === user.bairro);
}

export function getAllBoletos(): Boleto[] {
  return readCache().boletos;
}

export function findBoleto(code: string): Boleto | undefined {
  return readCache().boletos.find((b) => b.code === code.trim());
}

export function getAdminStats() {
  const db = readCache();
  const reais = db.users.filter((u) => u.role !== 'admin');
  return {
    totalUsers: reais.length,
    totalBalance: reais.reduce((s, u) => s + u.balance, 0),
    totalTransactions: db.transactions.length,
    totalDizimos: db.transactions.filter((t) => t.type === 'dizimo').reduce((s, t) => s + t.amount, 0),
    totalBoletosPagos: db.boletos.filter((b) => b.status === 'pago').length,
    totalTaxasPagas: db.fees.filter((f) => f.status === 'paga').length,
  };
}

// ============================================================
// OPERAÇÕES FINANCEIRAS (dispacham para RPC no modo nuvem)
// ============================================================
export async function performOperation(opts: {
  userId: string; type: TransactionType; category: TransactionCategory;
  description: string; amount: number; direction: 'in' | 'out';
  senderName?: string; receiverName?: string; pixKey?: string; reference?: string;
}): Promise<{ transaction?: Transaction; error?: string }> {
  if (!isCloudMode()) return localPerformOperation(opts);

  const sb = getSupabase()!;
  if (opts.type === 'pix_recebido') {
    return {}; // o RPC enviar_pix já cria os dois lançamentos no banco
  }
  if (opts.type === 'pix_enviado') {
    const res = await cloud.enviarPix(sb, opts.pixKey ?? '', opts.amount, opts.description);
    if (res.error) return { error: res.error };
    await refreshProfileInCache();
    await reloadCloudCache();
    return res;
  }
  if (opts.type === 'dizimo') {
    const res = await cloud.registrarDizimo(sb, opts.amount, opts.description);
    if (res.error) return { error: res.error };
    await refreshProfileInCache();
    await addTxToCache(res.transaction);
    return res;
  }
  if (opts.type === 'taxa' && opts.reference) {
    const res = await cloud.pagarTaxa(sb, opts.reference);
    if (res.error) return { error: res.error };
    await refreshProfileInCache();
    await addTxToCache(res.transaction);
    await reloadCloudCache(); // atualiza status da cobrança
    return res;
  }
  return { error: 'Operação não suportada no modo nuvem.' };
}

/** Pix completo (débito + crédito no destinatário) — atômico no banco. */
export async function enviarPixVirtual(
  chave: string, centavos: number, descricao: string,
): Promise<{ transaction?: Transaction; error?: string }> {
  if (!isCloudMode()) return { error: 'Modo nuvem necessário para o Pix entre dispositivos.' };
  const sb = getSupabase()!;
  const res = await cloud.enviarPix(sb, chave, centavos, descricao || 'Pix virtual');
  if (res.error) return { error: res.error };
  await refreshProfileInCache();
  await reloadCloudCache();
  return res;
}

/** Resolve uma chave Pix virtual → dados do destinatário (do banco). */
export async function resolverChavePix(
  chave: string,
): Promise<{ nome?: string; username?: string } | null> {
  if (!isCloudMode()) return null;
  const sb = getSupabase()!;
  return cloud.resolverPix(sb, chave);
}

// ============================================================
// CHAVES PIX
// ============================================================
export async function criarChavePix(
  userId: string, type: PixKeyType, value: string,
): Promise<{ key?: PixKey; error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.criarChavePix(sb, type, value);
    if (res.key) await refreshProfileInCache();
    return res;
  }
  return localCreatePixKey(userId, type, value);
}

export async function removerChavePix(userId: string, value: string): Promise<{ error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.deleteChavePix(sb, userId, value);
    if (!res.error) await refreshProfileInCache();
    return res;
  }
  return localDeletePixKey(userId, value);
}

// ============================================================
// BOLETOS E COBRANÇAS
// ============================================================
export async function payBoleto(code: string): Promise<{ transaction?: Transaction; boleto?: Boleto; error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.pagarBoleto(sb, code);
    if (res.error) return { error: res.error };
    await refreshProfileInCache();
    await reloadCloudCache();
    const db = readCache();
    return { transaction: res.transaction, boleto: db.boletos.find((b) => b.code === code.trim()) };
  }
  return localPayBoleto(code);
}

export async function createFee(data: { description: string; amount: number; dueDate: string; bairro: string }): Promise<Fee> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.adminSaveFee(sb, data);
    if (res.error) throw new Error(res.error);
    await reloadCloudCache();
    const db = readCache();
    const fee = db.fees.find((f) => f.description === data.description && f.amount === data.amount);
    if (!fee) throw new Error('Cobrança criada, mas ainda não visível. Atualize a página.');
    return fee;
  }
  return localCreateFee(data);
}

export async function updateFee(id: string, patch: Partial<Fee>): Promise<Fee> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const current = readCache().fees.find((f) => f.id === id);
    if (!current) throw new Error('Cobrança não encontrada.');
    const res = await cloud.adminSaveFee(sb, {
      id,
      description: patch.description ?? current.description,
      amount: patch.amount ?? current.amount,
      dueDate: patch.dueDate ?? current.dueDate,
      bairro: patch.bairro ?? current.bairro,
    });
    if (res.error) throw new Error(res.error);
    await reloadCloudCache();
    return readCache().fees.find((f) => f.id === id)!;
  }
  return localUpdateFee(id, patch);
}

export async function cancelFee(id: string): Promise<Fee> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.adminCancelFee(sb, id);
    if (res.error) throw new Error(res.error);
    await reloadCloudCache();
    return readCache().fees.find((f) => f.id === id)!;
  }
  return localCancelFee(id);
}

// ============================================================
// ADMIN
// ============================================================
export async function setUserBlocked(userId: string, blocked: boolean): Promise<{ error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.adminSetBlocked(sb, userId, blocked);
    if (!res.error) {
      const db = readCache();
      const u = db.users.find((x) => x.id === userId);
      if (u) u.blocked = blocked;
      writeCache(db);
    }
    return res;
  }
  localSetUserBlocked(userId, blocked);
  return {};
}

export async function adminAdjustFunds(userId: string, centavos: number, reason: string): Promise<{ transaction?: Transaction; error?: string }> {
  if (isCloudMode()) {
    const sb = getSupabase()!;
    const res = await cloud.adminAdjustFunds(sb, userId, centavos, reason);
    if (!res.error) {
      await reloadCloudCache();
    }
    return res;
  }
  return localAdminAdjustFunds(userId, centavos, reason);
}

// ============================================================
// ============================================================
//                MODO LOCAL (fallback/offline)
// ============================================================
// ============================================================

function sha256Sim(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return 'somente_ascii';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15: number = w[i - 15];
      const w2: number = w[i - 2];
      const a: number = hash[0];
      const e: number = hash[4];
      const temp1: number =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : w[i - 16] +
              (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
              w[i - 7] +
              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)));
      const temp2: number =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1 >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b >> 4).toString(16) + (b & 15).toString(16);
    }
  }
  return result;
}

function localSeedDemo(db: Database): Database {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const joao: User = {
    id: generateId('US'), nomeCompleto: 'João Silva Santos', username: 'joao',
    email: 'joao@nsconceicao.hab', senhaHash: sha256Sim('joao1234'),
    dataNascimento: '1995-05-14', telefone: '(11) 98888-7777',
    endereco: 'Rua das Flores, 123', bairro: 'Vila Conceição',
    balance: 150000, role: 'user', blocked: false,
    createdAt: now - 30 * day, lastSalaryAt: now - 6 * day,
    pixKeys: [
      { value: 'joao@nsconceicao.hab', type: 'email', label: 'E-mail (cadastro)', createdAt: now },
      { value: '+5511988887777', type: 'telefone', label: 'Telefone (cadastro)', createdAt: now },
    ],
  };
  const admin: User = {
    id: generateId('US'), nomeCompleto: 'Administrador da Paróquia', username: 'admin',
    email: 'admin@nsconceicao.hab', senhaHash: sha256Sim(ADMIN_PASSWORD),
    dataNascimento: '1980-01-01', telefone: '(11) 90000-0000',
    endereco: 'Praça da Matriz, 1', bairro: 'Centro',
    balance: 0, role: 'admin', blocked: false,
    createdAt: now - 60 * day, lastSalaryAt: now, pixKeys: [],
  };
  const txs: Transaction[] = [];
  let saldo = 0;
  const push = (type: Transaction['type'], category: Transaction['category'], description: string, amount: number, direction: 'in' | 'out', ago: number) => {
    saldo += direction === 'in' ? amount : -amount;
    txs.push({ id: generateId(), userId: joao.id, type, category, description, amount, direction, balanceAfter: saldo, status: 'concluida', createdAt: now - ago });
  };
  push('deposito', 'entrada', 'Depósito virtual — boas-vindas', 100000, 'in', 25 * day);
  push('pix_enviado', 'pix', 'Pix enviado para maria@nsconceicao', 10000, 'out', 20 * day);
  push('dizimo', 'dizimo', 'Dízimo — Paróquia Nossa Senhora da Conceição', 5000, 'out', 15 * day);
  push('taxa', 'taxa', 'Taxa do bairro — Iluminação pública (virtual)', 8000, 'out', 10 * day);
  push('boleto', 'boleto', 'Boleto 23791.234.567 — Energia virtual', 12000, 'out', 5 * day);
  push('salario', 'entrada', 'Salário semanal — Paróquia (virtual)', 162000, 'in', 6 * day);
  joao.balance = saldo;
  const isoIn = (days: number) => new Date(now + days * day).toISOString().slice(0, 10);
  db.users.push(admin, joao);
  db.transactions.push(...txs);
  db.fees.push(
    { id: generateId('FEE'), description: 'Taxa de manutenção do bairro', amount: 4500, dueDate: isoIn(5), bairro: 'Vila Conceição', status: 'pendente', createdAt: now },
    { id: generateId('FEE'), description: 'Taxa comunitária', amount: 3000, dueDate: isoIn(9), bairro: '', status: 'pendente', createdAt: now },
    { id: generateId('FEE'), description: 'Imposto territorial virtual', amount: 12000, dueDate: isoIn(12), bairro: '', status: 'pendente', createdAt: now },
    { id: generateId('FEE'), description: 'Taxa de iluminação', amount: 2500, dueDate: isoIn(3), bairro: '', status: 'pendente', createdAt: now },
    { id: generateId('FEE'), description: 'Taxa paroquial', amount: 2000, dueDate: isoIn(15), bairro: '', status: 'pendente', createdAt: now },
    { id: generateId('FEE'), description: 'Taxa de manutenção do bairro — mês anterior', amount: 4500, dueDate: isoIn(-2), bairro: 'Vila Conceição', status: 'pendente', createdAt: now },
  );
  db.boletos.push(
    { code: '2379100010000010000000000000001', beneficiary: 'Casa Elétrica Habblet LTDA', amount: 12000, dueDate: isoIn(7), description: 'Conta de energia virtual', status: 'aberto' },
    { code: '2379100010000010000000000000002', beneficiary: 'Cantina da Paróquia', amount: 4500, dueDate: isoIn(4), description: 'Festa junina — kit lanche', status: 'aberto' },
    { code: '2379100010000010000000000000003', beneficiary: 'Escola Cristo Rei', amount: 30000, dueDate: isoIn(20), description: 'Material escolar virtual', status: 'aberto' },
    { code: '2379100010000010000000000000004', beneficiary: 'Açougue Bom Pastor', amount: 18750, dueDate: isoIn(-3), description: 'Compra do mês', status: 'aberto' },
  );
  db.seeded = true;
  return db;
}

function localReadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return writeCacheAndReturn(localSeedDemo(emptyDb()));
    const db = JSON.parse(raw) as Database;
    for (const u of db.users) if (!Array.isArray(u.pixKeys)) u.pixKeys = [];
    if (!Array.isArray(db.boletos)) db.boletos = [];
    if (!Array.isArray(db.fees)) db.fees = [];
    if (!db.seeded) return writeCacheAndReturn(localSeedDemo(db));
    return db;
  } catch {
    return writeCacheAndReturn(localSeedDemo(emptyDb()));
  }
}

function writeCacheAndReturn(db: Database): Database {
  writeCache(db);
  return db;
}

function localRestoreSession(): { user?: User; salaryCredited: number } {
  const raw = localStorage.getItem('banco_nsc_session');
  if (!raw) return { salaryCredited: 0 };
  try {
    const session = JSON.parse(raw) as { userId: string };
    const user = localReadDb().users.find((u) => u.id === session.userId);
    if (!user || user.blocked) {
      localStorage.removeItem('banco_nsc_session');
      return { salaryCredited: 0 };
    }
    const { user: updated, credited } = localApplyWeeklySalary(user);
    return { user: updated, salaryCredited: credited };
  } catch {
    return { salaryCredited: 0 };
  }
}

function localCreateUser(data: { nomeCompleto: string; username: string; email: string; senha: string; dataNascimento: string; telefone: string; endereco: string; bairro: string }): User {
  const db = localReadDb();
  if (localUsernameExists(data.username)) throw new Error('Este nome de usuário já está em uso.');
  if (localEmailExists(data.email)) throw new Error('Este e-mail já está cadastrado.');
  const user: User = {
    id: generateId('US'),
    nomeCompleto: data.nomeCompleto.trim(),
    username: data.username.trim(),
    email: data.email.trim().toLowerCase(),
    senhaHash: sha256Sim(data.senha),
    dataNascimento: data.dataNascimento,
    telefone: data.telefone,
    endereco: data.endereco,
    bairro: data.bairro,
    balance: WEEKLY_SALARY,
    role: 'user',
    blocked: false,
    createdAt: Date.now(),
    lastSalaryAt: Date.now(),
    pixKeys: [
      { value: data.email.trim().toLowerCase(), type: 'email' as const, label: 'E-mail (cadastro)', createdAt: Date.now() },
      { value: '+55' + data.telefone.replace(/\D/g, ''), type: 'telefone' as const, label: 'Telefone (cadastro)', createdAt: Date.now() },
    ],
  };
  db.users.push(user);
  db.transactions.push({
    id: generateId(), userId: user.id, type: 'deposito', category: 'entrada',
    description: 'Depósito virtual — abertura de conta', amount: WEEKLY_SALARY,
    direction: 'in', balanceAfter: WEEKLY_SALARY, status: 'concluida', createdAt: Date.now(),
  });
  writeCache(db);
  return user;
}

function localUsernameExists(username: string): boolean {
  return localReadDb().users.some((u) => u.username.toLowerCase() === username.toLowerCase());
}

function localEmailExists(email: string): boolean {
  return localReadDb().users.some((u) => u.email.toLowerCase() === email.toLowerCase());
}

function localAuthenticate(login: string, senha: string): { user?: User; error?: string } {
  const user = localReadDb().users.find(
    (u) => u.username.toLowerCase() === login.toLowerCase() || u.email.toLowerCase() === login.toLowerCase(),
  );
  if (!user) return { error: 'Usuário ou senha incorretos.' };
  if (sha256Sim(senha) !== user.senhaHash) return { error: 'Usuário ou senha incorretos.' };
  if (user.blocked) return { error: 'Sua conta está bloqueada. Fale com o administrador.' };
  return { user };
}

function localApplyWeeklySalary(user: User): { user: User; credited: number } {
  const now = Date.now();
  const weeks = elapsedWeeks(user.lastSalaryAt, now);
  if (weeks < 1) return { user, credited: 0 };
  const total = weeks * WEEKLY_SALARY;
  const updated = localUpdateUser(user.id, {
    balance: user.balance + total,
    lastSalaryAt: user.lastSalaryAt + weeks * WEEK_MS,
  });
  const db = localReadDb();
  db.transactions.push({
    id: generateId(), userId: user.id, type: 'salario', category: 'entrada',
    description: weeks > 1 ? `Salário semanal — Paróquia (virtual), ${weeks} semanas` : 'Salário semanal — Paróquia (virtual)',
    amount: total, direction: 'in', balanceAfter: updated.balance, status: 'concluida', createdAt: now,
  });
  writeCache(db);
  return { user: updated, credited: total };
}

function localUpdateUser(userId: string, patch: Partial<User>): User {
  const db = localReadDb();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('Usuário não encontrado.');
  db.users[idx] = { ...db.users[idx], ...patch };
  writeCache(db);
  return db.users[idx];
}

function localPerformOperation(opts: {
  userId: string; type: TransactionType; category: TransactionCategory;
  description: string; amount: number; direction: 'in' | 'out';
  senderName?: string; receiverName?: string; pixKey?: string; reference?: string;
}): { transaction?: Transaction; error?: string } {
  const db = localReadDb();
  const user = db.users.find((u) => u.id === opts.userId);
  if (!user) return { error: 'Usuário não encontrado.' };
  if (user.blocked) return { error: 'Sua conta está bloqueada.' };
  if (!Number.isInteger(opts.amount) || opts.amount <= 0) return { error: 'Informe um valor válido maior que zero.' };
  if (opts.direction === 'out' && opts.amount > user.balance) return { error: 'Saldo insuficiente para esta operação.' };

  const balanceAfter = opts.direction === 'in' ? user.balance + opts.amount : user.balance - opts.amount;
  user.balance = balanceAfter;
  // No modo local, o pagamento de taxa também atualiza a cobrança
  if (opts.type === 'taxa' && opts.reference) {
    const fee = db.fees.find((f) => f.id === opts.reference);
    if (fee && fee.status === 'pendente') {
      fee.status = 'paga';
      fee.paidBy = opts.userId;
      fee.paidAt = Date.now();
    }
  }
  const tx: Transaction = {
    id: generateId(), userId: opts.userId, type: opts.type, category: opts.category,
    description: opts.description, amount: opts.amount, direction: opts.direction,
    balanceAfter, status: 'concluida', createdAt: Date.now(),
    senderName: opts.senderName, receiverName: opts.receiverName, pixKey: opts.pixKey, reference: opts.reference,
  };
  db.transactions.push(tx);
  writeCache(db);
  return { transaction: tx };
}

function localPayBoleto(code: string): { transaction?: Transaction; boleto?: Boleto; error?: string } {
  const db = localReadDb();
  const session = JSON.parse(localStorage.getItem('banco_nsc_session') ?? '{}') as { userId?: string };
  const userId = session.userId;
  const boleto = db.boletos.find((b) => b.code === code.trim());
  if (!boleto) return { error: 'Boleto não encontrado. Verifique o código digitado.' };
  if (boleto.status === 'pago') return { error: 'Este boleto já foi pago.' };
  if (!userId) return { error: 'Sessão expirada. Faça login novamente.' };
  const res = localPerformOperation({
    userId, type: 'boleto', category: 'boleto',
    description: `Boleto pago — ${boleto.beneficiary}`, amount: boleto.amount, direction: 'out',
    receiverName: boleto.beneficiary, reference: boleto.code,
  });
  if (res.error) return { error: res.error };
  const b = db.boletos.find((x) => x.code === boleto.code)!;
  b.status = 'pago';
  writeCache(db);
  return { transaction: res.transaction, boleto: b };
}

function localCreateFee(data: { description: string; amount: number; dueDate: string; bairro: string }): Fee {
  const db = localReadDb();
  const fee: Fee = { id: generateId('FEE'), description: data.description.trim(), amount: data.amount, dueDate: data.dueDate, bairro: data.bairro, status: 'pendente', createdAt: Date.now() };
  db.fees.push(fee);
  writeCache(db);
  return fee;
}

function localUpdateFee(id: string, patch: Partial<Fee>): Fee {
  const db = localReadDb();
  const idx = db.fees.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error('Cobrança não encontrada.');
  db.fees[idx] = { ...db.fees[idx], ...patch };
  writeCache(db);
  return db.fees[idx];
}

function localCancelFee(id: string): Fee {
  return localUpdateFee(id, { status: 'cancelada' });
}

function localSetUserBlocked(userId: string, blocked: boolean) {
  localUpdateUser(userId, { blocked });
}

function localAdminAdjustFunds(userId: string, centavos: number, reason: string): { transaction?: Transaction; error?: string } {
  const db = localReadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { error: 'Usuário não encontrado.' };
  if (centavos === 0) return { error: 'O valor não pode ser zero.' };
  if (centavos < 0 && Math.abs(centavos) > user.balance) return { error: 'Saldo do usuário insuficiente para este débito.' };
  user.balance += centavos;
  const tx: Transaction = {
    id: generateId(), userId, type: centavos > 0 ? 'admin_credito' : 'admin_debito',
    category: centavos > 0 ? 'entrada' : 'saida',
    description: reason.trim() || 'Ajuste manual do administrador',
    amount: Math.abs(centavos), direction: centavos > 0 ? 'in' : 'out',
    balanceAfter: user.balance, status: 'concluida', createdAt: Date.now(),
    senderName: 'Administrador', receiverName: user.nomeCompleto,
  };
  db.transactions.push(tx);
  writeCache(db);
  return { transaction: tx };
}

function localCreatePixKey(userId: string, type: PixKeyType, value: string): { key?: PixKey; error?: string } {
  const db = localReadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { error: 'Usuário não encontrado.' };
  let normalized = value.trim();
  if (type === 'email') {
    normalized = normalized.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { error: 'Informe um e-mail válido (fictício).' };
  } else if (type === 'telefone') {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) return { error: 'Informe um telefone com DDD (fictício).' };
    normalized = '+55' + digits;
  } else if (type === 'cpf') {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length !== 11) return { error: 'O CPF fictício deve ter 11 dígitos.' };
    normalized = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else {
    normalized = normalized.toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(normalized)) return { error: 'Chave aleatória: use 3–40 caracteres (letras, números, . _ -).' };
  }
  if (user.pixKeys.some((k) => k.value.toLowerCase() === normalized)) return { error: 'Você já possui esta chave.' };
  if (db.users.some((u) => u.pixKeys.some((k) => k.value.toLowerCase() === normalized))) {
    return { error: 'Esta chave já está em uso por outra conta.' };
  }
  const labels: Record<PixKeyType, string> = { email: 'E-mail', telefone: 'Telefone', cpf: 'CPF', aleatoria: 'Chave aleatória' };
  const pixKey: PixKey = { value: normalized, type, label: labels[type], createdAt: Date.now() };
  user.pixKeys.push(pixKey);
  writeCache(db);
  return { key: pixKey };
}

function localDeletePixKey(userId: string, value: string): { error?: string } {
  const db = localReadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { error: 'Usuário não encontrado.' };
  const before = user.pixKeys.length;
  user.pixKeys = user.pixKeys.filter((k) => k.value !== value);
  if (user.pixKeys.length === before) return { error: 'Chave não encontrada.' };
  writeCache(db);
  return {};
}

/** Compat: busca o dono de uma chave no cache local (modo offline). */
export function findUserByPixKey(rawKey: string): User | undefined {
  const key = rawKey.trim().toLowerCase();
  if (!key) return undefined;
  const db = readCache();
  const digits = key.replace(/\D/g, '');
  return db.users.find((u) =>
    u.pixKeys.some((k) => {
      const kv = k.value.toLowerCase();
      if (kv === key) return true;
      if (k.type === 'telefone' && digits.length >= 10 && kv.replace(/\D/g, '').endsWith(digits)) return true;
      if (key.endsWith('@nsconceicao') || key.endsWith('@nsconceicao.hab')) {
        const username = key.replace(/@nsconceicao\.?hab?\.?$/, '').replace('@nsconceicao', '');
        if (u.username.toLowerCase() === username) return true;
      }
      return false;
    }),
  );
}
