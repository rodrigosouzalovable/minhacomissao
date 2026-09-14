# Ajustes no PDF do termo de acordo

## Resultado esperado

1. **Logo Novo Mundo melhor enquadrada**
   - Remover o excesso de área transparente ao redor da marca antes de colocá-la no PDF.
   - Preservar a proporção original, sem esticar ou achatar, e alinhar a marca com a logo Souza e Ribeiro no cabeçalho.
   - Manter o tratamento atual da marca UME.

2. **Número do acordo em Meus Acordos**
   - Exibir na ficha de cada cliente o mesmo número curto usado no PDF, por exemplo `Acordo nº F06B2A78`.
   - Centralizar a formação desse identificador para impedir divergências entre a tela e o documento.

3. **Tabela de parcelas mais espaçosa**
   - Aumentar a altura do cabeçalho e das linhas da tabela.
   - Reequilibrar as larguras e os recuos de **Parcela**, **Vencimento**, **Valor** e **Situação**, deixando textos e valores visualmente centralizados e sem encostar na cláusula seguinte.
   - Repetir corretamente o cabeçalho quando muitas parcelas exigirem uma nova página.

4. **Encerramento sem assinaturas**
   - Remover todas as linhas de assinatura do cliente, credor e testemunhas.
   - Substituir essa área por um quadro informativo, sem campos para assinatura, contendo:
     - nome do cliente;
     - CPF;
     - credor correspondente ao acordo — Novo Mundo ou UME;
     - Souza e Ribeiro Advocacia e Cobrança, identificada como empresa terceirizada de cobrança.

## Validação

- Gerar e inspecionar visualmente termos de Novo Mundo e UME.
- Conferir casos com uma e várias parcelas, incluindo quebra de página.
- Validar que o número mostrado em Meus Acordos é exatamente o mesmo impresso no PDF.
- Verificar compilação e erros da tela após os ajustes.

## Detalhes técnicos

- Alterações somente no gerador do PDF e na ficha exibida em **Meus Acordos**.
- Nenhuma mudança no banco, automação, consulta recorrente ou custo adicional de backend.
