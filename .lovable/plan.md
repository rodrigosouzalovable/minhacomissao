# Consulta UME (calculadora de desconto) dentro do Inbox Meta Oficial

Sim, é possível — e já testei de verdade agora.

## O que eu confirmei

- O relatório é aberto (sem login): abri, digitei `060.520.482-98` e ele retornou os dados da cliente.
- Retorno do teste: CPF 06052048298, ID 11279538, telefone 5592985505201, nome Claudia, atraso 382 dias, Fase 013 (0361 a 0420), limite total R$ 760, valor sem juros R$ 1.072, com juros R$ 2.490.
- Tabela Padrão: 1x R$ 1.170, 2x 635, 3x 423, 4x 355, 5x 284, 6x 237, 7x 203, 8x 177, 9x 158, 10x 142, 11x 129 (Total até 3x R$ 1.270 / 4x ou mais R$ 1.419).
- Tabela Desconto Especial: 1x R$ 1.179, 2x 643, 3x 429, 4x 349, 5x 279, 6x 232, 7x 199, 8x 174, 9x 155, 10x 139, 11x 127 (Total até 3x R$ 1.286 / 4x ou mais R$ 1.394).
- E o mais importante: consegui reproduzir essa consulta por requisição direta do servidor, sem navegador e sem login. Ou seja, o sistema consegue consultar esse CPF sozinho, em menos de um segundo, sem depender de ninguém abrir a página.

## O que será construído

1. **Motor de consulta UME**
   - Nova função de backend `consultar-ume-desconto` que recebe um CPF e devolve, em formato limpo: nome, ID, telefone, atraso, fase, limite, valor sem juros, valor com juros, e as duas grades de parcelamento (Padrão e Desconto Especial), incluindo os totais "até 3x" e "4x ou mais".
   - Cache no banco (tabela `ume_consultas_cache`) com validade configurável (padrão 12h) para não repetir consulta do mesmo CPF várias vezes na mesma conversa.
   - Se o CPF não existir na base UME, retorna "não localizado" — sem erro para o cliente.

2. **IAGO consultando automaticamente**
   - Quando a conversa está numa caixa do credor **UME**, antes de montar a proposta o IAGO consulta esse motor usando, nesta ordem: o CPF já gravado no cabeçalho da conversa, o CPF vinculado pelo telefone (últimos 8 dígitos), ou o CPF que o cliente digitar na conversa.
   - Com o retorno, ele apresenta as condições no mesmo formato do "Layout UME" já usado hoje (à vista em destaque + lista de parcelas), respeitando a parcela mínima de R$ 100 e a grade de parcelas configurada.
   - Sem resultado na UME, ele segue o comportamento atual (débitos internos / pedir CPF / escalar para humano).
   - Qual tabela usar (Padrão ou Desconto Especial) vira um ajuste na configuração do IAGO, com padrão em **Padrão** e a opção de liberar o Desconto Especial.

3. **Botão manual para o atendente**
   - No cabeçalho da conversa do Inbox Meta Oficial, um botão "Consultar UME" que abre um painel com exatamente os mesmos dados (cliente, valores, as duas tabelas) e um botão para copiar/enviar a proposta pronta na conversa.
   - Funciona também digitando um CPF manualmente, para quando a conversa ainda não tem CPF vinculado.

## Detalhes técnicos

- A consulta usa o endpoint público `batchedDataV2` do relatório (reportId `5daf4ed7-...`, datasourceId `47d99041-...`), enviando o parâmetro `digite_o_cpf`. Verificado por HTTP puro, sem cookie/OAuth, status 200.
- Três requisições por CPF (dados do cliente, tabela padrão, tabela desconto especial), disparadas em paralelo na edge function; parsing dos `stringColumn`/`doubleColumn` por posição de coluna.
- Os IDs de componente do relatório ficam num único mapa constante na função, para ajuste rápido caso o relatório seja republicado. Se a estrutura mudar, a função retorna erro identificado ("layout do relatório UME mudou") e avisa o admin pelo canal de notificação já existente, em vez de mandar valor errado ao cliente.
- Nenhum cron novo, nenhum polling: a consulta acontece por demanda (mensagem recebida ou clique do atendente) e é cacheada. Impacto de custo em Cloud desprezível.
- Migração: tabela `ume_consultas_cache` (cpf, payload jsonb, atualizado_em) com GRANTs e RLS (leitura por `authenticated`, escrita por `service_role`), mais uma coluna de configuração na `iago_config` para a escolha da tabela de desconto.
