# Recebimentos organizados por Novo Mundo, UME e Odres Cred

## Objetivo

Incluir os pagamentos dos acordos **ODRES CRED** nos valores recebidos e identificar claramente **NOVO MUNDO**, **UME** e **ODRES CRED** em todas as telas de recebimentos, conforme sua escolha.

## Situação confirmada

- Há 93 acordos Odres Cred e 16 parcelas marcadas como pagas. A consulta dos pagamentos de outubro encontrou **R$ 3.786,19** para Odres Cred, antes dos filtros de usuário e visibilidade do ranking.
- A consulta atual do ranking soma somente Novo Mundo e UME, inclusive no total geral. Portanto, os pagamentos Odres estão registrados, mas ficam fora desse total.
- Ranking, mural dos primeiros colocados, metas e histórico apresentam divisão apenas entre Novo Mundo e UME.
- As páginas de comissões já reconhecem Odres Cred; serão preservadas e conferidas, sem mudar percentuais ou honorários.

## Alterações

### 1. Contagem correta dos recebimentos

- Classificar cada parcela pelo credor registrado no próprio acordo, nunca pela logo ou TAG do cliente.
- Somar apenas pagamentos confirmados, no período da **data efetiva de pagamento**.
- Exibir quatro valores: **NOVO MUNDO | UME | ODRES CRED | TOTAL**.
- Garantir que **Total = Novo Mundo + UME + Odres Cred**, sem duplicar parcelas.
- Aplicar também aos pagamentos Odres já registrados, sem editar registros financeiros.
- Lançar um acordo ainda pendente não aumentará o recebido: o valor entrará somente quando a parcela for marcada como paga. Desmarcar o pagamento retirará esse valor.

### 2. Organização em todas as telas

- **Dashboard e metas:** divisão dos recebimentos pelos três credores, mantendo uma única meta geral.
- **Ranking e mural:** valores por credor para cada operador, com ordenação pelo total geral incluindo Odres.
- **Histórico:** separação dos resultados próprios e da equipe pelos três credores no mês escolhido.
- **Comissões:** completar a identificação de Odres nos resumos e gráficos administrativos que ainda mostram dois credores; conferir filtros e exportações existentes sem alterar a regra de cálculo.
- Manter nomes completos e valores legíveis, sem misturar Odres com UME.

### 3. Atualização após o pagamento

- Conferir os caminhos de lançamento, confirmação, desmarcação e alteração da data do pagamento.
- Atualizar os resumos afetados após uma operação bem-sucedida, incluindo metas, histórico, ranking e comissões.
- Preservar o responsável original pelo acordo: quem confirma o pagamento não passa a receber o crédito pelo acordo.

## Detalhes técnicos

- Criar uma versão aditiva da consulta agregadora com `odres_cred_recebido` e total dos três credores, migrando seus consumidores sem interromper a função antiga.
- Atualizar `RankingMensal`, `MuralTop3`, `MetasMensal`, `HistoricoMesesCard` e as divisões pertinentes de `Dashboard`.
- Reutilizar os identificadores e rótulos existentes em `empresaLabels.ts`.
- Preservar permissões, isolamento de acesso e configuração de operadores ocultos do ranking; funcionários não ganharão acesso aos honorários do escritório.
- Reutilizar consultas e atualização após operações, sem novos agendamentos, consultas periódicas ou canais de atualização contínua.
- Não alterar valores das parcelas, taxas de comissão, honorários, datas, status ou credores dos acordos existentes.

## Validação

- Testar pagamentos de cada credor e a igualdade entre a soma das três divisões e o total.
- Testar que pendentes não contam, pagos contam uma única vez e desmarcação remove o valor.
- Testar pagamento em mês diferente do lançamento e preservação do responsável pelo acordo.
- Conferir os totais Odres de outubro contra os pagamentos reais, respeitando os filtros de cada tela.
- Conferir filtros, exportações e atualização dos resumos após confirmação do pagamento, sem modificar pagamentos reais durante os testes.
- Validar a apresentação e as permissões de funcionário e administrador.