# Relatório de aquecimento sob demanda e acumulado

## Situação verificada

- O relatório automático já existe e está ativo às **20h BRT, de segunda a sábado**, enviado somente para **62991672674**.
- Hoje ele mostra captação, base, envios, entregas, leituras, respostas, gastos do dia, números em aquecimento, tiers e nichos, mas ainda não inclui o consolidado financeiro e operacional desde o início.
- Desde **03/09/2026**, o histórico registra **330 mensagens enviadas** para leads do Google Maps, **322 entregues**, **196 lidas**, **147 respostas**, **263 contatos únicos** e **R$ 13,20 de custo estimado** em mensagens.
- Também ocorreram **188 tentativas com falha**; 184 foram recusadas por bloqueio de conta empresarial da Meta. Essas falhas não entram no custo estimado acumulado.

## O que será feito

1. Adicionar na aba **API Oficial Meta → Aquecimento Meta** o botão **“Enviar relatório no WhatsApp”**, visível somente ao administrador.
2. Ao clicar, gerar os dados atualizados e enviar imediatamente o relatório para **62991672674**, com confirmação de sucesso ou mensagem clara de erro na tela.
3. Manter o envio automático das 20h sem criar outro agendamento.
4. Acrescentar ao relatório diário e ao relatório manual uma seção **“Acumulado desde o início”** com:
   - data do primeiro envio;
   - mensagens enviadas, entregues, lidas e respondidas;
   - contatos únicos e números Meta utilizados;
   - taxas de entrega, leitura e resposta;
   - falhas e principais motivos;
   - gasto total estimado em mensagens para leads;
   - custo médio por mensagem entregue e por resposta.
5. Manter separada a despesa das buscas do Google Maps em dólar, para não misturá-la com o custo das mensagens em reais.
6. Permitir o envio manual mesmo que o relatório automático do mesmo dia já tenha sido enviado, mantendo a proteção contra duplicidade apenas no horário automático.
7. Proteger a ação manual para que somente o administrador autenticado possa dispará-la.

## Avaliação atual

O engajamento está forte: **97,6% das mensagens registradas como enviadas foram entregues** e **44,5% tiveram resposta**. O principal ponto negativo não é a aceitação dos leads, mas o grande volume de tentativas recusadas por bloqueio de BM; o relatório destacará isso para diferenciar desempenho dos contatos de problemas da conta Meta.

## Detalhes técnicos

- Evoluir `google-maps-leads-relatorio-diario` para aceitar modo manual autenticado e calcular os agregados históricos diretamente de `meta_aquecimento_destino_log`, filtrando `fonte = 'lead'`.
- No modo de cron, conservar a chave diária de idempotência; no modo manual, usar uma chave própria por solicitação para não impedir o relatório automático das 20h.
- Reaproveitar `AquecimentoMetaTab` e o padrão atual de botão, carregamento e aviso da tela.
- Não criar tabela, polling ou novo cron.

## Alerta de custo Lovable Cloud

O clique manual executará consultas e uma função adicional somente quando você usar o botão. O impacto esperado é **baixo**, mas vários cliques repetidos no mesmo dia gerarão novas execuções e novos envios de WhatsApp. O agendamento existente das 20h permanece único.
