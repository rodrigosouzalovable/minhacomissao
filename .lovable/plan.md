## Objetivo

Parar TODAS as automações de aquecimento de WhatsApp para evitar mais banimentos. Nenhum chip será mais usado automaticamente pelo sistema para status, conversas em grupo, reações, completar perfil ou adicionar membros a grupos.

## O que será desativado

### 1. Cron jobs (param de rodar imediatamente)

Os 5 cron jobs de aquecimento serão **desagendados** (`cron.unschedule`):

| Job | Frequência atual | O que fazia |
|---|---|---|
| `aquecimento-status-30min` | a cada 30min, 12-21h | Postava status automáticos |
| `add-to-warming-group-30min` | a cada 30min | Adicionava números em grupos de aquecimento |
| `aquecimento-grupo-conversa-15min` | a cada 15min | Disparava conversas automáticas em grupos |
| `aquecimento-status-reagir-5min` | a cada 5min | Visualizava/reagia em status de outros chips |
| `aquecimento-perfil-completar-diario` | diário 11:30 BRT | Aplicava foto/nome/sobre nos chips |

### 2. Flags de configuração

Também serão setadas como `false` na tabela `whatsapp_aquecimento_config` (cinto e suspensório — caso alguém invoque manualmente as edge functions, elas respeitam essas flags e abortam):

- `postar_status_auto`
- `engajamento_status_auto`
- E quaisquer outras chaves de automação de aquecimento existentes

### 3. Pausar instâncias em aquecimento

`UPDATE whatsapp_aquecimento_instancias SET status = 'PAUSADO'` em todas as linhas com status `EM_AQUECIMENTO` ou `AQUECIDO`, para que mesmo execuções manuais residuais não disparem nada.

## O que NÃO será mexido

- **Código das edge functions** permanece no repositório (não deleta), apenas para de ser chamado. Se um dia você quiser reativar, basta recriar os crons. Posso deletar depois se preferir.
- **Envio manual de lembretes de acordos / mensagens em massa / inbox** — continua funcionando normalmente. Isso NÃO é aquecimento.
- **Relatórios diários (19h/20h BRT), notificações admin, chatbot, robôs de acionamento** — continuam.
- **Tabelas de aquecimento, calendário, diálogos, imagens de status, grupos cadastrados** — preservadas (dados intactos, só não rodam).

## Como será executado

Via `supabase--insert` (operação de dados, não migração):

```sql
SELECT cron.unschedule('aquecimento-status-30min');
SELECT cron.unschedule('add-to-warming-group-30min');
SELECT cron.unschedule('aquecimento-grupo-conversa-15min');
SELECT cron.unschedule('aquecimento-status-reagir-5min');
SELECT cron.unschedule('aquecimento-perfil-completar-diario');

UPDATE whatsapp_aquecimento_config
SET valor = 'false'
WHERE chave IN ('postar_status_auto','engajamento_status_auto', ...);

UPDATE whatsapp_aquecimento_instancias
SET status = 'PAUSADO', updated_at = now()
WHERE status IN ('EM_AQUECIMENTO','AQUECIDO','AGUARDANDO_MATURACAO');
```

## Resultado

A partir da aprovação: zero ações automáticas vindas dos chips. Você passa a controlar 100% manualmente o que cada número envia.

## Pergunta opcional

Quer que eu também **remova os botões/abas de aquecimento** do menu da página `/aquecimento` (esconder a UI), ou deixar a UI visível só pra você consultar histórico? Por padrão vou **manter a UI visível** (somente leitura na prática, já que nada roda).
