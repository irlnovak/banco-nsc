// ============================================================
// Tipos do Banco Nossa Senhora da Conceição
// Todos os valores monetários são inteiros em CENTAVOS.
// ============================================================

export type UserRole = 'user' | 'admin';

export type PixKeyType = 'email' | 'telefone' | 'cpf' | 'aleatoria';

export interface PixKey {
  value: string;
  type: PixKeyType;
  label: string;
  createdAt: number;
}

export type TransactionType =
  | 'deposito'
  | 'pix_enviado'
  | 'pix_recebido'
  | 'boleto'
  | 'dizimo'
  | 'taxa'
  | 'transferencia'
  | 'salario'
  | 'admin_credito'
  | 'admin_debito';

export type TransactionStatus = 'concluida' | 'pendente' | 'cancelada';

export type TransactionCategory =
  | 'entrada'
  | 'saida'
  | 'pix'
  | 'boleto'
  | 'dizimo'
  | 'taxa'
  | 'transferencia';

export interface User {
  id: string;
  nomeCompleto: string;
  username: string;
  email: string;
  senhaHash: string;
  dataNascimento: string;
  telefone: string;
  endereco: string;
  bairro: string;
  balance: number; // centavos
  role: UserRole;
  blocked: boolean;
  createdAt: number;
  lastSalaryAt: number; // timestamp do último salário semanal creditado
  pixKeys: PixKey[]; // chaves Pix virtuais do usuário
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number; // centavos (sempre positivo)
  direction: 'in' | 'out';
  balanceAfter: number; // centavos
  status: TransactionStatus;
  createdAt: number;
  senderName?: string;
  receiverName?: string;
  pixKey?: string;
  reference?: string; // código de boleto, etc.
}

export interface Fee {
  id: string;
  description: string;
  amount: number; // centavos
  dueDate: string; // yyyy-mm-dd
  bairro: string; // '' = todas
  status: 'pendente' | 'paga' | 'cancelada';
  paidBy?: string; // userId
  paidAt?: number;
  createdAt: number;
}

export interface Boleto {
  code: string;
  beneficiary: string;
  amount: number; // centavos
  dueDate: string;
  description: string;
  status: 'aberto' | 'pago' | 'vencido';
}

export interface Database {
  version: number;
  users: User[];
  transactions: Transaction[];
  fees: Fee[];
  boletos: Boleto[];
  seeded: boolean;
}
