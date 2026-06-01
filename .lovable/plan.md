# Validador de E-mails em Massa

## Objetivo

Ferramenta interna onde o admin importa uma planilha com e-mails e o sistema separa **válidos** de **inválidos** sem custo de API externa.

## Como a validação grátis funciona

Cada e-mail passa por 4 checagens em sequência:

1. **Sintaxe (regex RFC)** — formato correto, sem espaços, sem caracteres proibidos.
2. **Domínio descartável** — lista negra (mailinator, tempmail, 10minutemail, yopmail, guerrillamail e ~50 outros).
3. **Typo de domínio popular** — `gmial.com`, `hotmial.com`, `outloook.com`, `yaho.com.br` → marca inválido + sugere o correto.
4. **DNS MX lookup** — consulta se o domínio tem servidor de e-mail (via DNS-over-HTTPS público do Google e Cloudflare como fallback). Se não tem MX, e-mail é inválido.

Classificação final:

- ✅ **Válido** — passou em tudo.
- ❌ **Inválido** — falhou em sintaxe / domínio descartável / sem MX / typo.
- ⚠️ **Duvidoso** (opcional) — sintaxe OK e MX existe, mas é role-based (`contato@`, `vendas@`, `noreply@`) — vai para aba separada.

Cobertura esperada: ~75-80% dos e-mails ruins detectados, **sem gastar 1 centavo**.

## Escopo

### 1. Página nova `/validar-emails`

- Item no menu lateral, **visível só para admin** (usa `useUserRole`).
- Layout em 2 etapas:
  - **Etapa 1 — Importar**: tabs com 3 entradas
    - Upload `.xlsx` (usa o `xlsx` que já está no projeto via `src/lib/exportExcel.ts`)
    - Upload `.csv`
    - Colar lista de texto (um e-mail por linha)
  - Se for planilha: dropdown pra escolher qual **coluna** contém o e-mail. Todas as demais colunas são preservadas no export.
  - Mostra preview das 5 primeiras linhas e o total detectado.
  - Botão **"Iniciar varredura"**.
  - **Etapa 2 — Resultado**: barra de progresso → 4 cards (Total / Válidos / Inválidos / Duvidosos) → 3 tabs com tabela paginada → botões de download.

### 2. Edge function `validate-emails-batch`

- Recebe `{ emails: string[] }` (lote de até 500).
- Faz, em paralelo (com `Promise.all` limitado a 20 concorrentes):
  - Regex de sintaxe.
  - Match em lista de domínios descartáveis (hardcoded).
  - Match em mapa de typos comuns (hardcoded com sugestão).
  - Para cada domínio único do lote, **1 lookup MX** via `https://dns.google/resolve?name={dominio}&type=MX` (cache em memória por execução).
- Devolve `{ results: [{ email, status, motivo, sugestao }] }`.
- `verify_jwt = true`: valida que o caller é admin via `user_roles`. Bloqueia qualquer outro.
- **Sem persistência no banco**. Processamento volátil.

### 3. Frontend — chamada em lotes

- Quebra a lista em lotes de 500 e dispara sequencialmente (evita timeout da edge function).
- Atualiza barra de progresso a cada lote concluído.
- Acumula resultados em memória do navegador.

### 4. Export

- Botão "Baixar válidos" e "Baixar inválidos" (com motivo na coluna `_motivo` e sugestão em `_sugestao_typo` quando aplicável).
- Preserva **todas as colunas originais** da planilha importada.
- Usa o helper `exportarParaExcel` existente.

## Detalhes técnicos

- **Sem migração de banco** — nada é gravado. Custo de Lovable Cloud praticamente zero (só execução da edge function).
- Lista de domínios descartáveis hardcoded em `disposable-domains.ts` (~80 domínios).
- Lista de typos hardcoded em `typo-suggestions.ts` (~30 mapeamentos).
- DNS-over-HTTPS via fetch direto (sem dependência externa).
- Timeout de 3s por lookup MX, com Cloudflare DNS (`https://cloudflare-dns.com/dns-query`) como fallback.
- Limite de 100.000 e-mails por sessão (proteção contra travamento de navegador).

## Fora de escopo

- Não usa API paga (ZeroBounce, NeverBounce, Hunter).
- Não faz SMTP handshake (gera muitos falsos positivos).
- Não salva e-mails no banco nem casa com devedores.
- Não tem agendamento — é manual sob demanda.
- Não envia e-mails de teste (validação puramente passiva).

## Arquivos

- `supabase/functions/validate-emails-batch/index.ts` (novo)
- `src/pages/ValidarEmails.tsx` (novo)
- `src/components/validar-emails/ImportTab.tsx`, `ResultsTab.tsx` (novos)
- `src/App.tsx` — rota `/validar-emails`
- `src/components/layout/AppLayout.tsx` — item de menu (gated por admin)
