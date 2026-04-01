

## Etapas Pendentes do Aquecimento de WhatsApp

Comparando o plano original com o que já foi implementado:

| Etapa | Status |
|-------|--------|
| 1. Tabelas no banco de dados | Concluído |
| 2. Página `/aquecimento` com 4 abas | Concluído |
| 3. Navegação + rota | Concluído |
| 4. Edge Function `whatsapp-aquecimento` | Concluído |
| 5. Detecção de respostas no webhook | **Pendente** |
| 6. Cron job via pg_cron | Concluído |

---

### O que falta implementar

**Etapa 5 — Detectar respostas de aquecimento no webhook `whatsapp-chatbot`**

Quando uma mensagem chega via webhook, o sistema precisa verificar se ela é uma resposta a uma interação de aquecimento antes de processá-la normalmente.

**Alteração em `supabase/functions/whatsapp-chatbot/index.ts`:**
- Após identificar a `instancia_id` e o telefone remetente, consultar `whatsapp_aquecimento_interacoes` procurando uma interação recente (últimas 2h) com `status = 'ENVIADO'` onde:
  - `instancia_destino_id` = instância que recebeu a mensagem
  - `instancia_origem_id` = instância do remetente (buscar pelo telefone nas `user_whatsapp_instances`)
- Se encontrar, atualizar a interação: `status → 'RESPONDIDO'`, `respondido_em → now()`, `tempo_resposta_segundos → diferença`, `conteudo_resposta → texto recebido`
- Incrementar `respostas_recebidas` na tabela `whatsapp_aquecimento_instancias` para a instância de origem
- Pular o processamento normal do chatbot (não responder automaticamente a mensagens de aquecimento)

### Melhorias opcionais (não no plano original)
- Log de interações sem nomes de origem/destino (a tabela não faz join com `user_whatsapp_instances` para mostrar nomes)
- Envio de áudios PTT na Edge Function (atualmente só envia texto, linha 123: `eq("tipo", "texto")`)
- Incremento de `dias_na_fase` (a Edge Function verifica `dias_na_fase` mas nunca incrementa esse campo diariamente)
- Filtros na aba de Log (data, status) ainda não implementados na UI

