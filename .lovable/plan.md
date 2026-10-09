# Corrigir avisos de qualidade da BM Hospital Med

## Diagnóstico confirmado
- Os números **SOUZA 62 8267-7554** e **SOUZA 62 8276-5462** têm qualidade **RED (baixa)** na última consulta registrada à Meta, às **15h56 de 09/10/2026**. Isso corresponde às imagens enviadas.
- As notificações enviadas às 15h56 afirmaram “Qualidade GREEN”, mas o texto de liberação usa essa frase fixa quando o número retorna ao pool — mesmo com qualidade RED/YELLOW autorizada para seleção manual.
- Portanto, esses avisos não comprovam retorno ao GREEN: confundiram **liberação para seleção** com **melhora da qualidade**. O campo de qualidade consultado já estava RED.

## Correção proposta
1. **Exibir a qualidade efetivamente consultada na Meta** nos avisos, incluindo número, BM e horário da consulta. RED será identificado como baixa, YELLOW como média e GREEN como alta; leitura ausente será indicada como não confirmada.
2. **Separar os eventos:** remover uma trava local por qualidade será informado como liberação para seleção manual, sem afirmar que a Meta removeu um bloqueio real, que não há aviso de cota ou que houve recuperação para GREEN. Liberação de bloqueio real terá descrição própria, sempre com a qualidade atual.
3. **Reservar avisos de recuperação para GREEN às leituras confirmadas** e aos critérios de recuperação aplicáveis. Retorno ao pool, conexão CONNECTED ou autorização manual não alterarão qualidade, dias GREEN ou métricas de recuperação.
4. Publicar a correção e reconsultar individualmente os dois números, sem enviar campanhas. Conferir que os cards e o aviso calculado usam a mesma leitura. Se a consulta falhar, informar a última leitura e seu horário, sem anunciar melhora.

## Proteções mantidas
- Preservar a seleção manual RED/YELLOW já autorizada, bloqueios reais da Meta, banimentos, cotas, permissões e blacklist.
- Não aumentar volume nem criar novas rotinas, pesquisas ou consultas periódicas. Apenas as duas verificações pontuais e os fluxos existentes.
- Não prometer recuperação de qualidade nem atribuir retorno ao GREEN ao reaquecimento sem evidência.
- Não apagar ou alterar os avisos já enviados no WhatsApp; esclarecer aqui que a informação GREEN daqueles avisos era incorreta. Não enviar nova mensagem corretiva automaticamente.

## Detalhes técnicos e validação
- Extrair a classificação do evento de liberação para uma regra compartilhada testável e usá-la em `check-meta-instance-health`, removendo o GREEN fixo.
- Usar a qualidade consolidada da consulta, mantendo a distinção entre saúde de mensagens, estado do pool e qualidade. Não substituir RED/YELLOW por GREEN em função de liberação.
- Testar RED e YELLOW liberados manualmente sem evento GREEN; GREEN confirmado; qualidade desconhecida/consulta falha; bloqueio real removido com qualidade ainda baixa; saída manual do pool e restrição simultânea preservadas. Os testes verificarão decisões e valores, não texto ou aparência.
- Conferir registros atuais e notificações geradas para os dois números; não iniciar disparos reais durante a validação.