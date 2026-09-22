# Economizar tokens da Casa dos Dados e iniciar 50 envios

## Diagnóstico confirmado

- Hoje o sistema cadastrou **9.010 leads**, confirmou **900 números com WhatsApp** e ainda possui **7.960 números aguardando verificação**.
- Nenhum envio do Certificado Digital foi reservado ou enviado hoje.
- A BM selecionada está ativa, com uma instância conectada, qualidade GREEN e o template `liberado_para_emissao` aprovado.
- O início da prospecção consulta a Casa dos Dados antes de verificar se já há contatos locais suficientes.
- A coleta automática também percorre todas as janelas e pode verificar até 2.000 números, mesmo com estoque local disponível.

## Correção

1. **Consumir primeiro o estoque local**
   - Antes de consultar a Casa dos Dados, calcular quantos envios ainda faltam para completar o limite diário de 50.
   - Usar primeiro os contatos já confirmados com WhatsApp.
   - Se faltarem contatos confirmados, verificar somente a quantidade necessária entre os leads já armazenados.
   - Consultar a Casa dos Dados somente quando o estoque local confirmado e pendente não puder completar a campanha.

2. **Limitar novas coletas ao necessário**
   - Interromper a coleta assim que houver contatos suficientes para o saldo diário.
   - Usar páginas pequenas, proporcionais ao que falta, em vez de consultar todas as janelas.
   - Manter deduplicação, blacklist e falhas técnicas sem classificar incorretamente um número como sem WhatsApp.

3. **Proteger contra repetição**
   - Verificar campanha existente e limite diário antes de qualquer consulta externa.
   - Impedir que cliques repetidos iniciem outra coleta ou campanha para o mesmo dia.
   - Aplicar a mesma regra econômica ao processamento manual e à execução automática das 09h.

4. **Executar o teste real solicitado**
   - Publicar a correção.
   - Iniciar uma campanha real com **até 50 contatos** do estoque já confirmado, sem nova consulta à Casa dos Dados.
   - Confirmar a criação da campanha, o primeiro processamento e o intervalo já configurado de 30 a 90 segundos.
   - Informar quantos foram reservados, enviados e se houve alguma falha inicial.

## Resultado esperado

Os 900 contatos já confirmados serão utilizados primeiro, permitindo aproximadamente 18 dias de campanhas de 50 contatos sem nova coleta. Os 7.960 contatos pendentes serão verificados gradualmente antes de qualquer novo consumo na Casa dos Dados.
