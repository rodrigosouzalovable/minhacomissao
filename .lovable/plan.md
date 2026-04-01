

## Aquecimento de WhatsApp — Plano de Implementação

Este é um recurso grande que será dividido em etapas incrementais. A primeira entrega inclui as tabelas, a página com dashboard/lista/configurações/log, e a Edge Function principal de aquecimento.

---

### 1. Criar tabelas no banco de dados

Migration SQL com 5 tabelas:
- `whatsapp_aquecimento_instancias` — controle de fase/status por instância
- `whatsapp_aquecimento_interacoes` — log de cada interação enviada/respondida
- `whatsapp_aquecimento_dialogos` — pool de textos/áudios/reações
- `whatsapp_aquecimento_config` — configurações globais (limites, horários, delays)
- `whatsapp_aquecimento_agendamentos` — fila de envios programados

Inclui índices, RLS policies (admin-only para gerenciamento, select para usuários autenticados em suas instâncias), triggers de `updated_at`, e dados iniciais (configurações padrão + pool de ~20 diálogos).

Foreign keys referenciam `user_whatsapp_instances(id)` com `ON DELETE CASCADE`.

---

### 2. Criar página `/aquecimento`

Novo arquivo `src/pages/Aquecimento.tsx` (rota protegida, admin-only) com 4 seções em abas:

**Aba Dashboard:**
- Cards: total de números, em aquecimento, interações hoje/7 dias, taxa de sucesso, próximos agendamentos
- Queries agregadas nas tabelas de aquecimento

**Aba Números:**
- Tabela com instâncias WhatsApp e seu status de aquecimento (fase, dias, interações hoje, taxa de resposta)
- Botões: Iniciar, Pausar, Ver conversas
- Permite iniciar aquecimento manual selecionando números

**Aba Configurações:**
- Formulário para editar configs da tabela `whatsapp_aquecimento_config`
- Limite diário por fase, horário comercial, dias ativos, delay min/max, áudios e reações on/off

**Aba Log de Interações:**
- Tabela paginada com histórico: data, origem, destino, tipo, conteúdo, status, tempo de resposta
- Filtros por data e status

---

### 3. Atualizar navegação

- Adicionar item `{ href: '/aquecimento', label: 'Aquecimento', icon: Flame, adminOnly: true }` em `AppLayout.tsx`
- Adicionar rota `<Route path="/aquecimento" element={<AdminRoute><AquecimentoPage /></AdminRoute>} />` em `App.tsx`

---

### 4. Edge Function `whatsapp-aquecimento`

Lógica principal executada via pg_cron a cada 15 minutos:

1. Busca instâncias com `status = 'EM_AQUECIMENTO'`
2. Verifica horário comercial (8h-18h São Paulo) e dia da semana
3. Para cada instância que não atingiu limite diário:
   - Seleciona instância destino aleatória (diferente, que não interagiu nas últimas 24h)
   - Busca diálogo compatível com a fase atual
   - Envia via `send-whatsapp` (texto) ou `send-whatsapp-audio` (áudio)
   - Registra na tabela de interações com status `ENVIADO`
   - Incrementa `interacoes_hoje`
4. Avalia progressão de fase (7 dias cumpridos com média adequada → avança)
5. Se taxa de falha > 10% em 1h → pausa automaticamente

---

### 5. Lógica de resposta no webhook existente

Atualizar `whatsapp-chatbot` para detectar interações de aquecimento:
- Quando receber mensagem, verificar se existe interação pendente na tabela `whatsapp_aquecimento_interacoes` com mesmo par origem/destino
- Se sim, atualizar status para `RESPONDIDO`, calcular `tempo_resposta_segundos`, registrar `conteudo_resposta`
- Atualizar métricas da instância (`respostas_recebidas`)

---

### 6. Agendar via pg_cron

Criar cron job que invoca `whatsapp-aquecimento` a cada 15 minutos usando `pg_cron` + `pg_net`.

---

### Detalhes técnicos

- As tabelas usam `VARCHAR` para status em vez de enums para flexibilidade
- O pool de diálogos vem pré-populado com ~20 textos + 4 áudios + 4 reações
- Progressão de fase: Fase 1→2→3→4→AQUECIDO, cada uma com 7 dias e limites crescentes (5→10→15→25→30/dia)
- Reset de `interacoes_hoje` será feito pela Edge Function no primeiro run do dia (quando detecta que a última interação foi de outro dia)
- RLS: admin full access; usuários autenticados podem ver instâncias/interações vinculadas às suas próprias `user_whatsapp_instances`

