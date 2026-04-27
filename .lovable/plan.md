# Prioridade 1: Reativar e escalar Auto-Save com Números Âncora

## Diagnóstico atual

- **Cron ativo**: `aquecimento-autosave-horario` roda de hora em hora 07-20h BRT — OK.
- **Pool externa**: 985 contatos, todos ativos — OK.
- **Envios reais nos últimos 10 dias: apenas 2.** O sistema está praticamente parado.
- **Bloqueio de grupos no webhook `whatsapp-chatbot`: JÁ ESTÁ IMPLEMENTADO** (função `isBlockedRemoteJid` + `isBlockedParsedPayload` filtram `@g.us`, `status@broadcast`, `isGroup`, etc.). Não precisa mexer.

### Por que está parado mesmo com cron rodando

1. `Math.random() > 0.7` na função descarta **30% das execuções por instância em cada rodada** — combinado com limite diário baixo (3 msg/dia para fase 1-2) e pausa 12-14h, sobram pouquíssimas janelas efetivas.
2. A pool de 985 contatos é "fria" (números aleatórios externos) — sem reciprocidade, e WhatsApp pode marcar como spam.
3. Não há priorização: chip de aquecimento não conversa com nenhum número confiável que vá responder de verdade.

## O que vai ser feito

### 1. Edge function `aquecimento-envio-autosave/index.ts`

**a) Adicionar lista de 7 âncoras prioritárias (no topo do arquivo):**
```ts
const ANCORAS_PRIORITARIAS = [
  "5562991672674","5562981810202","5562981079590",
  "5562981865213","5562982183144","5562982458447","5562981079569",
];
```

**b) Selecionar destino com 70/30:**
- 70% das vezes: escolhe uma âncora — a que **menos recebeu mensagens daquele chip nos últimos 7 dias** (rodízio justo, evita repetir).
- 30% das vezes: pega 1 contato da pool atual `aquecimento_contatos_autosave` (lógica atual de últimos-30-dias preservada).
- Âncoras são tratadas como contatos virtuais com `id` sintético (`ancora:<numero>`) e registradas em `aquecimento_envios_autosave.contato_id = null` + nova coluna `numero_destino TEXT` para histórico/rodízio. Migração SQL inclusa.

**c) Expandir mensagens de 30 → 50+ frases variadas (manter as 30 atuais e adicionar 20+ com tom natural e alguns emojis discretos):**
```
"Hey, tudo joia? 👋", "Coe, firmeza?", "Bão?", "Fala chefe",
"E aí, tranquilo?", "Suave?", "Oi, quanto tempo!", "Lembrou de mim?",
"Passando pra dar um oi 👋", "Só passando pra dizer oi", "Tudo na paz?",
"Firme e forte?", "E aí, novidades?", "Como andam as coisas?",
"Tudo em cima? 👍", "Salve, camarada", "Opa, belezinha?",
"Fala parceiro", "Oi, espero que esteja bem 🙂", "Só um oi rápido"
```

**d) Remover o gargalo `Math.random() > 0.7`** (skip aleatório de 30%) — a aleatoriedade já vem do cron horário, do limite por fase e do fator fim de semana. Manter limites por fase (3/5/7) e a pausa 12-14h.

**e) Distribuição ao longo do dia já está garantida pelo cron horário** (07-20h BRT, exceto 12-14h = ~10 janelas/dia). Para fase 1 (limite 3/dia) o chip fica naturalmente espalhado.

### 2. Migração SQL

Adicionar coluna `numero_destino TEXT` em `aquecimento_envios_autosave` (nullable) e tornar `contato_id` nullable, para registrar envios para âncoras sem precisar criá-las na pool. Index em `(instancia_id, numero_destino, enviado_em)` para o rodízio.

### 3. Webhook `whatsapp-chatbot` — bloqueio de grupos

**Nada a fazer.** Já existe e está completo (linhas 13-49 e 920-924 do arquivo). Apenas confirmado.

### 4. Página `Aquecimento` (UI) — opcional, leve

Na aba **Auto-Save**, adicionar um pequeno bloco "Números âncora" listando as 7 âncoras com badge de quantos envios receberam hoje (read-only). Sem inputs — lista fixa no código por enquanto.

## Custo Lovable Cloud

- Sem mudança de frequência de cron (continua 1x/hora).
- Volume vai subir de ~2 envios/10 dias para ~20-30 envios/dia (147 instâncias × ~3 fase 1) — dentro do esperado para aquecimento e **muito abaixo de qualquer limite de Edge Functions**. Sem impacto financeiro relevante.

## Verificação pós-deploy

1. Disparar `aquecimento-envio-autosave` manualmente pelo botão "Disparar ciclo agora" e checar nos logs: deve haver `status: "enviado"` para vários números, com ~70% sendo âncoras.
2. Confirmar nos seus 7 celulares: mensagens chegando dos chips em aquecimento.
3. SQL para auditar 24h depois:
   ```sql
   SELECT numero_destino, COUNT(*) FROM aquecimento_envios_autosave
   WHERE enviado_em > now() - interval '1 day'
   GROUP BY 1 ORDER BY 2 DESC;
   ```

## Arquivos alterados

- `supabase/functions/aquecimento-envio-autosave/index.ts` (lógica principal)
- Nova migration: coluna `numero_destino` + índice
- `src/components/aquecimento/AquecimentoAutoSaveTab.tsx` (bloco de âncoras — opcional)

Sem alterações em `whatsapp-chatbot` (bloqueio de grupos já existe e está robusto).
