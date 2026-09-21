# Liberar instâncias aptas e recuperar a captação Google Maps

## Resultado
- Revalidar as instâncias fora do pool e devolver automaticamente somente as que estão conectadas, sem bloqueio comercial, sem retirada manual e sem risco real ativo.
- Preservar fora do envio números em RED/YELLOW, recuperação, quarentena, violação ou retirada manual.
- Corrigir a captação para parar de repetir nichos e cidades já esgotados, usando novos alvos antes de gastar consultas em combinações sem resultados.
- Validar o novo estoque de telefones e executar uma rodada de aquecimento após a correção.

## Detalhes técnicos
- Usar a verificação de saúde existente, que trata reprovação/pêndencia de nome apenas como aviso.
- Selecionar o alvo do Google Maps pelo histórico recente de rendimento, priorizando combinações ainda não pesquisadas ou com melhor retorno.
- Manter os tetos atuais de consultas e o agendamento existente; não criar novo cron, polling ou custo recorrente adicional.
- Publicar apenas as funções alteradas e conferir registros de busca, números captados e instâncias elegíveis.
