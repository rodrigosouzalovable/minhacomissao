# Separação de recebimentos e comissões por NOVO MUNDO e UME

## Objetivo

Organizar o Dashboard e as telas de comissões para mostrar, por operador, quanto veio de clientes **NOVO MUNDO** e quanto veio de clientes **UME**, sem alterar o total recebido nem a regra atual de comissão.

A classificação seguirá o credor gravado no próprio acordo:

- `ume_novo_mundo` → **NOVO MUNDO**
- `mundo_da_moda` → **UME**

Se a TAG atual do cliente mudar depois, o histórico financeiro permanecerá no credor registrado no acordo.

## Como ficará

### 1. Ranking mensal no Dashboard

O ranking continuará ordenado pelo **Total recebido**, mas cada operador terá uma linha organizada com:

- posição e nome;
- **NOVO MUNDO** recebido;
- **UME** recebido;
- **Total** recebido;
- participação no total da equipe.

No rodapé serão mostrados os totais da equipe por credor e o total geral. Em telas menores, os três valores ficarão empilhados abaixo do nome, sem corte de informações.

O mural dos três primeiros continuará usando o total geral para definir as posições, mas exibirá abaixo de cada operador a divisão NOVO MUNDO/UME.

### 2. Metas e desempenho

- Manter uma única meta geral mensal, sem criar metas separadas por credor.
- No card “Já recebido”, mostrar o total geral e a composição NOVO MUNDO + UME.
- No “Desempenho individual”, cada operador terá os dois valores separados e o total usado para progresso da meta.
- A evolução diária e a projeção continuarão usando o total geral, garantindo que os indicadores atuais não mudem.

### 3. Histórico de meses anteriores

Ao consultar outro mês, mostrar:

- resultado próprio: NOVO MUNDO, UME e total;
- para administradores, resultado da equipe dividido da mesma forma;
- quantidade de parcelas e ticket médio preservados.

Assim, a divisão seguirá a data real do pagamento no mês escolhido, não a data de criação do acordo.

### 4. Tela “Minhas Comissões” do funcionário

Adicionar uma organização por credor sem expor a comissão interna do escritório:

- filtro: **Todos | NOVO MUNDO | UME**;
- resumo de parcelas recebidas e comissão do funcionário para cada credor;
- TAG visível em cada acordo;
- totais e lista recalculados conforme período e credor selecionados;
- Excel com coluna **Credor** e os mesmos filtros aplicados na tela.

A comissão do funcionário continuará usando exatamente a tabela atual por faixa de atraso.

### 5. Comissão individual vista pelo administrador

Na página de comissão de cada operador:

- filtro por credor junto aos filtros de período, busca e status;
- resumo separado de **valor recebido**, **comissão do funcionário** e **comissão do escritório**, cada um com NOVO MUNDO, UME e total;
- TAG do credor em cada acordo e parcela;
- exportação Excel com a coluna Credor e valores coerentes com o resumo exibido.

Apenas administradores continuarão vendo a comissão do escritório.

## Dados e segurança

- Criar uma consulta mensal centralizada que agregue pagamentos confirmados por operador e por credor.
- Considerar somente parcelas com `status = pago` e `data_paga` dentro do mês selecionado.
- Respeitar a configuração atual que oculta determinados operadores do ranking.
- Preservar as permissões atuais: cada funcionário vê somente seus dados; administradores mantêm a visão da equipe.
- Não alterar acordos, pagamentos, percentuais, metas ou TAGs já existentes.
- Manter os valores internos atuais no banco e usar os rótulos oficiais na interface, evitando migração arriscada de histórico.

## Consistência dos cálculos

Uma única estrutura de resultado alimentará ranking, metas e histórico, evitando diferenças entre cards que hoje calculam os mesmos recebimentos por caminhos separados.

Regras de conferência:

- **Total do operador = NOVO MUNDO + UME**;
- **Total da equipe = soma dos totais dos operadores**;
- cada parcela paga pertence a somente um credor, conforme o acordo;
- nenhum valor será somado novamente ao exibir as colunas;
- registros inesperados serão identificados separadamente na validação, sem serem atribuídos silenciosamente ao credor errado.

## Validação

- Conferir os totais do mês atual e de um mês anterior contra os pagamentos reais.
- Testar um operador com recebimentos dos dois credores e outro com apenas um.
- Confirmar filtros combinados de período, credor, status e busca.
- Conferir que os arquivos exportados reproduzem exatamente os totais da tela.
- Verificar visualmente o ranking em computador e celular, incluindo nomes longos e valores altos.
- Confirmar que o total geral antes e depois da mudança permanece idêntico.
