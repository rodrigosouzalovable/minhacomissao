# Credor MMP Mundo da Moda com tabela de descontos própria

## Como está hoje (verificado)

- Em `Importar Devedores`, o seletor "Credor / Layout da Planilha" tem as opções Padrão, MONTREAL, MONTREAL (Atualização), COBMAIS, Vincular Telefones, Pagamentos, UME APORTE e UME Consolidado. A lista de credores de destino (`CREDORES_OPCOES`) já contém "MUNDO DA MODA", "UME | NOVO MUNDO" e "MONTREAL".
- Os descontos do portal são fixos no código (`src/lib/descontoPortal.ts`): até 200 dias → 10% à vista / 0% parcelado; 201–300 → 20%/10%; 301–500 → 30%/20%; acima de 500 → 50%/30%. Valem para todos os credores, sem exceção.
- O portal (`ConsultaResultado.tsx` + `DiscountTierSelector.tsx`) calcula os dias de atraso pela parcela mais antiga e chama essas regras fixas.

## O que será construído

### 1. Nova opção de credor na importação

- Adicionar "MMP Mundo da Moda" ao seletor de credor/layout, usando o mesmo formato de planilha do layout Padrão (A=CPF, B=Nome, C=Credor, D=Contrato, E=Nº Parcela, F=Vencimento...).
- Os registros importados são gravados com o credor `MMP MUNDO DA MODA`, e essa opção também passa a existir na lista de credores de destino.

### 2. Editor de descontos por faixa de atraso

Ao selecionar "MMP Mundo da Moda" aparece um painel "Descontos do portal — MMP Mundo da Moda":

- Uma linha por faixa, com: **De (dias)**, **Até (dias)**, **% à vista**, **% parcelado** e botão de remover.
- Botão **Adicionar faixa** acrescenta uma nova linha abaixo da última (já sugerindo o início como "Até" anterior + 1).
- Botão **Salvar descontos** grava a tabela. Validações antes de salvar: início ≤ fim, faixas sem sobreposição, percentuais de 0 a 100.
- Ao abrir, o painel carrega as faixas já salvas desse credor; se não houver nenhuma, mostra as faixas atuais do sistema como ponto de partida.
- Somente administradores podem editar; a última faixa pode ter "Até" vazio, significando "sem limite".

### 3. Aplicação no portal de negociação

- O cliente continua acessando os portais existentes (não haverá página nova para o MMP).
- Ao consultar o CPF, o portal identifica o credor com **maior valor em aberto** entre os débitos do cliente e usa a tabela de descontos cadastrada para esse credor.
- Se esse credor não tiver tabela cadastrada, continuam valendo as regras atuais do sistema, sem mudança.
- O desconto escolhido reflete em tudo que já existe: cartões de desconto à vista/parcelado, simulação de parcelas, mínimo de R$ 100 por parcela, prazo de 10 dias para o primeiro pagamento e mensagem enviada ao WhatsApp.

## Detalhes técnicos

- Nova tabela `credor_desconto_faixas`: `credor` (texto normalizado), `dias_de`, `dias_ate` (nulo = sem limite), `desc_avista`, `desc_parcelado`, `created_at`, `updated_at`, com índice por credor. GRANT de leitura para `anon` e `authenticated` (o portal é público) e escrita restrita a admin via política usando `has_role(auth.uid(), 'admin')`; `service_role` com acesso total.
- `src/lib/descontoPortal.ts`: manter as regras atuais como fallback e adicionar `getDescontoComFaixas(dias, modalidade, faixas)` que resolve a faixa aplicável.
- `ConsultaResultado.tsx`: buscar as faixas do credor predominante (soma de `valor_atualizado`/`valor_original` por credor a partir do retorno de `consultar_debitos_por_cpf`) e repassar as faixas ao `DiscountTierSelector` e aos cálculos de proposta.
- `ImportarDevedores.tsx`: novo valor `mmp_mundo_moda` em `CredorLayout` reaproveitando o parser padrão, entrada em `DESCRICOES`, `CREDORES_OPCOES` com `MMP MUNDO DA MODA`, e novo componente `src/components/portal/DescontosCredorEditor.tsx` com as linhas de faixa, botão de adicionar e salvar.
- Nenhuma alteração nas regras de parcela mínima, prazo do primeiro pagamento ou nos fluxos de outros credores.
