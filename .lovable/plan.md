# Novo Acordo: importar PDF ou print para UME e Odres Cred

## O que será adaptado

1. **Receber PDF e imagem na tela Novo Acordo.** Permitir arrastar o arquivo ou selecioná-lo, mantendo a opção de colar prints. Mostrar o arquivo recebido e permitir removê-lo ou substituí-lo antes da leitura.
2. **Preencher os dados do acordo para revisão:** nome do cliente, CPF, quantidade de parcelas, valor total negociado e o vencimento e valor de cada parcela.
3. **Telefone e dias de atraso serão preenchidos manualmente.** A leitura não usará o telefone de atendimento do rodapé como telefone do cliente e não deduzirá os dias de atraso pelas datas do documento.
4. **O usuário escolherá o credor manualmente:** UME ou Odres Cred, mantendo Novo Mundo disponível no fluxo atual. O PDF anexado não identifica o credor; nenhuma marca será adivinhada.
5. **Conferir antes de salvar.** Mostrar a lista de parcelas preenchidas, com possibilidade de corrigir datas e valores. Importar apenas preenche o formulário; não salva um acordo sozinho.
6. **Preservar as regras atuais:** confirmação obrigatória do telefone, verificação de CPF, responsável pelo acordo, cálculo de comissão e formalização do termo. Não alterar acordos existentes nem desativar contratos ou devedores.

## Resultado esperado com o anexo

- Cliente: **Weriky Jose Soares dos Santos**.
- CPF: **437.307.008-39**.
- **12 parcelas de R$ 101,29**, de **09/10/2026 a 09/09/2027**, conforme cada linha do comprovante.
- Valor do acordo: **R$ 1.215,48**, correspondente ao total das parcelas — não R$ 4.298,69, que é a dívida antes do desconto.
- Telefone e dias de atraso: aguardam preenchimento manual.
- O número **(11) 4020-4045** do rodapé não será usado como telefone do cliente.

## Detalhes técnicos

- Atualmente, `ImageDataExtractor.tsx` aceita apenas imagens e `extract-acordo-data` retorna uma data inicial e valores resumidos. `NovoAcordo.tsx` gera as parcelas a partir desses resumos. Adaptar esse fluxo para também receber a lista individual de parcelas, preservando exatamente as datas e os valores do documento.
- Ler PDFs com texto no navegador usando uma biblioteca de PDF, com interpretação estruturada do comprovante anexado. Para prints, reutilizar a extração por IA existente, acrescentando a lista de parcelas e as distinções entre dívida original, desconto e total negociado.
- Para PDF digitalizado ou formato não reconhecido, mostrar uma orientação clara para enviar um print; não preencher dados incertos nem salvar silenciosamente uma leitura incompleta.
- Validar CPF, datas, valores positivos, quantidade de parcelas e soma em centavos. Datas abreviadas como `09/01/27` devem virar `2027-01-09`, sem deslocamento de dia por fuso horário.
- Manter a geração atual de parcelas para preenchimento manual e prints que apresentem apenas um resumo; usar as linhas importadas quando existir uma tabela completa. Alterações manuais devem manter a lista e os totais coerentes.
- Não acrescentar agenda, consultas periódicas, novas tabelas ou pesquisas externas pelo CPF. PDFs com texto serão lidos localmente, sem chamada adicional de IA; prints continuam usando a chamada existente.

## Validação

- Testar os valores concretos do anexo: 12 parcelas, R$ 101,29 cada, total R$ 1.215,48 e todos os vencimentos de outubro/2026 a setembro/2027.
- Testar exclusão do telefone do rodapé, telefone e atraso manuais, credor não inferido, datas com ano abreviado e parcelas de valores diferentes.
- Testar erro de leitura, arquivo inválido e soma divergente sem criação de acordo.
- Conferir no navegador o upload, o arrastar e soltar, o preenchimento para revisão e a continuidade do fluxo de prints, sem cadastrar acordo real durante os testes.