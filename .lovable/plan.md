## Situação atual do salvamento de contatos

Já existe a função `salvarContatoUAZAPI()` em `whatsapp-chatbot/index.ts` (linhas 170-212) que chama os endpoints UAZAPI `/contact/add` e `/contact/upsert` para salvar contatos na agenda física do dispositivo. Hoje ela é disparada apenas **quando uma mensagem é recebida** (no webhook), usando o `pushName` do remetente.

### Por que alguns números não salvam um ao outro

O sistema de aquecimento envia mensagens entre as 160 instâncias, mas:

1. **Aquecimento interno (`whatsapp-aquecimento`)**: instância A envia para B. O contato de B só é salvo na agenda de A **depois** que B responde via webhook. Se B não responder, A nunca salva B.
2. **Auto-save externo (`aquecimento-envio-autosave`)**: envia "Oi/Olá" para contatos da pool. O número de destino nunca é salvo na agenda da instância remetente porque ele não dispara webhook de entrada.
3. **Nome usado**: hoje depende do `pushName` que vem no webhook. Se o destinatário não tem nome de perfil público, o contato fica vazio.

Resultado: muitas instâncias trocam mensagens mas a agenda continua vazia, o que reduz o efeito anti-ban do aquecimento (o WhatsApp valoriza conversas entre contatos salvos mutuamente).

---

## Plano de correção

### 1. Salvar contato ANTES de enviar (pre-save bidirecional)

Criar uma função compartilhada `salvarContatoAgenda(serverUrl, token, numero, nome)` e chamá-la **antes do envio** em três pontos:

**a) Aquecimento interno entre instâncias** (`whatsapp-aquecimento/index.ts`)  
Antes de cada par A→B disparar a primeira mensagem do dia, executar em paralelo:
- Salvar B na agenda de A (com nome derivado da instância B)
- Salvar A na agenda de B (com nome derivado da instância A)

Nome usado: extraído de `user_whatsapp_instances.nome` removendo o prefixo numérico (ex: `"62982458447 CERTIFICADORA CNPJ"` → `"CERTIFICADORA CNPJ"`). Se vazio, usar `"Contato 62982458447"`.

**b) Auto-save externo** (`aquecimento-envio-autosave/index.ts`)  
Antes de enviar "Oi/Olá" para um contato da pool, salvar o `contato.nome` (já existe na tabela `aquecimento_contatos_autosave`) na agenda da instância remetente.

**c) Webhook de recebimento** (`whatsapp-chatbot/index.ts`)  
Manter o comportamento atual (já funciona) — serve como fallback caso o pre-save tenha falhado.

### 2. Cache para evitar chamadas repetidas

Criar nova tabela `whatsapp_contatos_agenda_salvos`:
```
instancia_id uuid, numero_destino text, nome_salvo text, salvo_em timestamptz
PRIMARY KEY (instancia_id, numero_destino)
```

Antes de chamar UAZAPI, consultar a tabela. Se o par (instância, número) já existe, **pular a chamada** — economiza requisições UAZAPI e reduz latência. Após sucesso, gravar na tabela.

### 3. Job de retroatividade (one-shot)

Criar edge function `aquecimento-sync-contatos-agenda` que:
- Lista todos os pares (instância A, instância B) que já trocaram mensagens no histórico de aquecimento.
- Para cada par, salva A na agenda de B e B na agenda de A (respeitando o cache).
- Executa em lotes com delay anti-ban (2-5s entre chamadas).
- Pode ser disparada manualmente pelo botão no Dashboard ou agendada para rodar 1x.

### 4. Botão no Dashboard

Adicionar em `AquecimentoDashboard.tsx` botão **"Sincronizar agenda física"** que chama a nova função, com toast de progresso.

---

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/functions/_shared/agenda-contatos.ts` (NOVO) — função utilitária reutilizável
- `supabase/functions/whatsapp-aquecimento/index.ts` — pre-save bidirecional antes da primeira mensagem do par
- `supabase/functions/aquecimento-envio-autosave/index.ts` — pre-save antes de cada envio
- `supabase/functions/whatsapp-chatbot/index.ts` — refatorar para usar o util compartilhado
- `supabase/functions/aquecimento-sync-contatos-agenda/index.ts` (NOVO) — backfill manual
- `supabase/migrations/...` — tabela `whatsapp_contatos_agenda_salvos` + RLS (deny-all, só service role escreve)
- `src/components/aquecimento/AquecimentoDashboard.tsx` — botão de sincronização

**Custo Lovable Cloud:** baixo. A tabela de cache evita chamadas repetidas (cada par instância↔número é salvo apenas 1 vez na vida). O backfill é um job único. Estimo +0,5% no consumo mensal de edge functions.

**Anti-ban:** delay aleatório 800-2000ms entre cada chamada UAZAPI de salvamento, para não parecer robotizado.

---

## Resultado esperado

- Toda nova conversa do aquecimento começa com os dois lados já salvos na agenda física.
- Contatos da pool de auto-save aparecem com nome no WhatsApp da instância.
- Histórico antigo é regularizado pelo botão de sincronização.
- O WhatsApp passa a tratar essas conversas como "entre contatos salvos", melhorando a reputação das instâncias.