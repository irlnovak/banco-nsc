// ============================================================
// Utilitários monetários — TODOS os valores em CENTAVOS (inteiros)
// Isso evita erros clássicos de ponto flutuante (0.1 + 0.2 !== 0.3).
// Formatação para exibição acontece apenas na renderização.
// ============================================================

/** Formata centavos para "R$ 1.250,00" */
export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Converte uma string digitada pelo usuário ("1.250,50" | "1250.50") em centavos */
export function parseBRLToCentavos(input: string): number | null {
  if (!input) return null;
  let cleaned = input.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;
  // Se contém vírgula, é formato pt-BR
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if ((cleaned.match(/\./g) || []).length === 1 && !/^\d{1,3}\.\d{2}$/.test(cleaned)) {
    // ponto único não-decimal → separador de milhar ou decimal
    const parts = cleaned.split('.');
    if (parts[1] && parts[1].length <= 2 && parts[0].length <= 3 && Number.isInteger(Number(cleaned)) === false) {
      // deixa como decimal
    } else if (parts[1] && parts[1].length === 3) {
      cleaned = cleaned.replace('.', '');
    }
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  const centavos = Math.round(value * 100);
  return centavos;
}

/** Converte centavos em valor editável "1250,50" */
export function centavosToInput(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/** ID único para transações */
export function generateId(prefix = 'TX'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let rnd = '';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (const b of arr) rnd += chars[b % chars.length];
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

/** Data e hora em pt-BR */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR');
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} às ${formatTime(ts)}`;
}

/** Calcula quantas semanas inteiras se passaram desde lastSalaryAt */
export function elapsedWeeks(lastSalaryAt: number, now: number): number {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((now - lastSalaryAt) / WEEK);
}

/** Hash simples (SHA-256 via Web Crypto). SIMULAÇÃO — não use para senhas reais. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Validações de formulário */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('mínimo de 8 caracteres');
  if (!/[A-Za-z]/.test(password)) issues.push('pelo menos uma letra');
  if (!/\d/.test(password)) issues.push('pelo menos um número');
  return issues;
}

export function passwordMeetsRequirements(password: string): boolean {
  return passwordIssues(password).length === 0;
}

export function maskAmountSign(direction: 'in' | 'out'): string {
  return direction === 'in' ? '+' : '-';
}
