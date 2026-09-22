# País aleatório e nova compra durante cancelamento

## Resultado esperado
- Adicionar **País aleatório — mais barato disponível** no campo País Internacional.
- Antes da compra, consultar a disponibilidade internacional e escolher automaticamente o país com o menor preço dentro do teto configurado.
- Após a compra, identificar o país realmente retornado e mostrar somente:
  - **DDI**, separado, por exemplo `+380`;
  - **Número completo**, com DDI, por exemplo `+380 912205105`.
- Os botões de copiar e de preparar a conexão usarão o número completo, sem acrescentar `55` e sem duplicar o DDI.

## Número banido aguardando cancelamento
- Ao marcar um número como banido, movê-lo visualmente para **Cancelamento pendente**.
- Liberar imediatamente o botão **Comprar número**, sem esperar os cinco minutos do fornecedor.
- Permitir apenas um novo número utilizável aguardando SMS por vez; pedidos banidos aguardando cancelamento não bloquearão essa compra.
- Manter o contador e cancelar automaticamente cada número banido assim que o fornecedor permitir.
- Continuar acompanhando separadamente o SMS do novo número.

## Segurança e consistência
- Nunca tratar falha ao identificar o país/DDI como sucesso silencioso: mostrar o número original e um aviso para conferência.
- Não marcar o número banido como reembolsado até o fornecedor confirmar o cancelamento.
- Manter limite mensal, teto por compra e histórico atuais.
- Se nenhum país tiver número disponível dentro do teto, não realizar compra nem gerar cobrança.

## Detalhes técnicos
- Fazer a busca de menor preço em uma única consulta consolidada ao fornecedor, evitando consultar país por país.
- Retornar junto da cotação o identificador do país vencedor e usá-lo na compra e no registro do pedido.
- Separar os pedidos aguardando SMS dos pedidos banidos em cancelamento para que consulta do código e temporizadores funcionem simultaneamente.
- Validar número brasileiro e internacional, cópia, seleção aleatória, compra, cancelamento automático e tela em tamanhos diferentes.

## Impacto de custo
A opção de país mais barato fará uma consulta de disponibilidade antes de cada compra aleatória. A implementação usará uma única consulta consolidada, sem rotina contínua e sem consultas país por país; portanto, o aumento esperado é pequeno e ocorre somente ao solicitar uma compra.
