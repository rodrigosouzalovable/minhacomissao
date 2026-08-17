---
name: Etiqueta de atendente só por envio manual
description: Disparos em massa/campanha (template HSM) não valem como "atendeu a conversa"; caem no rodízio da caixa
type: feature
---
- No webhook do Inbox Meta, a regra "quem enviou a última mensagem fica com a conversa" considera apenas mensagens de saída **sem** `template_nome` (envio manual).
- Disparos em massa/campanha (template HSM) nunca vinculam a conversa ao remetente — a conversa vai para o rodízio circular da caixa.
- **Por quê:** em caixas onde um único login faz todas as campanhas (ex.: AMARAL/Thiago), ele recebia quase todas as conversas e o rodízio nunca era usado.
- Ordem de prioridade: acordo com o mesmo telefone → consulta de CPF no portal (7 dias) → quem atendeu manualmente → rodízio circular por caixa.
