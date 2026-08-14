# IAGO assume as conversas antigas durante o plantão (17h–08h)

Hoje o plantão do IAGO só vale para **conversas novas**: se a conversa já tem etiqueta de um atendente humano (ex.: Anna Flávia), o cliente pode responder às 19h e ninguém responde — o IAGO não entra porque a conversa não é dele.

## Como vai passar a funcionar

- Cliente responde dentro da janela do plantão da caixa (padrão 17h → 08h, e sábado/domingo 24h):
  - Se a conversa está com um atendente humano, o IAGO **assume temporariamente**: a etiqueta do humano é guardada, a etiqueta `Atendente: IAGO Ribeiro de Souza` é aplicada e o IAGO responde normalmente (proposta, confirmação de parcelamento, pergunta da data de pagamento etc.).
  - Vale para qualquer conversa antiga, com ou sem proposta já enviada.
- **Devolução às 08h**: quando o plantão termina, a conversa volta automaticamente para o atendente humano original (etiqueta restaurada, etiqueta do IAGO removida).
  - Exceção: se o IAGO escalou para "Aguardando Humano" ou fechou a negociação, a conversa fica marcada para atendimento humano e a etiqueta original também é devolvida — sem perder o histórico.
- Conversa em opt-out ("BLOQUEAR CONTATO"), número errado, ou onde o cliente já tem acordo lançado: comportamento atual mantido (IAGO não negocia).
- Se o IAGO não estiver marcado como atendente daquela caixa, nada muda.

## Aviso no seu WhatsApp quando a negociação fechar

O aviso de negociação fechada já existe, mas hoje depende do envio pelos chips. Vai ser reforçado:

- Ao fechar/escalar, o aviso é enviado aos contatos de emergência com o fluxo já corrigido (rodízio de instâncias conectadas → fallback pela API Oficial da Meta) e registrado no sino "Negociações do IAGO".
- Passa a incluir na mensagem: nome do cliente, telefone, CPF, credor da caixa, opção escolhida (à vista/parcelado) e a data de pagamento informada.
- Confirmação de que seu número (62991672674) está ativo na lista de contatos de emergência; caso algum aviso falhe em todos os caminhos, ele fica pendente e é reenviado.

## Detalhes técnicos

Banco (nova migração):
- Nova tabela `iago_plantao_transferencia`: `contato_id` (PK), `etiqueta_original_id`, `folder_id`, `assumido_em`, `devolvido_em`. GRANTs para `authenticated`/`service_role`, RLS com leitura/escrita admin.

Backend:
- `meta-whatsapp-webhook`: no bloco de atribuição de atendente, quando `jaTemAtendente` for verdadeiro e o plantão da caixa estiver ativo naquele momento (mesmo cálculo de janela BRT já usado), e a etiqueta atual não for a do IAGO: gravar a transferência, remover o vínculo da etiqueta humana e inserir a etiqueta do IAGO (`origem: 'plantao_iago'`). Sem plantão ativo, nada muda.
- Nova function `iago-plantao-devolver` (cron 1x/dia às 11:05 UTC = 08:05 BRT): para cada transferência sem `devolvido_em` cuja caixa esteja fora do plantão, remove a etiqueta do IAGO, reinsere a etiqueta original e marca `devolvido_em`.
- `iago-atendimento`: mantém a checagem de etiqueta (funciona sozinha após a troca). Nos pontos de escalada/fechamento, incluir opção escolhida e data de pagamento no texto de `avisarEmergencia`.

Custo: um cron leve por dia e uma leitura extra de janela por mensagem recebida em conversa já etiquetada — impacto desprezível.
