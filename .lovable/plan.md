## Objetivo

A partir de **amanhã**, mudar temporariamente a estratégia de aquecimento:
- **Suspender** as conversas entre números próprios (peer-to-peer).
- **Todas as instâncias em aquecimento com 2+ dias de cadastro** enviam mensagens para a pool de contatos auto-save (985 números).
- **Instâncias com menos de 2 dias** ficam de fora (continuam aguardando maturação, sem nenhuma atividade externa).
- **Validar previamente** quais contatos auto-save têm WhatsApp e descartar os que não têm.

## Estratégia

### 1. Validação prévia da pool auto-save

Nova edge function `aquecimento-validar-pool-autosave`:
- Pega contatos `ativo=true` ainda não validados (campo novo `validado_em`).
- Usa 1 instância conectada saudável como "verificador".
- Chama `check-whatsapp-numbers` (já existe) em lotes de 10.
- Marca `tem_whatsapp = true/false` e `validado_em = now()`.
- Quem retorna `false` é desativado automaticamente (`ativo = false`).

Cron diário 06:30 BRT (09:30 UTC), processando até ~500 números/execução. Primeira rodada pode ser disparada manualmente pelo botão "Validar pool agora".

### 2. Modo de aquecimento (chave de configuração)

Nova chave `modo_aquecimento` em `whatsapp_aquecimento_config`:
- `peer-to-peer` — atual (instâncias conversam entre si)
- `autosave` — novo (instâncias só enviam para pool externa)
- `hibrido` — faz ambos

Default a partir de amanhã: **`autosave`**.

A função `whatsapp-aquecimento` lê a chave:
- `autosave` → pula o pareamento peer-to-peer.
- `peer-to-peer` → comportamento atual.
- `hibrido` → executa os dois.

### 3. Regra de idade mínima de 2 dias para envio autosave

Em `aquecimento-envio-autosave/index.ts`, ao listar instâncias elegíveis, **filtrar fora** instâncias cujo `user_whatsapp_instances.criado_em` tem menos de 2 dias:

```ts
const IDADE_MIN_AUTOSAVE_DIAS = 2;
const idadeDias = (Date.now() - new Date(inst.criado_em).getTime()) / 86400000;
if (idadeDias < IDADE_MIN_AUTOSAVE_DIAS) continue; // pula instância nova
```

Resumo das regras combinadas de idade:
- **0–2 dias**: nada (fica em `AGUARDANDO_MATURACAO`, sem envios).
- **2–5 dias**: envia para pool auto-save (modo novo), mas continua sem peer-to-peer.
- **5+ dias**: envia auto-save + (quando voltar) peer-to-peer normal.

### 4. Reforço: garantir que TODAS as instâncias elegíveis enviem todo dia

Ajustes em `aquecimento-envio-autosave`:
- Remover o "skip aleatório de 30%" → tentar 100% por ciclo.
- Manter limites diários por fase (3/5/7) e jitter (anti-ban).
- Filtrar contatos: só usa quem tem `tem_whatsapp = true` (ou ainda não validado).

Cron `*/30 10-23,0 * * *` UTC (a cada 30 min entre 07-21h BRT, com pausa de almoço 12-14h já no código).

### 5. UI

**`AquecimentoAutoSaveTab.tsx`:**
- Cards: "Pool validada" (X com WhatsApp / Y sem / Z não validados).
- Botão "Validar pool agora".
- Coluna "WhatsApp?" na tabela (✓ / ✗ / -).

**`AquecimentoConfigTab.tsx`:**
- Selector "Modo de aquecimento": peer-to-peer / autosave / híbrido.

**`AquecimentoDashboard.tsx`:**
- Já mostra "Aguardando maturação" (5d) — adicionar nota visual de que instâncias com <2d também não enviam para auto-save.

## Arquivos afetados

**Migração SQL:**
- `aquecimento_contatos_autosave`: colunas `tem_whatsapp boolean`, `validado_em timestamptz`.
- Inserir registro `modo_aquecimento` = `autosave` em `whatsapp_aquecimento_config`.

**Edge functions:**
- **NOVA** `aquecimento-validar-pool-autosave/index.ts`.
- `whatsapp-aquecimento/index.ts` — respeitar `modo_aquecimento`.
- `aquecimento-envio-autosave/index.ts` — filtro de idade ≥ 2 dias, remover skip 30%, filtro `tem_whatsapp`.

**Cron jobs (insert tool):**
- Novo: `aquecimento-validar-pool` diário 06:30 BRT.
- Ajuste: `aquecimento-envio-autosave` a cada 30 min na janela 07-21h BRT.

**UI:**
- `src/components/aquecimento/AquecimentoAutoSaveTab.tsx`
- `src/components/aquecimento/AquecimentoConfigTab.tsx`
- `src/components/aquecimento/AquecimentoDashboard.tsx`

## Comportamento esperado a partir de amanhã

- 06:30 BRT: validação automática da pool (1ª rodada manual valida os 985 em ~2-3 min).
- 07:00–21:00 BRT, a cada 30 min: cada instância **com 2+ dias de cadastro** tenta enviar 1 mensagem para um contato válido da pool, respeitando o limite da fase.
- Instâncias com <2 dias: **zero atividade**.
- Conversas peer-to-peer suspensas; histórico preservado.
- Reversão: trocar o seletor de modo na UI (sem deploy).

## Custo Lovable Cloud

- Validação: ~100 chamadas HTTP/dia ao UAZAPI (lotes de 10) — desprezível.
- Envio autosave: igual ao atual, sem aumento.
- Sem uso de IA (mensagens curtas fixas, custo zero por envio).
