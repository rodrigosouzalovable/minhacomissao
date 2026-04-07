

# Análise Minuciosa: Riscos de Restrição/Banimento do WhatsApp

## Problemas encontrados no sistema de Aquecimento

### 🔴 CRÍTICO 1 — Salvamento de contatos NÃO respeita 1 instância/ciclo
**Arquivo:** `whatsapp-aquecimento/index.ts` (linhas 684-758)

O bloco de mensagens foi corrigido para processar apenas 1 instância por ciclo, mas o bloco de **salvamento de contatos** (linha 687) ainda itera `for (const inst of instancias)` — **TODAS** as instâncias. Isso significa que todas as instâncias salvam contatos ao mesmo tempo, gerando atividade simultânea suspeita.

### 🔴 CRÍTICO 2 — Fase 2 permite 10 msgs/dia — muito agressivo
**Arquivo:** `whatsapp-aquecimento/index.ts` (linha 11)

Fase 2 (7-14 dias) permite **10 mensagens/dia**. Um número com apenas 1 semana de vida enviando 10 msgs/dia é antinatural. A progressão segura deveria ser mais gradual: 1 → 3 → 5 → 10 → 20.

### 🟡 ALTO 3 — Status com imagens do Unsplash = fingerprint
**Arquivo:** `whatsapp-aquecimento/index.ts` (linhas 50-66)

Todas as instâncias usam o **mesmo pool de 15 imagens do Unsplash**. Se o WhatsApp detectar que múltiplos números postam as mesmas URLs de imagem, isso é uma assinatura clara de automação. As imagens deveriam ser únicas ou variadas.

### 🟡 ALTO 4 — Textos de status genéricos e repetitivos
**Arquivo:** `whatsapp-aquecimento/index.ts` (linhas 26-48)

Apenas **15 frases de status** para Fase 1 e **15 para Fase 3**. Com verificação de 7 dias para evitar repetição (linha 562), os textos se esgotam rapidamente, forçando repetição. Textos genéricos como "Bom dia! 🌞" usados em múltiplos números são suspeitos.

### 🟡 ALTO 5 — Mensagens do aquecimento são só entre instâncias próprias
**Arquivo:** `whatsapp-aquecimento/index.ts` (linha 394)

O sistema só envia mensagens entre as próprias instâncias do admin (`instanciasAquecimento`). Isso cria um **grupo fechado** de números que só conversam entre si — padrão facilmente detectável. Números reais conversam com contatos externos variados.

### 🟡 ALTO 6 — Sem variação no tipo de conteúdo por dia
O sistema não varia o padrão diário. Todo dia é: mensagem de texto → status → salvar contato. Humanos reais variam: alguns dias só olham, outros só mandam áudio, outros postam status. Deveria haver dias "silenciosos" aleatórios.

### 🟡 MÉDIO 7 — Health check pode causar timeout
**Arquivo:** `whatsapp-aquecimento/index.ts` (linhas 298-321)

O health check (`GET /instance/status`) não tem timeout. Se a API da UAZAPI estiver lenta, a edge function pode travar. Deveria ter um timeout de 5-10 segundos.

### 🟡 MÉDIO 8 — Acionamento agendado sem limite diário por instância
**Arquivo:** `process-acionamento-agendado/index.ts`

O envio agendado não tem limite diário por instância. Um agendamento com 500 clientes usando 2 instâncias = 250 msgs por número/dia, extremamente alto. Deveria ter um cap de ~50 msgs/dia por instância.

### 🟡 MÉDIO 9 — Nenhum "read receipt" ou "typing" simulado
Quando um humano conversa, ele primeiro **abre o chat**, depois aparece **"digitando..."**, e só depois envia. O sistema envia diretamente sem simular presença, o que é detectável.

---

## Plano de correções prioritárias

### Mudança 1 — Limitar salvamento de contatos a 1 instância/ciclo
Aplicar a mesma lógica de seleção aleatória usada para mensagens e status.

### Mudança 2 — Reduzir progressão de fases
```
Fase 1 (0-7 dias):   1 msg/dia  → manter
Fase 2 (7-14 dias):  10 → 3 msgs/dia
Fase 3 (14-21 dias): 20 → 7 msgs/dia
Fase 4 (21-28 dias): 30 → 15 msgs/dia
Fase 5 (28+ dias):   50 → 25 msgs/dia
```

### Mudança 3 — Adicionar "dias silenciosos" aleatórios
Cada instância tem 20% de chance de ficar em silêncio total num dia (sem mensagens, sem status). Isso simula comportamento humano real.

### Mudança 4 — Adicionar timeout ao health check
Limitar o fetch do health check a 8 segundos com `AbortController`.

### Mudança 5 — Expandir pool de textos de status
Adicionar pelo menos mais 20-30 frases variadas para reduzir repetição.

### Mudança 6 — Limitar envio diário no acionamento agendado
Adicionar cap de 80 msgs/dia por instância no `process-acionamento-agendado`.

---

## Resumo

| Nível | Problema | Correção |
|-------|----------|----------|
| 🔴 Crítico | Contatos salvos em TODAS instâncias | Limitar a 1/ciclo |
| 🔴 Crítico | Fase 2 = 10 msgs (muito alto) | Reduzir para 3 |
| 🟡 Alto | Imagens Unsplash = fingerprint | Expandir/diversificar pool |
| 🟡 Alto | Pool de textos pequeno (15+15) | Expandir para 40+ |
| 🟡 Alto | Conversas só entre próprios números | Limitação de design |
| 🟡 Alto | Sem dias silenciosos | Adicionar 20% chance skip |
| 🟡 Médio | Health check sem timeout | Adicionar AbortController |
| 🟡 Médio | Acionamento sem limite diário | Cap 80 msgs/instância/dia |
| 🟡 Médio | Sem simulação de typing | Limitação da API |

**Arquivos a editar:**
- `supabase/functions/whatsapp-aquecimento/index.ts` (mudanças 1-5)
- `supabase/functions/process-acionamento-agendado/index.ts` (mudança 6)

