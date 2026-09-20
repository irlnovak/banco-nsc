// ============================================================
// authConfig — credenciais administrativas.
//
// ⚠️ EM UM PROJETO FRONTEND-ONLY ESTAS CREDENCIAIS FICAM
// EMBUTIDAS NO JAVASCRIPT E SÃO VISÍVEIS. ISTO É UMA SIMULAÇÃO.
// Autenticação realmente segura exige backend (veja README).
// ============================================================

function env(key: string, fallback: string): string {
  // Em build Vite, import.meta.env é substituído em tempo de build.
  try {
    const value = (import.meta as unknown as { env?: Record<string, string> }).env?.[key];
    return value || fallback;
  } catch {
    return fallback;
  }
}

export const ADMIN_USERNAME = env('VITE_ADMIN_USERNAME', 'admin');
export const ADMIN_PASSWORD = env('VITE_ADMIN_PASSWORD', 'tesoureiro@145');

export const APP_NAME = 'Banco Nossa Senhora da Conceição';
export const DISCLAIMER =
  'Sistema financeiro virtual para uso dentro do Habblet. Não possui integração com instituições financeiras reais.';
