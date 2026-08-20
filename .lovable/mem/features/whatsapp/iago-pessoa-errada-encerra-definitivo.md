---
name: IAGO pessoa errada encerra definitivo
description: Quando o cliente nega ser o titular, o IAGO encerra, nunca faz follow-up e o telefone entra em supressão de disparos
type: feature
---
- Detecção de "pessoa/número errado" em `_shared/iago.ts` é tolerante a erros de digitação ("pessoo errada", "num erado").
- Além do regex, a IA retorna `nao_e_titular` no JSON; qualquer um dos dois encerra a conversa com a mensagem padrão única (`MSG_NUMERO_ERRADO`).
- Encerramento grava `etapa='numero_errado'`, `followup_feito=true`, `followup_etapa=3`, etiqueta "Aguardando Humano", qualificação "Não é o Cliente" e insere o telefone em `meta_destinatario_supressao` (motivo `pessoa_errada`) — nunca mais contatar.
- `iago-followup-tick` pula qualquer estado com etapa `numero_errado`/`falecido`/`optout` (ou `optout=true`) antes de gerar texto, e também quando o histórico já contém o encerramento "desculpe o incômodo".
