# Consulta de dívidas com o visual azul anterior

## Objetivo
Restaurar o visual do resultado antigo da Novo Mundo, conforme a imagem enviada, e mostrar apenas as pendências dos credores vinculados ao CPF consultado.

## 1. Mostrar somente o que o cliente precisa resolver
- Consultar Novo Mundo, UME e Odres Cred e exibir apenas as carteiras com dívida em aberto ou acordo com saldo pendente.
- Ocultar credores sem débito e acordos totalmente quitados, conforme confirmado.
- Dentro de um acordo ainda em andamento, manter as parcelas pagas e pendentes para o cliente acompanhar o histórico daquele acordo.
- Se todos os credores forem consultados com sucesso e não houver pendências, mostrar uma mensagem única de ausência de pendências.
- Uma falha na consulta não será tratada como ausência de dívida: apresentar aviso separado com opção de tentar novamente.

## 2. Recuperar cores e organização do resultado antigo
- Restaurar o fundo azul, textos claros, destaques verdes e sinalização amarela das parcelas pendentes.
- Retomar a saudação com nome do cliente e CPF, o resumo do acordo, os cartões de parcelas com valor e data e o saldo restante.
- Manter a identificação Souza e Ribeiro Advogados no cabeçalho e o contato de atendimento; identificar cada dívida pela logo e pelo nome do credor correspondente.
- Usar a imagem antiga como referência visual, sem inserir a captura de tela na página.
- Não incluir frases de oferta exclusiva ou prazo limitado sem uma condição real que as sustente.

## 3. Separar credores na mesma tela
- Com uma única pendência, mostrar apenas o credor correspondente, sem listar as outras marcas.
- Com pendências em dois ou três credores, mostrar seções distintas, uma abaixo da outra, com identificação clara.
- Cada seção terá seus próprios contratos, parcelas, saldo, opções de negociação e botão de atendimento.
- Não misturar valores, somar saldos entre credores nem permitir que uma escolha de parcelamento altere outra carteira.

## Preservar
- Página inicial e logos já aprovadas.
- Favicon atual.
- Regras atuais de desconto, principal, acréscimo, limites de parcelamento e geração de propostas de cada credor.
- Consultas protegidas e informações financeiras existentes; nenhuma alteração em pagamentos ou acordos cadastrados.
- Nenhum novo agendamento, consulta periódica ou envio automático de WhatsApp.

## Detalhes técnicos
- A tela atual já consulta as três carteiras e renderiza todas, inclusive acordos concluídos. Ajustar a seleção de resultados em `PublicPortalResults` com uma função testável de classificação de pendências.
- Adaptar `PortalWalletSection` para o visual antigo e filtrar acordos quitados antes de decidir entre exibir acordo ou negociação de dívida.
- Tratar acordos sem parcelas suficientes ou dados inconclusivos como situação a conferir, sem afirmar quitação nem oferecer negociação indevida.
- Criar uma variante específica de resultado em `PortalShell` e tokens próprios no CSS, usando `LegacyConsultaResultado` como referência visual, sem reativar suas consultas antigas.
- Atualizar a orientação de apresentação do portal para permitir o tema azul dos resultados sem afetar a página inicial ou outros documentos.

## Validação
- Testar CPF com pendência somente UME, somente Novo Mundo e somente Odres Cred.
- Testar duas e três carteiras pendentes na mesma tela, com saldos e escolhas independentes.
- Testar credor totalmente quitado oculto e acordo ativo com parcelas pagas preservadas.
- Testar acordo quitado e dívida distinta ainda aberta no mesmo credor, para não esconder a pendência real.
- Testar ausência de pendências, carregamento e erro parcial de consulta.
- Conferir o resultado em computador e celular, incluindo nomes longos e parcelas, sem enviar mensagens ou alterar dados reais.