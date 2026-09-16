# Verificação de pagamento por instância Meta e correção da GoldImage

## Situação confirmada agora

A instância **SOUZA 62 8275-5772**, vinculada à **GM Goldimage (FB WALLACE)**, ainda está marcada internamente com o motivo antigo `Business eligibility payment issue`, porém a última resposta salva da Meta já mostra:

- WABA **ACTIVE** e revisão da conta **APPROVED**;
- negócio **verified**;
- envio da WABA e do BUSINESS como **AVAILABLE**;
- nenhum banimento registrado.

Portanto, a pendência de pagamento ficou desatualizada no card. A restrição atual é outra: o próprio número está como **LIMITED** porque o nome de exibição ainda não foi aprovado (`AVAILABLE_WITHOUT_REVIEW`), e a qualidade ainda aparece como `UNKNOWN`. A imagem enviada mostra o limite atual de **250 conversas** e não confirma o estado do cartão.

## O que será feito

1. **Adicionar “Verificar pagamento” em todos os cards** da aba API Oficial Meta, sempre visível e com carregamento individual.
2. Ao clicar, consultar a Meta naquele momento e mostrar um resultado claro:
   - **Pagamento confirmado**: conta/WABA disponíveis, sem erro de faturamento;
   - **Pagamento pendente**: a Meta ainda informa bloqueio de pagamento/elegibilidade;
   - **Não foi possível confirmar**: token/permissão ou resposta insuficiente, sem liberar indevidamente.
3. **Separar pagamento das demais limitações** no retorno: um cartão regularizado não será apresentado como problema de pagamento quando a pendência real for nome, qualidade, banimento ou outra restrição.
4. **Corrigir a GoldImage na revalidação**: remover o motivo antigo de pagamento, manter a instância fora das campanhas enquanto o número continuar `LIMITED`, e exibir que a ação pendente é a aprovação do nome de exibição — sem liberar o envio de forma insegura.
5. Exibir no card o **resultado e horário da última verificação**, com texto específico para a limitação atual.
6. Validar o botão na GoldImage e em uma instância saudável, garantindo que cada card atualize somente sua própria instância.

## Detalhes técnicos

- Reaproveitar `check-meta-instance-health`; não criar agendamento, polling ou nova consulta automática.
- Tornar explícito no retorno o estado de pagamento inferido pela resposta de saúde da Meta e o motivo independente da restrição do número.
- Ajustar `ConfigurarMeta.tsx` para o novo botão e mensagens; manter o botão geral de sincronização de saúde separado.
- Sem mudança de banco de dados e sem aumento recorrente de custo: a consulta ocorre apenas quando o botão for clicado.
