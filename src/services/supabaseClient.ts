// ============================================================
// supabaseClient — cliente do Supabase.
// As variáveis VITE_* (do .env local ou das variáveis do GitHub
// Actions) têm prioridade. Os valores de fallback abaixo mantêm a
// conexão funcionando mesmo sem .env — a chave anon é pública por
// design (o que protege os dados é o Row Level Security no banco).
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(key: string): string {
  try {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.[key] || '';
  } catch {
    return '';
  }
}

const SUPABASE_URL =
  env('VITE_SUPABASE_URL') || 'https://cgstplxwdbhykoylwzje.supabase.co';
const SUPABASE_ANON_KEY =
  env('VITE_SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnc3RwbHh3ZGJoeWtveWx3emplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTg4NTUsImV4cCI6MjEwNTQ5NDg1NX0.AVbqAmq4CnA25K8E0AOkxKO9XXuCtBO10Ixxi-45Ywk';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Retorna o cliente Supabase.
 * NÃO cria sessões anônimas: visitante sem login simplesmente não vê
 * dados (RLS). Todas as operações sensíveis acontecem após o login,
 * com o JWT real do usuário — evitando poluir auth.users e erros 500
 * no gatilho de cadastro.
 */
export async function ensureSupabaseSession(): Promise<SupabaseClient | null> {
  return getSupabase();
}
