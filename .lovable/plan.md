

## Plano: Aquecimento Externo Auto-Save (985 contatos)

Adiciona uma camada de aquecimento que envia mensagens curtas e genéricas para os 985 contatos auto-save, complementando o ping-pong interno existente. Configuração conservadora (3 envios/dia por instância) e mensagens genéricas.

### 1. Banco de dados (migração)
Nova tabela `aquecimento_contatos_autosave`:
- `id`, `numero` (texto, único, formato `5562...`), `nome` (opcional)
- `ativo` (bool, default true)
- `ultimo_uso_em` (timestamptz), `total_usos` (int, default 0)
- `respondeu_ultima` (bool), `total_respostas` (int, default 0)
- `criado_em`, `atualizado_em`
- RLS: somente admin gerencia; service role acessa tudo
- Índice em `(ativo, ultimo_uso_em)` para round-robin eficiente

Nova tabela `aquecimento_envios_autosave` (log de envios):
- `id`, `instancia_id`, `contato_id`, `mensagem_enviada`, `enviado_em`, `respondeu` (bool), `resposta_em`
- RLS: admin only
- Usada para regra "1 contato/instância a cada 30 dias" e métricas

### 2. Banco de mensagens genéricas (sem IA)
Arquivo `supabase/functions/_shared/aquecimentoMessages.ts` com array de ~30 frases curtas: "Oi", "Bom dia", "Tudo bem?", "Boa tarde", "Olá", "E aí", "Tudo certo?", "Salve", etc. Sorteio aleatório a cada envio. **Custo zero — sem IA.**

### 3. Nova Edge Function: `aquecimento-envio-autosave`
- Disparada pela função `whatsapp-aquecimento` existente ao final de cada ciclo
- Para cada instância em status `EM_AQUECIMENTO` ou `AQUECIDO`:
  - Verifica fase para limite diário: Fase 1-2 → 3 msgs/dia, Fase 3-4 → 5 msgs/dia, Fase 5 → 7 msgs/dia (conservador)
  - Conta envios do dia em `aquecimento_envios_autosave`; se já atingiu limite, pula
  - Seleciona 1 contato `ativo` que essa instância **não usou nos últimos 30 dias** ordenado por `ultimo_uso_em ASC`
  - Envia mensagem aleatória via `send-whatsapp` (reutiliza função existente, sem custo extra)
  - Registra em `aquecimento_envios_autosave` e atualiza `ultimo_uso_em`/`total_usos`
- Intervalo aleatório 20-60 min entre envios da mesma instância (controlado pela frequência do cron)
- Bloqueio de domingo (regra existente já aplicada pelo cron pai)

### 4. Captura de respostas (sem nova função)
Ajuste pequeno em `whatsapp-chatbot/index.ts`:
- Quando receber mensagem entrante, verificar se o número remetente está em `aquecimento_contatos_autosave`
- Se sim: marcar último envio dessa instância↔contato como `respondeu=true` e incrementar `total_respostas`
- Não dispara fluxo de chatbot para esses números (apenas registra métrica)

### 5. UI: nova aba "Contatos Auto-Save" em `Aquecimento.tsx`
- Importador de planilha XLSX/CSV (lib `xlsx` já instalada): valida números, normaliza para `55DDDXXXXXXXX`, faz INSERT em batch (com `ON CONFLICT DO NOTHING`)
- Tabela com: número, nome, total_usos, total_respostas, taxa de resposta %, último uso, ativo (toggle)
- Filtros: ativos/inativos, ordenação por taxa de resposta
- Botões: importar planilha, desativar em massa, exportar relatório
- Card de resumo: total de contatos, ativos, taxa média de resposta, envios hoje

### 6. Importação inicial dos 985 contatos
Script único disparado via botão "Importar Planilha" — usuário faz upload do arquivo já enviado e o sistema processa client-side e insere no banco.

### 7. Métricas no relatório diário das 20h
Adicionar a `daily-report-aquecimento`:
- Envios auto-save por instância no dia
- Taxa de resposta global
- Alerta se taxa < 50% (pool desgastada → recomendar adicionar mais contatos)

## Custo Lovable Cloud

| Item | Custo estimado |
|---|---|
| Storage tabelas (1k linhas + log) | < $0,01/mês |
| Edge Function nova (~10 invocações/ciclo × 56 ciclos/dia) | < $0,02/dia |
| Mensagens (banco fixo, sem IA) | **$0** |
| Total adicional | **< $0,03/dia** |

**Importante:** zero IA, zero Gemini, zero Lovable AI Gateway. Tudo offline com texto pré-definido.

## Fora de escopo
- Não mexo no ping-pong interno A↔B (continua funcionando)
- Não mexo em chatbot de cobrança, lembretes, IA mentor, campanhas de voz
- Não envio áudio/mídia para auto-save (só texto curto)
- Não respondo automaticamente quando o auto-save responder (apenas registra métrica)

## Resumo do fluxo final

```text
A cada ciclo de aquecimento (15 min, 7h-21h):
  1. Ping-pong interno A↔B (existente, sem mudança)
  2. NOVO: cada instância manda 1 msg curta para 1 contato auto-save
     - Limite: 3/dia (fase 1-2), 5/dia (fase 3-4), 7/dia (fase 5)
     - Rotação: contato só reusado após 30 dias na mesma instância
     - Mensagem aleatória do banco de 30 frases genéricas
  3. Auto-save responde → webhook registra resposta → métrica sobe
```

