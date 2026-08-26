---
name: IAGO respeita atendente humano, exceto Aquecimento UAZAPI
description: IAGO não responde se o mesmo telefone tiver humano, exceto conversas AQUECIMENTO+UAZAPI que sempre devem ser atendidas pelo IAGO
type: feature
---

- Antes de qualquer resposta, `iago-atendimento` chama `temAtendenteHumanoNoTelefone` (`_shared/iago.ts`): busca todos os contatos com o mesmo sufixo de 8 dígitos e, se houver etiqueta `Atendente: <nome>` diferente do IAGO, encerra sem enviar nada (cancela follow-up).
- Exceção obrigatória: se a conversa atual estiver na caixa AQUECIMENTO e a instância for `provider='uazapi'`, o IAGO NÃO deve ser bloqueado por atendente humano existente em outra caixa/instância. Nessa caixa ele deve responder toda mensagem que chega, desde que a conversa esteja etiquetada com o IAGO.
- Motivo: números espelhados (Meta oficial + UAZAPI/AQUECIMENTO) criam contatos duplicados; a regra global de humano não pode calar o IAGO no aquecimento dos chips UAZAPI.
- `iago-followup-tick` aplica a mesma checagem e a mesma exceção antes do toque de retomada.
- A regra dos 10 minutos de silêncio após resposta humana continua valendo apenas para conversas exclusivamente do IAGO.
