---
name: IAGO cala quando há atendente humano na etiqueta
description: IAGO não responde nem faz follow-up se o mesmo telefone (sufixo 8 dígitos, qualquer caixa/instância) tiver etiqueta "Atendente: <humano>"
type: feature
---

- Antes de qualquer resposta, `iago-atendimento` chama `temAtendenteHumanoNoTelefone` (`_shared/iago.ts`): busca todos os contatos com o mesmo sufixo de 8 dígitos e, se houver etiqueta `Atendente: <nome>` diferente do IAGO, encerra sem enviar nada (cancela follow-up).
- Motivo: números espelhados (Meta oficial + UAZAPI/AQUECIMENTO) criam contatos duplicados; o IAGO respondia na cópia mesmo com humano já vinculado na outra.
- `iago-followup-tick` aplica a mesma checagem antes do toque de retomada.
- A regra dos 10 minutos de silêncio após resposta humana continua valendo apenas para conversas exclusivamente do IAGO.
