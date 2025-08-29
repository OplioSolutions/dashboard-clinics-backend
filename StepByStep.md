# Plano de Implementação Backend — MVP Omnichannel + Agente Analista

> **Regra de ouro para o Agente do Cursor:** execute **uma sprint por vez**, do início ao fim, **sem pular etapas**.
> Ao concluir cada tarefa, **marque o checkbox** no arquivo.
> Não implemente múltiplos módulos de uma única vez. **Commit pequeno e testado** a cada entrega.


## Sprint 1 — Banco de Dados via MCP (Supabase)

**Objetivo:** criar todas as tabelas do MVP no Supabase (usando MCP) e habilitar segurança.

**Tarefas**

* [x] Usar MCP do Supabase para **criar o schema** conforme o design aprovado (inclui `companies`, `users`, `clients`, `appointments`, `interactions`, `services`, `payments`, `settings`, `conversation_threads`, `ai_context_snapshots`).
* [x] **Habilitar RLS em todas as tabelas**.
* [x] Criar **políticas multi-tenant** baseadas no `auth.uid()` e vínculo em `public.users`:

  * **Regra geral leitura/escrita:** permitir acesso quando existir `users` com `users.auth_user_id = auth.uid()` e `users.company_id = <tabela>.company_id`.
* [x] Criar **seeds mínimas** (1 empresa demo, 1 admin, 1 staff, 2 clientes, 1 serviço).
* [x] Exportar SQL de migração inicial para `/backend/sql/000_init.sql` (consolidado com RLS final + índices de FKs).

**Definição de pronto**

* Tabelas criadas com RLS habilitado.
* Seeds inseridos.
* Consulta simples via MCP confirma acesso isolado por `company_id`.
* Advisor do Supabase sem warnings pendentes.

---

## Sprint 2 — Autenticação & Perfis

**Objetivo:** integrar **Supabase Auth** e sincronizar com `public.users`.

**Tarefas**

* [x] Implementar rotas: `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me`.
* [x] Na primeira vez que um usuário logar, criar/atualizar registro em `public.users` com `auth_user_id`, `company_id`, `role (admin|staff)`, `status`.

  * Criar **function + trigger** no DB para manter `users` consistente quando necessário.
* [x] Cookies/sessão **httpOnly** e **secure** (em prod).
* [x] Middleware de autenticação que injeta `req.user` com `auth_user_id`, `company_id` e `role`.

**Definição de pronto**

* Login/Logout funcionando.
* `GET /auth/me` retorna perfil e `company_id`.
* Trigger/função de sync criam `public.users` automaticamente no primeiro login.
* Rotas privadas bloqueiam quando sem sessão.

---

## Sprint 3 — Middleware de Tenant & Permissões ✅

**Objetivo:** garantir escopo por empresa em **todas** as rotas privadas.

**Tarefas**

* [x] Criar middleware `requireAuth()` e `withTenantScope()` para validar `company_id` em toda rota.
* [x] Utilizar helper de consulta ao Supabase com filtro **obrigatório** por `company_id`.
* [x] Decorators/helpers para **checar role** (`isAdmin`, `isStaff`).

**Definição de pronto**

* Qualquer rota privada responde 403 se não houver `company_id` vinculado.
* Testes unitários cobrindo cenários de acesso.

---

## Sprint 4 — CRUD Básico (Clientes, Serviços, Agendamentos) ✅

**Objetivo:** expor o mínimo necessário para o frontend navegar e testar.

**Tarefas**

* [x] `POST/GET/PATCH /api/clients` (listagem por `company_id`, busca por nome/telefone).
* [x] `POST/GET/PATCH /api/services` (nome, preço, duração, ativo).
* [x] `POST/GET/PATCH /api/appointments` (cliente, serviço, usuário, data/hora, status).
* [x] Validações (zod/yup) e erros padronizados.
* [x] Testes unitários + e2e simples.

**Definição de pronto**

* Frontend consegue listar/registrar clientes, serviços e agendamentos.
* Logs de erro padronizados.

---

## Sprint 5 — Modelo Omnichannel (Threads + Interações) ✅

**Objetivo:** implementar **conversas** e **mensagens** com base nas tabelas `conversation_threads` e `interactions`.

**Tarefas**

* [x] `POST /api/conversations/start` → cria `conversation_threads` com `status=active` se não houver ativa recente para o cliente.

  * Regras de negócio: considerar "janela" (ex.: reabrir se última mensagem < 24h) — simples no MVP.
* [x] `PATCH /api/conversations/:id/close` → encerra a conversa (`status=closed`, `ended_at`).
* [x] `GET /api/conversations?client_id=…` → lista conversas do cliente.
* [x] `GET /api/conversations/:id` → retorna conversa + últimas `interactions`.
* [x] `POST /api/interactions` (uso interno) → insere mensagem normalizada (canal, direção, texto, status, timestamp, `conversation_id`).

**Definição de pronto**

* Já é possível criar/fechar conversa e registrar mensagens em uma thread.
* Testes cobrindo criação/fechamento e listagem por cliente.

---

## Sprint 6 — Webhooks de Entrada (n8n → Backend) ✅

**Objetivo:** receber mensagens **entrantes** dos canais via **n8n** e persistir no DB.

**Tarefas**

* [x] Rotas públicas (com secret):

  * `POST /webhooks/whatsapp`
  * `POST /webhooks/instagram`
* [x] Normalização do payload (mapear → `client_id` pelo identificador disponível: telefone/e-mail/handle).

  * **MVP:** se não existir cliente, criar "cliente lead" mínimo (nome desconhecido + contato).
* [x] Encaminhar para `POST /api/interactions` com `direction=inbound` e `channel` correto.
* [x] Se não houver `conversation_thread` ativa para o cliente: **abrir** automaticamente (`/api/conversations/start`).
* [x] Assinar requests com **HMAC** (shared secret) e recusar quando inválido.

**Definição de pronto**

* Receber uma mensagem via webhook insere `interactions` e mantém/abre a `conversation_thread`.
* Logs mostram fluxo completo.

---

## Sprint 6.5 — Integrações Multi-Tenant (Credenciais por Empresa) ✅

**Objetivo:** implementar sistema de credenciais isoladas por empresa, permitindo que cada clínica use suas próprias contas de WhatsApp/Instagram e secrets.

**Problema resolvido:** atualmente todas as clínicas compartilham as mesmas credenciais (hardcoded via env vars), impedindo verdadeiro multi-tenancy e orquestração pelo Painel-ADM.

**Tarefas**

**Fase 1: Database & Schema** ✅
* [x] Criar migração `004_integrations_table.sql` com tabela `integrations`
* [x] Adicionar enum `integration_status` (`active`, `inactive`)
* [x] Criar policies RLS para isolamento por `company_id`
* [x] Seeds básicos para empresa demo

**Fase 2: Security Layer** ✅
* [x] Implementar service de criptografia (`integration-security.service.ts`)
* [x] Helper para buscar/validar credenciais (`integration-helper.ts`)
* [x] Sistema de chaves derivadas por `company_id`

**Fase 3: Webhook Refactoring** ✅
* [x] Atualizar `webhook.controller.ts` para usar credenciais por empresa
* [x] Modificar `webhook-auth.ts` para validação dinâmica
* [x] Testes para fluxos com credenciais isoladas

**Fase 4: API para Painel-ADM** ✅
* [x] CRUD de integrações (`integration.controller.ts` e rotas)
* [x] Endpoints para gerenciar credenciais por empresa
* [x] Validações e permissões (`admin` only)

**Definição de pronto**

* Cada empresa pode ter suas próprias credenciais de API e webhook secrets
* Webhooks validam usando credenciais específicas da empresa (não globais)
* API permite que Painel-ADM gerencie integrações por clínica
* Backward compatibility mantida (env vars como fallback durante transição)
* Credenciais armazenadas de forma criptografada

---

## Sprint 7 — Envio de Mensagens (Backend → n8n → Canais) ✅

**Objetivo:** permitir **responder** pelo dashboard e pelo Agente IA.

**Tarefas**

* [x] `POST /api/chat/send` com `{ conversation_id, channel, message }`.
* [x] Backend chama **n8n webhook de saída** (HTTP) com payload padrão (inclui `company_id`, `channel`, `client contact`, `message`).
* [x] Ao receber **confirmação do n8n** (callback opcional), atualizar `interactions` com `status` (`sent/delivered/failed`).
* [x] Garantir que mensagens outbound também são registradas em `interactions` (`direction=outbound`).

**Definição de pronto**

* Envio via API cria `interaction` outbound e dispara n8n.
* Respostas de status são refletidas.

---

## Sprint 8 — Geração de Snapshots de Contexto (Agente Analista)

**Objetivo:** criar/atualizar `ai_context_snapshots` para cada cliente de forma barata e rápida.

**Tarefas**

* [ ] `POST /api/snapshots/generate` com `{ client_id, source_conversation_id? }`

  * Regras: coletar **últimas N interações** (ex.: 50) da conversa (ou do cliente), + dados relevantes do cliente.
  * Chamar OpenAI para **sumarização + flags** (risco de falta, preferências, objeções, sentimento).
  * Persistir em `ai_context_snapshots` com `last_updated` e `important_flags`.
* [ ] **Gatilhos de atualização**:

  * ao **fechar** uma conversa;
  * **manual** via endpoint;
  * **cron** diário (job em `/backend/jobs/cron.ts`) para clientes com threads ativas recentes.
* [ ] Rate-limit/budget control (ex.: não gerar mais que 1 snapshot/cliente por 12h).

**Definição de pronto**

* Conseguimos gerar snapshot por cliente e reutilizar depois nas respostas.
* Registro de quando/por que o snapshot foi gerado.

---

## Sprint 9 — Endpoints para o Front (Home + Clientes + Atendimento)

**Objetivo:** fornecer dados que o frontend atual espera **nesta versão reduzida**.

**Tarefas**

* [ ] **Home (Dashboard básico):**

  * `GET /api/summary/home` → retorna:

    * `appointments_today_count`,
    * `open_conversations_count`,
    * `unread_inbound_count`,
    * `quick_actions` (placeholders).
* [ ] **Clientes:**

  * `GET /api/clients/:id/profile` → retorna dados do cliente + última `ai_context_snapshot` + últimas 10 interações + conversas recentes.
* [ ] **Atendimento (Inbox Omnichannel):**

  * `GET /api/inbox/summary` → lista conversas ativas com último trecho da mensagem, canal mais recente, unread flag.
  * `GET /api/conversations/:id` → (já feito) retorna a thread + mensagens paginadas.

**Definição de pronto**

* Front consegue popular cards da Home, lista de conversas e detalhe do cliente (com snapshot).
* Performance aceitável (paginado quando necessário).

---

## Sprint 10 — Configurações Básicas

**Objetivo:** permitir ajustes mínimos por clínica.

**Tarefas**

* [ ] `GET /api/settings` e `PATCH /api/settings` (working\_hours, contact\_email/phone, logo\_url).
* [ ] Validar permissões: somente `admin` pode editar.

**Definição de pronto**

* Atualização de settings persiste e reflete no frontend.

---

## Sprint 11 — Observabilidade, Segurança e Qualidade

**Objetivo:** garantir que o backend esteja **estável** e **auditável**.

**Tarefas**

* [ ] Logs estruturados (padrão) e correlação por `company_id` e `conversation_id`.
* [ ] Rate limiting básico nas rotas públicas (webhooks).
* [ ] Validações de entrada (zod/yup) em todas as rotas.
* [ ] Testes:

  * unitários (módulos),
  * integração (rotas principais),
  * e2e simples (fluxo de uma conversa do webhook até o snapshot).
* [ ] Checklist de segurança (cookies, CORS, secrets, HMAC, RLS revisado).

**Definição de pronto**

* Testes passam no CI.
* Logs úteis e nenhum segredo exposto.

---

## Sprint 12 — Deploy & Handover

**Objetivo:** colocar em produção e documentar.

**Tarefas**

* [ ] Deploy backend (Vercel/Railway) com envs seguras.
* [ ] Conectar n8n → webhooks de produção.
* [ ] Documentar rotas no `/backend/README_backend.md` (exemplos de requests/responses).
* [ ] Plano de rollback e backup (dump periódico do Postgres).
* [ ] Marcar release `v0.1.0-mvp-omni`.

**Definição de pronto**

* Backend no ar, webhooks recebendo, front consumindo `/api/summary/home`, `/api/inbox/summary`, `/api/clients/:id/profile`.
* Processo de incidentes descrito.

---

### Observações Importantes

* **Não alterar o schema** durante as sprints sem uma **migração explícita** (nova SQL numerada em `/backend/sql`).
* Qualquer campo extra de provedores (IDs do WhatsApp/IG/Email) que ainda **não exista** no `interactions` pode ser tratado temporariamente em memória ou via `metadata` (se houver). Se **for imprescindível**, criar **Sprint de Migração** **depois** do MVP.
* Toda rota que toca dados sensíveis deve **sempre** filtrar por `company_id` via middleware + política RLS.

