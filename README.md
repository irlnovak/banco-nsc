# 🏦 Banco Nossa Senhora da Conceição

**Sistema financeiro virtual da Paróquia Nossa Senhora da Conceição** — um internet banking completo, profissional e responsivo criado para a comunidade do **Habblet**.

> ⚠️ **Aviso importante:** este sistema é 100% **virtual/fictício**. Nenhuma integração com bancos reais, Pix real ou instituições financeiras é realizada. Nenhum dinheiro real é movimentado.

---

## 🛠 ATENÇÃO — Correção do banco de dados (setup.sql v3)

Se você executou uma versão anterior do `supabase/setup.sql`, **rode a nova versão** para reparar o projeto. A versão antiga tinha **dois bugs que impediam qualquer cadastro**:

1. **Erro 500 no cadastro** ("Database error saving new user"): o gatilho `handle_new_user` usava o operador `- 'null'::jsonb`, que **não existe no Postgres**. Todo `signUp` era cancelado pelo Supabase Auth.
2. **Funções criadas antes das tabelas**: `is_admin()` referenciava `public.profiles` antes de ela existir, quebrando as políticas RLS em cascata em bancos novos.

A v3 também corrige o gatilho `protect_profile`, que bloqueava as próprias funções financeiras (Pix, dízimo, salário) de atualizarem o saldo.

**Como reparar (2 minutos):**

1. Abra o **Supabase Dashboard** → **SQL Editor** → *New query*;
2. Cole **todo** o conteúdo de [`supabase/setup.sql`](./supabase/setup.sql) e clique em **Run** (a v3 é idempotente — pode rodar sobre a antiga sem problemas);
3. Volte ao app e crie a conta normalmente. O perfil nasce com **R$ 1.620,00** e chaves Pix automáticas (e-mail e telefone do cadastro);
4. Para virar administrador, no SQL Editor: `update public.profiles set role = 'admin' where username = 'SEU_USERNAME';`

> A chave `anon` do Supabase é pública por design — quem protege os dados é o **Row Level Security**. Senhas reais ficam com hash no Supabase Auth, nunca no frontend.


## 📋 Descrição

O **Banco Nossa Senhora da Conceição** permite que membros da paróquia virtual criem uma conta, acompanhem seu saldo e movimentações, enviem **Pix virtual**, paguem **boletos fictícios**, contribuam com o **dízimo**, quitem **taxas e impostos do bairro** e gerem **comprovantes** — tudo em uma interface inspirada em bancos modernos, com identidade visual azul `#0055A6` e branco.

### Funcionalidades

- ✅ Cadastro e login com validações completas
- ✅ Dashboard com saldo (ocultar/exibir), atalhos e últimas movimentações
- ✅ **Pix Virtual** interno com **chaves Pix** (criar, listar, copiar e remover chaves do tipo e-mail, telefone, CPF e aleatória — criadas automaticamente a partir do cadastro), confirmação e comprovante
- ✅ **Pagamento de boletos** fictícios por código
- ✅ **Dízimo** com valor, data e observação
- ✅ **Taxas e impostos do bairro** (paga, filtra por bairro, registra extrato)
- ✅ **Extrato** com filtros por tipo, data e valor
- ✅ **Comprovantes** virtuais com impressão/PDF (via Impressão do navegador)
- ✅ **Salário semanal automático** — toda semana o usuário recebe **R$ 1.620,00** (creditado ao carregar o sistema); contas novas começam com esse valor
- ✅ **Painel administrativo**: estatísticas, gráficos, gestão de usuários (bloquear/desbloquear), **adicionar/remover dinheiro dos usuários**, criar/editar/cancelar cobranças, consultar transações
- ✅ Notificações de sucesso, erro e confirmações antes de cada operação
- ✅ Regras financeiras: sem saldo negativo, sem valores zero/negativos, IDs únicos, centavos inteiros (sem erros de ponto flutuante)
- ✅ Responsivo (desktop, tablet e celular com menu lateral retrátil)
- ✅ Logo em **pixel art** (tela de login, cabeçalho, sidebar, admin e favicon)

### Demonstração

| Perfil | Usuário | Senha |
|---|---|---|
| Usuário | `joao` | `joao1234` |
| Administrador | `admin` | `tesoureiro@145` *(configurável via `.env` — veja abaixo)* |

Boletos de demonstração aparecem na tela "Pagar boleto" com seus códigos.

---

## 🛠 Tecnologias

- [React 18](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev)
- React Router (HashRouter — compatível com GitHub Pages)
- [lucide-react](https://lucide.dev) (ícones)
- LocalStorage com camada de abstração (`databaseService`)
- GitHub Pages + GitHub Actions

---

## 🚀 Instalação

```bash
git clone URL_DO_REPOSITORIO
cd banco-nossa-senhora-da-conceicao
npm install
```

## ▶️ Executar localmente

```bash
npm run dev
```

Abra `http://localhost:5173` no navegador.

## 📦 Build

```bash
npm run build     # gera a pasta dist/
npm run preview   # pré-visualiza o build localmente
```

---

## 🧪 Credenciais do administrador (`.env`)

```bash
cp .env.example .env
```

```env
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=tesoureiro@145

# OPCIONAL — sincronização entre dispositivos
# Aponte para um endpoint REST simples que aceite GET (baixar banco) e
# POST (salvar banco) em JSON. Sem isso, os dados ficam só no navegador.
# VITE_SYNC_URL=
```

> ⚠️ **Segurança — LEIA:** em um projeto **frontend-only** qualquer credencial `VITE_*` fica **embutida no JavaScript** do bundle e é visível para quem inspecionar o site. Isso é aceitável apenas porque o sistema é fictício. **Autenticação realmente segura exige backend** (Supabase, Node/Express, Firebase etc.) com hash de senha no servidor e sessões via token. A arquitetura deste projeto já isola a persistência (`databaseService`) justamente para facilitar essa migração.

## 🔄 Sincronização entre dispositivos com Supabase (PC ↔ celular)

Por padrão os dados ficam no **LocalStorage do navegador** — uma conta criada no PC **não aparece automaticamente** no celular, pois cada navegador tem seu próprio armazenamento.

A solução é conectar o projeto a um **Supabase** (Postgres + Auth gratuitos). O código deste repositório **já está integrado**: basta seguir o passo a passo abaixo e configurar o `.env`.

> ℹ️ **Divisão importante:** o Supabase hospeda apenas o **banco de dados**. O site em si (frontend React/Vite) continua hospedado no **GitHub Pages** (ou Vercel/Netlify). São duas coisas independentes.

### Passo 1 — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta grátis.
2. Clique em **New project** → dê um nome (ex.: `banco-nsc`) → escolha uma senha do banco (guarde-a) → região `South America (São Paulo)` → **Create new project**.
3. Aguarde ~2 minutos até o projeto ficar ativo.

### Passo 2 — Criar a tabela (SQL Editor)

1. No menu lateral, clique no ícone **SQL** (SQL Editor) → **New query**.
2. Cole **todo o conteúdo** do arquivo [`supabase/setup.sql`](supabase/setup.sql) deste projeto e clique em **Run**.
3. Isso cria a tabela `banco_state` com **Row Level Security** já ativado (sem RLS, qualquer pessoa com a chave pública poderia ler/escrever os dados — não pule este passo).

### Passo 3 — Configurar a autenticação

As políticas de RLS exigem sessão autenticada. O app cria isso sozinho via *sign-in anônimo*, mas você precisa ativar no painel:

1. **Authentication → Sign In / Providers → Anonymous** → ligue (**ON**) → Save.
2. Ainda em **Sign In / Providers → Email** → **desmarque "Confirm email"** → Save (os e-mails dos usuários são fictícios; ninguém recebe e-mail de verdade).

### Passo 4 — Copiar as chaves para o `.env`

1. No Supabase: **Project Settings (⚙️) → API**.
2. Copie **Project URL** e a chave **anon public**.
3. No projeto, crie o arquivo `.env` (use o `.env.example` como base):

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...sua-anon-key...
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=tesoureiro@145
```

4. Se for publicar no GitHub Pages, adicione **as mesmas variáveis** em **Settings → Secrets and variables → Actions → Variables** (ou use repositório privado — a anon key é pública por design, mas as credenciais de admin não deveriam estar no bundle).

### Passo 5 — Testar

```bash
npm install
npm run dev
```

- Crie uma conta no PC → faça uma operação (Pix, dízimo…).
- Abra o mesmo site no **celular** → faça login com a mesma conta → o saldo, o extrato e as cobranças estarão lá. ✅

**Como funciona:** cada operação grava localmente **e** envia o banco completo para a tabela `banco_state` no Supabase (`syncService.push`). Em um dispositivo novo sem dados locais, o app baixa o banco remoto antes do login (`syncService.pull`). Tudo centralizado em `src/services/syncService.ts` e `src/services/supabaseClient.ts`.

> ⚠️ **Limitação honesta desta arquitetura (multi-dispositivo simultâneo):** como o banco é um JSON único sincronizado por operação, se duas pessoas usarem o sistema **ao mesmo tempo** em aparelhos diferentes, a última gravação sobrescreve a anterior. Para uma paróquia do Habblet isso raramente importa; para concorrência real, migre para tabelas por entidade (`users`, `transactions`…) — o tipo `Database` em `src/types` já descreve o schema, e `databaseService.ts` continua sendo o único arquivo a alterar.

---

## 🌐 Publicar no GitHub Pages

### 1. Criar o repositório

1. Acesse [github.com/new](https://github.com/new) e crie um repositório (ex.: `banco-nsc`).
2. Não marque "Initialize with README".

### 2. Enviar o projeto

```bash
cd banco-nossa-senhora-da-conceicao
git init
git add .
git commit -m "feat: Banco Nossa Senhora da Conceição v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/banco-nsc.git
git push -u origin main
```

### 3. Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em **Source**, escolha **GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` já está configurado para: instalar dependências → validar TypeScript → build → publicar automaticamente a pasta `dist/`.
4. A cada `git push` na branch `main`, o deploy acontece sozinho.

O site ficará disponível em `https://SEU_USUARIO.github.io/banco-nsc/`.

### 4. Atualizar o projeto depois

```bash
git add .
git commit -m "descreva sua alteração"
git push
```

O GitHub Actions fará o novo deploy automaticamente.

> O projeto usa **HashRouter** e `base: './'` no Vite, o que evita os clássicos erros 404 do GitHub Pages em rotas, assets, CSS, imagens e favicon.

---

## 🗂 Estrutura de arquivos

```text
banco-nossa-senhora-da-conceicao/
├── .github/
│   └── workflows/
│       └── deploy.yml              # Deploy automático para GitHub Pages
├── public/
│   └── favicon.png                 # Favicon em pixel art
├── src/
│   ├── assets/
│   │   └── logo.png                # Logo em pixel art
│   ├── components/
│   │   ├── ConfirmationModal.tsx   # Confirmação antes de operações
│   │   ├── EmptyState.tsx
│   │   ├── Loading.tsx
│   │   ├── Logo.tsx
│   │   ├── Modal.tsx
│   │   ├── ReceiptModal.tsx        # Comprovante virtual (imprimível)
│   │   └── TransactionItem.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Sessão + salário semanal
│   │   └── NotificationContext.tsx # Notificações (toasts)
│   ├── hooks/
│   │   └── index.ts
│   ├── layouts/
│   │   ├── AppLayout.tsx           # Sidebar + topbar (autenticado)
│   │   └── PublicLayout.tsx        # Header + rodapé públicos
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminFees.tsx       # Criar/editar/cancelar cobranças
│   │   │   ├── AdminTransactions.tsx
│   │   │   └── AdminUsers.tsx      # Bloquear + add/remover dinheiro
│   │   ├── Admin.tsx               # Dashboard admin + gráficos
│   │   ├── AdminLogin.tsx
│   │   ├── Boletos.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Dizimo.tsx
│   │   ├── Extrato.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Perfil.tsx
│   │   ├── Pix.tsx
│   │   ├── Register.tsx
│   │   └── Taxas.tsx
│   ├── services/
│   │   ├── authService.ts          # Sessão (login/logout/restore)
│   │   └── databaseService.ts      # ★ ÚNICA camada de persistência
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── format.ts
│   │   ├── money.ts                # Centavos, datas, validações
│   │   └── receipt.ts
│   ├── App.tsx                     # Rotas (HashRouter)
│   ├── config.ts                   # Credenciais admin via .env
│   ├── index.css                   # Design system (azul #0055A6)
│   └── main.tsx
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── vite.config.ts
```

---

## 🔄 Migrando do LocalStorage para um backend real

Toda a persistência passa por **um único arquivo**: `src/services/databaseService.ts`. Nenhum componente chama `localStorage` diretamente (exceto a sessão em `authService.ts`, que também é simples de trocar).

Para migrar para um backend (ex.: Supabase, Node + Postgres, Firebase):

1. **Crie a API/banco** com tabelas equivalentes: `users`, `transactions`, `fees`, `boletos`.
2. **Reimplemente as funções** de `databaseService.ts` com chamadas HTTP/SDK mantendo as mesmas assinaturas (`getUserById`, `performOperation`, `createFee`, `adminAdjustFunds`, etc.). Como os componentes já importam apenas dessas funções, **nenhuma tela precisa mudar**.
3. **Substitua o hash de senha local** por autenticação real (bcrypt no servidor, JWT/sessões, ou Supabase Auth).
4. **Mova a credencial admin** para o servidor — nunca mais no frontend.
5. Converta `money.ts` para `DECIMAL`/`BIGINT` no banco (ou continue em centavos inteiros — recomendado).

O tipo `Database` em `src/types/index.ts` já descreve o schema sugerido.

---

## 📄 Licença / Uso

Projeto de simulação para a comunidade do Habblet. Sem valor monetário real, sem vínculo com o Pix/Banco Central ou qualquer instituição financeira.
