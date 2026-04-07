

## Plano: Aquecimento 100% Automático

### Análise de Viabilidade

**Viável com adaptações.** A infraestrutura já existe (tabelas, Edge Function, cron). A transformação é principalmente de lógica e UI.

**O que já existe:**
- Tabelas: `whatsapp_aquecimento_instancias`, `whatsapp_aquecimento_interacoes`, `whatsapp_aquecimento_dialogos`, `whatsapp_aquecimento_config`
- Edge Function `whatsapp-aquecimento` com lógica de envio, fases, e auto-pause
- 23 instâncias (todas PAUSADO), 24 diálogos ativos
- `user_whatsapp_instances` com `criado_em` (permite calcular idade do número)

**O que NÃO vamos fazer (e por quê):**
- ❌ 6 fases (0-5) — manter 4 fases como hoje, mas com limites ajustados (3→8→15→25→40 msgs/dia). 6 fases é granularidade excessiva para 7 dias cada.
- ❌ Pool interno de diálogos hardcoded na Edge Function — ruim para manutenção. Vamos **seed** a tabela `whatsapp_aquecimento_dialogos` com ~50 diálogos variados, o que é mais flexível.
- ❌ Envio de fotos/stickers automáticos sem URLs reais — precisaria de um bucket com mídia. Vamos manter texto + áudio PTT (já funciona via UAZAPI).
- ❌ Participar de grupos — fora do escopo da UAZAPI atual.
- ❌ Remover botão Pausar — manter como "override manual" de emergência.

### O que será implementado

**1. Auto-enrollment de novos números**
- A Edge Function verifica `user_whatsapp_instances` com `ativo = true` que **não existem** em `whatsapp_aquecimento_instancias`, e cria o registro automaticamente com status `EM_AQUECIMENTO` e fase calculada pela idade.

**2. Cálculo automático de fase por idade**
- `dias_conectado = CURRENT_DATE - DATE(criado_em)` da instância
- Fase 1: dias 0-6 (3 msgs/dia, só texto)
- Fase 2: dias 7-13 (10 msgs/dia, texto + áudio)
- Fase 3: dias 14-20 (20 msgs/dia, todos os tipos)
- Fase 4: dias 21-27 (30 msgs/dia)
- Fase 5 (AQUECIDO): dia 28+ (até 50 msgs/dia)

**3. Tabela de notificações**
- Criar tabela `aquecimento_notificacoes` para registrar eventos: novo número, mudança de fase, aquecido, risco de bloqueio.
- Exibir no dashboard com ícone de sininho.

**4. Seed de diálogos**
- Inserir ~40 diálogos variados na tabela existente, categorizados por fase e tipo (texto, áudio).

**5. Edge Function refatorada**
- Auto-enroll de novos números
- Cálculo de fase por idade (sem depender de `dias_na_fase` manual)
- Inserir notificações em eventos importantes
- Frequência: manter 30min (15min pode causar rate limiting na UAZAPI com 40+ números)

**6. Dashboard simplificado**
- Remover abas de Configuração e Diálogos
- Dashboard único com: resumo por fase, lista de números com progresso, timeline de notificações, log de interações
- Manter botão "Forçar reinício" e "Pausar" como overrides de emergência

### Etapas

| # | Ação | Arquivo |
|---|------|---------|
| 1 | Criar tabela `aquecimento_notificacoes` | Migração SQL |
| 2 | Adicionar coluna `fase_auto` (boolean default true) em `whatsapp_aquecimento_instancias` | Migração SQL |
| 3 | Seed de ~40 diálogos na tabela existente | Insert SQL |
| 4 | Refatorar Edge Function com auto-enrollment + fase por idade + notificações | `supabase/functions/whatsapp-aquecimento/index.ts` |
| 5 | Simplificar UI do Aquecimento (dashboard único) | `src/pages/Aquecimento.tsx` |
| 6 | Criar componente de notificações | `src/components/aquecimento/AquecimentoNotificacoes.tsx` |

### Resultado

Ao conectar um novo número, ele aparece automaticamente no dashboard, começa a trocar mensagens com outros números, avança de fase sozinho, e o admin recebe notificação quando está aquecido. Zero configuração manual.

