

## Plano: Módulo AUTOMAÇÃO COBMAIS

### Arquitetura

```text
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Frontend React     │────▶│ Edge Function         │────▶│ Servidor Playwright  │
│  /admin/automacao    │     │ automacao-cobmais     │     │ (ngrok / local)      │
│  - Status robô      │◀────│ - Proxy de comandos   │◀────│ - Chromium           │
│  - Console          │     │ - Gestão de fila      │     │ - API REST           │
│  - Logs             │     └──────────────────────┘     └─────────────────────┘
│  - Fila             │              │
└─────────────────────┘              │
                              ┌──────▼──────┐
                              │  Database   │
                              │ 3 tabelas   │
                              └─────────────┘
```

### 1. Banco de Dados - 3 tabelas novas

**`automacao_config`** - Configuração do robô (URL do servidor, credenciais CobMais, status)
- `id`, `user_id`, `server_url` (ex: `https://meurobo.ngrok.app`), `cobmais_email`, `cobmais_senha`, `status` (online/offline), `criado_em`, `atualizado_em`

**`automacao_comandos`** - Fila de comandos
- `id`, `user_id`, `acao` (buscar_cliente, criar_cobranca, etc.), `parametros` (jsonb), `status` (pendente/executando/concluido/erro), `resultado` (jsonb), `erro` (text), `tempo_execucao_ms` (integer), `criado_em`, `executado_em`

**`automacao_logs`** - Logs de execução
- `id`, `comando_id` (nullable), `user_id`, `tipo` (info/erro/sucesso), `mensagem`, `detalhes` (jsonb), `criado_em`

RLS: Apenas admins podem gerenciar. Deny anonymous.

### 2. Edge Function - `automacao-cobmais`

Endpoints via body `{ action: "..." }`:
- `status` - Faz GET no servidor Playwright para verificar se está online
- `start` / `stop` - Envia comando ao servidor para iniciar/parar
- `execute` - Recebe comando (acao + parametros), registra em `automacao_comandos`, faz POST no servidor Playwright, atualiza resultado/erro/tempo
- `config` - Salva/retorna configuração (URL do servidor, credenciais CobMais)

### 3. Frontend - Nova página `/admin/automacao-cobmais`

**Layout com 4 seções:**
1. **Configuração** - Campo para URL do servidor (ex: `https://meurobo.ngrok.app`), credenciais CobMais (email/senha), botão salvar
2. **Status do Robô** - Card com indicador online/offline (polling a cada 10s), botões Iniciar/Parar
3. **Console de Comandos** - Select com ações disponíveis (buscar_cliente, criar_cobranca, registrar_acordo, extrair_info), campos de parâmetros (CPF, valor), botão executar, área de resultado
4. **Fila & Logs** - Tabs com tabela de comandos (status, ação, resultado, tempo) e tabela de logs (tipo, mensagem, data)

### 4. Navegação

- Adicionar item no `AppLayout.tsx`: `{ href: '/admin/automacao-cobmais', label: 'Robô CobMais', icon: Bot, adminOnly: true }`
- Adicionar rota em `App.tsx` com `AdminRoute`

### 5. Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/AutomacaoCobMais.tsx` | Criar - página completa do painel |
| `supabase/functions/automacao-cobmais/index.ts` | Criar - edge function proxy |
| `src/components/layout/AppLayout.tsx` | Adicionar nav item |
| `src/App.tsx` | Adicionar rota |
| Migration SQL | 3 tabelas + RLS policies |

