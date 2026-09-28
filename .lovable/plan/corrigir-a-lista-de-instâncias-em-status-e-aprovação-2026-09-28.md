# Corrigir a lista de instâncias em Status e Aprovação

## O que foi confirmado
- A tela busca todos os registros de templates em uma única consulta, sem paginação. Há 1.347 registros nessa tabela; a leitura retorna no máximo 1.000 antes de filtrar pelo modelo. Por isso a lista pode mostrar apenas parte das instâncias, como as duas da captura.
- Para `confirmamos_o_registro`, existem **50 registros por instância**: 37 pendentes, 9 aprovados e 4 com falha. O único lote concluído registrado para esse modelo contém 50 instâncias: 46 submissões aceitas pela Meta e 4 falhas. Portanto, os 84 números mencionados não estão comprovadamente aplicados; faltam 34 registros em relação à seleção informada.
- Não há, nos dados conferidos, registro de lote concluído para as outras 34. Não presumir envio nem reenviar automaticamente.

## Mudanças propostas
1. Carregar os registros do modelo em páginas, filtrados pelos modelos do proprietário antes da paginação, e exibir a contagem completa em “Ver detalhes por instância”. Evitar uma consulta global maior e não adicionar polling.
2. Mostrar separadamente quantas instâncias foram selecionadas, submetidas, aprovadas, pendentes, falharam ou ficaram sem registro/adiadas. Exibir o motivo conhecido de cada falha e avisar quando o processamento não corresponder ao total selecionado.
3. Conferir o fluxo que recebe as instâncias selecionadas e o limite diário por número para identificar o destino das 34 restantes; só oferecer nova tentativa controlada para instâncias faltantes ou com falha, sem duplicar submissões pendentes/aprovadas e sem misturar números de outros proprietários.
4. Validar no painel, após atualização, as 50 linhas já gravadas e os totais reais; testar uma seleção sem enviar templates de verdade à Meta.

## Detalhes técnicos
A consulta de `meta_templates_instancia` em `MetaTemplates.tsx` não usa `.range()` nem restringe por `template_mestre_id`; depois filtra em memória. Aproveitar o índice existente por modelo para a leitura paginada. No envio em lote, comparar IDs solicitados, elegíveis, adiados e efetivamente registrados; a rotina atual só grava previamente os números que passam pela reserva diária. Preservar o limite de duas submissões por número/dia e a interrupção por reclassificação como Marketing.
