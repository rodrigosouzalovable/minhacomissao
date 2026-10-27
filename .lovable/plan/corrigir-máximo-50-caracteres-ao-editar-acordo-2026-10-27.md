# Corrigir "Máximo 50 caracteres" ao editar acordo

## Causa
O erro de agora não é mais o CPF. É o campo **Observações**. Os acordos fechados pelo portal ou lançados pelo Inbox recebem uma observação automática longa, por exemplo: "Acordo fechado pelo cliente no portal (Odres Cred) — PRD — PIX/boleto emitido", com 77 caracteres. A tela de edição só aceita até 50 caracteres e recusa o salvamento, mesmo quando você muda apenas o operador.

## O que será feito
- O limite das observações na edição sobe para 500 caracteres.
- As observações automáticas antigas continuam aceitas, sem precisar apagar nada.
- A regra de mínimo (informar o número que falou com o cliente) continua valendo só quando o campo está vazio ou muito curto.
- Teste: editar o acordo do CPF 062.305.273-32 trocando só o operador e confirmar que salva.

## Detalhes técnicos
- `src/pages/EditarAcordo.tsx`: no schema zod, `observacoes` passa de `.max(50)` para `.max(500)`. Ajustar o `maxLength` do campo, se houver.
