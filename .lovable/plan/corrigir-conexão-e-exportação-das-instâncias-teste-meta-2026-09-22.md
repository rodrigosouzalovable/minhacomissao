# Corrigir conexão e exportação das instâncias Teste Meta

## Diagnóstico confirmado

- A lista reúne **37 instâncias UAZAPI** e **21 instâncias Teste Meta**, totalizando as **58** exibidas.
- As 21 instâncias Teste Meta estão ativas e possuem a configuração necessária da API Oficial.
- Somente 2 delas têm `saude_status = CONNECTED`; as outras 19 ainda não receberam esse registro de saúde.
- A tela hoje só considera uma Teste Meta conectada quando esse campo contém `CONNECTED`. Por isso mostra **39/58** e marca 19 cartões como **Não verificada**.
- A exportação usa a mesma regra restritiva; consequentemente, essas 19 instâncias ficam fora do Excel mesmo estando ativas e configuradas.

## Correção

1. **Reconhecer a conexão das instâncias Teste Meta**
   - Considerar conectada a instância de teste que estiver ativa e corretamente configurada na API Oficial Meta.
   - Continuar respeitando um estado oficial explícito de desconexão ou desativação, quando existir.
   - Não expor token, identificadores internos ou outras credenciais na aba UAZAPI.

2. **Atualizar cartões e contagem**
   - Substituir a tag **Não verificada** por **Conectado** nas 19 instâncias ativas e configuradas.
   - Fazer a contagem refletir as instâncias UAZAPI conectadas mais todas as Teste Meta conectadas pela nova regra.
   - Preservar a identificação **Teste Meta** e o nome da BM em cada cartão.

3. **Incluir no Excel**
   - Aplicar a mesma regra de conexão na exportação.
   - Incluir os telefones das instâncias Teste Meta ativas e configuradas.
   - Manter remoção de duplicidades, uma única coluna sem cabeçalho e tratamento correto de números brasileiros e internacionais.

4. **Validar**
   - Conferir que a aba passa de **39/58** para **58/58**, desde que as 37 UAZAPI continuem conectadas no momento da verificação.
   - Clicar em **Verificar conexões** e confirmar que os cartões Teste Meta permanecem como conectados.
   - Gerar o Excel e confirmar a inclusão dos 21 números Teste Meta, sem duplicidades.
   - Validar a visualização para o administrador e para os demais usuários autorizados.

## Detalhes técnicos

- Ajustar as respostas protegidas `list-meta-test-instances` e `list-instances-status` para devolver o estado efetivo das instâncias Teste Meta sem enviar credenciais ao navegador.
- Unificar essa regra na contagem, nos cartões, na atualização manual e na exportação para evitar divergências futuras.
- Não será criado agendamento, consulta recorrente ou verificação automática adicional; portanto, não há aumento recorrente de custo no Lovable Cloud.
