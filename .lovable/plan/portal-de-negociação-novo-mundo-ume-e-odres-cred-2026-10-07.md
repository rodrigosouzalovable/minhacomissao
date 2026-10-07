# Portal de negociação — Novo Mundo, UME e Odres Cred

## Objetivo

Transformar a página inicial em um portal da **Souza e Ribeiro Advogados**, onde o cliente consulta seu CPF e encontra suas dívidas organizadas por **Novo Mundo, UME e Odres Cred**, sem misturar valores, contratos ou condições de negociação.

### Decisões confirmadas

| Credor | Pagamento à vista | Parcelamento |
|---|---|---|
| **Novo Mundo** | Manter os descontos atuais | Manter as condições atuais da carteira |
| **UME** | Principal sem juros, sem desconto adicional | Principal + 10%, até 18 parcelas, nenhuma abaixo de R$ 100 |
| **Odres Cred** | Principal sem juros, sem desconto adicional | Principal + 10%, até 18 parcelas, nenhuma abaixo de R$ 100 |

A nova regra não altera a calculadora interna, o IAGO, acordos já registrados ou comissões.

## 1. Página inicial: escritório no topo, credores junto da consulta

- Cabeçalho com a marca e o nome **Souza e Ribeiro Advogados**, sem uma marca de credor ao lado.
- Área de consulta com o título **Consulte suas dívidas** e as três marcas, usando as imagens já disponíveis no sistema.
- Um único campo de CPF e o botão **Consultar dívidas**. O cliente não precisa adivinhar em qual carteira está seu débito.
- Hierarquia visual sóbria e legível, com marcas identificáveis e consulta em destaque, sem excesso de chamadas promocionais.
- Ajustar a organização para celular e computador, mantendo visíveis os nomes dos três credores.
- Preservar o favicon e os contatos oficiais já configurados, inclusive os específicos de cada domínio.

### Texto proposto

**Título principal:** “Consulte suas dívidas”

**Texto de apoio:** “Consulte seu CPF e confira débitos de Novo Mundo, UME e Odres Cred atendidos pela Souza e Ribeiro Advogados.”

**Quem somos:** “A Souza e Ribeiro Advogados oferece atendimento para negociação de débitos de Novo Mundo, UME e Odres Cred. Consulte as informações disponíveis da sua carteira e escolha uma condição de pagamento para conversar com nossa equipe.”

Revisar benefícios, perguntas frequentes e rodapé para refletir os três credores. Não prometer desconto universal, retirada imediata de restrições ou prazo de atendimento não confirmado.

## 2. Resultado: uma consulta, carteiras separadas

Após consultar o CPF, apresentar uma área independente para cada credor com dívida localizada:

- Logo e nome do credor em destaque.
- Identificação do cliente, principal disponível e detalhes de contratos/vencimentos fornecidos pela fonte daquela carteira.
- Ações **Ver detalhes** e **Negociar**, sempre vinculadas ao credor escolhido.
- Sem somar dívidas de credores diferentes em uma proposta única.
- Estados claros por carteira: **Débito localizado**, **Nenhum débito localizado** e **Consulta temporariamente indisponível**. Falha de consulta não será apresentada como ausência de dívida.
- Se uma fonte demorar, mostrar os resultados das demais sem obrigar o cliente a esperar tudo.

**Acordos existentes:** mostrar as parcelas do acordo correspondente ao credor, sem oferecer nova negociação sobre o mesmo saldo. Um acordo Novo Mundo não poderá esconder uma dívida UME ou Odres Cred.

## 3. Fontes dos valores

### Novo Mundo

Preservar a consulta dos débitos importados e as condições atuais, separando a carteira das demais.

### UME

Reutilizar a consulta da calculadora interna e o campo **Total sem juros** como principal. O portal exibirá apenas os dados necessários ao cliente, não a resposta completa da ferramenta interna.

Reaproveitar o cache de 12 horas e o limite de espera existentes. Se o principal não estiver disponível, impedir a geração de proposta e oferecer atendimento, sem inventar valores ou substituir silenciosamente por outro saldo.

### Odres Cred

Usar os débitos da carteira identificados no sistema. Antes de liberar a negociação, conferir no importador e em um exemplo validado se **valor original** representa realmente o principal sem juros. Se não representar, ajustar a origem/mapeamento; não calcular propostas sobre uma base incerta.

## 4. Negociação UME e Odres Cred

- **À vista:** exatamente o principal sem juros.
- **Parcelado:** total igual ao principal multiplicado por 1,10.
- Oferecer quantidades de **2 até 18 parcelas**, limitadas pelo valor disponível: máximo = menor entre 18 e a parte inteira de `(principal × 1,10) ÷ 100`.
- Não oferecer parcelamento se não houver pelo menos duas parcelas de R$ 100.
- Mostrar separadamente **Principal**, **Acréscimo de 10%**, **Total parcelado** e **Quantidade/valor das parcelas**.
- Trabalhar em centavos e ajustar eventual diferença de arredondamento na última parcela, preservando o total e o mínimo de R$ 100 em todas.
- Manter a escolha obrigatória da primeira data de pagamento, dentro do limite atual de até 10 dias.
- A nova simulação será sem entrada separada; a primeira prestação integra o parcelamento escolhido. A entrada opcional da Novo Mundo permanece como hoje.

**Exemplo:** principal de **R$ 1.000,00** → à vista **R$ 1.000,00**; parcelado **R$ 1.100,00**, permitindo até **11 parcelas de R$ 100,00**, e não 18 parcelas abaixo do mínimo.

## 5. Pedido pelo WhatsApp

Preservar o encaminhamento para o atendimento oficial, com uma mensagem que identifique:

- Cliente e credor escolhido.
- Contratos ou referência disponíveis naquela fonte.
- Modalidade, principal, acréscimo quando houver, total e parcelas.
- Data do primeiro pagamento.

A simulação não criará automaticamente um acordo, não marcará parcelas como pagas e não desativará contratos. A formalização continuará pelo fluxo atual da equipe.

## 6. Segurança e custo

- Validar CPF e restringir a consulta pública às três carteiras autorizadas e ao contexto do domínio.
- Não abrir acesso público à função interna UME nem devolver telefones, limites de crédito, dados operacionais ou dados de outros clientes.
- Aplicar proteção contra consultas automatizadas abusivas e evitar registrar CPF em diagnósticos públicos.
- Não adicionar consultas periódicas, canais de atualização contínua ou tarefas agendadas: consultar somente por ação do cliente, reaproveitando cache e índices.

**Alerta de custo Lovable Cloud:** disponibilizar a consulta UME ao público pode aumentar o consumo. A estimativa técnica é uma chamada de consulta por pesquisa que solicitar UME; chamadas externas serão reutilizadas pelo cache de 12 horas por CPF. O valor financeiro depende do volume de consultas e não foi apurado. Antes de habilitar essa nova consulta pública, apresentar a estimativa de impacto e obter autorização explícita de custo.

## 7. Validação e entrega

- Testar CPF com uma carteira, com mais de uma carteira, sem dívida e com acordo existente em apenas uma delas.
- Conferir as três fontes com exemplos autorizados, sem enviar mensagens reais.
- Testar principal de R$ 1.000,00, teto de 18 parcelas, valores pequenos, centavos e proibição de parcelas abaixo de R$ 100.
- Garantir que descontos e parcelamentos atuais da Novo Mundo permaneçam intactos.
- Conferir lentidão/falha UME, ausência de principal e mensagem enviada ao WhatsApp.
- Validar apresentação e navegação em celular e computador, sem alterar o favicon.

## Detalhes técnicos

As leituras confirmaram que a tela inicial usa a marca do credor da URL; a consulta de débitos recebe somente CPF; o resultado aplica condições a um saldo agregado; e as consultas de acordos escolhem o acordo mais recente do CPF sem separar credor. A consulta interna UME exige autenticação.

- Adaptar `PortalConsulta`, `ConsultaResultado` e as configurações/marcas para entrada unificada e resultados por carteira.
- Manter os links existentes, inclusive `/novomundo`, funcionando, sem mudar o acesso administrativo nem os portais não envolvidos.
- Criar uma consulta pública controlada que reutilize a lógica UME e retorne um formato mínimo por credor.
- Separar dívidas e acordos no servidor por credor e contexto autorizado; mapear os identificadores históricos das carteiras explicitamente.
- Isolar o cálculo UME/Odres em uma regra testável, aplicada também à validação da proposta, sem modificar as regras internas do IAGO.
- Alterações necessárias de banco seguirão migrações com permissões explícitas e proteção de acesso; reaproveitar índices existentes e criar apenas os necessários após conferir as consultas.

**Entrega:** portal único do escritório, consulta das três carteiras, resultados separados e propostas coerentes com as regras confirmadas, condicionando a liberação UME à autorização de custo e Odres à validação da origem do principal.