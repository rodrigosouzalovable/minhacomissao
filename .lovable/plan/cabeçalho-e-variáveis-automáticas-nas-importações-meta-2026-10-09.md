# Cabeçalho e variáveis automáticas nas importações Meta

## Resultado esperado
Ao importar uma planilha com a primeira linha **Telefone | {{1}} | {{2}}**, reconhecer essa linha como cabeçalho e preencher automaticamente a ligação de cada coluna com a variável correspondente, nas áreas **Contatos Novo Mundo** e **Envio Meta**.

## O que foi conferido
- Novo Mundo já reconhece o cabeçalho `Telefone | {{1}} | {{2}}` e lê A como telefone, B como variável 1 e C como variável 2. Porém, a conferência mostra títulos fixos, sem exibir o cabeçalho lido do arquivo.
- Envio Meta reconhece títulos numerados como cabeçalho, mas o mapeamento automático das colunas não identifica `{{1}}` e `{{2}}` como variáveis do template.
- A imagem mostra dados em B e C; ela não comprova troca entre as variáveis. O ajuste preservará os textos dessas células, sem inventar ou substituir valores.

## 1. Contatos Novo Mundo
- Ler a primeira linha em cada nova importação e apresentar o cabeçalho reconhecido na conferência: **A · Telefone**, **B · {{1}}**, **C · {{2}}**.
- Deixar visível a correspondência com o template `fins_de_atualizacao_cadastral`: B → {{1}} e C → {{2}}.
- Preservar literalmente o conteúdo de B e C para cada contato; cabeçalho não vira destinatário nem valor de variável.
- Se o cabeçalho declarar uma correspondência incompatível ou duplicada, pedir revisão antes de confirmar, sem interpretar silenciosamente.
- Sem cabeçalho, continuar utilizando A/B/C e incluir o primeiro contato.

## 2. Envio Meta
- Ao reconhecer cabeçalho, selecionar automaticamente **Telefone**, **Variável {{1}}**, **Variável {{2}}** e demais variáveis numeradas existentes no template escolhido.
- Dar prioridade às variáveis explicitamente identificadas no cabeçalho, sem substituir essas escolhas por sugestões baseadas nos valores das células.
- Manter a conferência e a possibilidade de ajustar o mapeamento antes de concluir.
- Quando o cabeçalho apontar variável inexistente no template, repetida ou faltar uma variável obrigatória, mostrar a pendência para correção; não adivinhar.
- Preservar a opção de informar se a primeira linha é cabeçalho. Quando não for, o primeiro cliente continua participando da importação.

## Limites preservados
- Não mudar regras de duplicidade por sufixo, blacklist, autorização, estoque ou envio.
- Não reimportar lotes já salvos nem alterar mensagens anteriores.
- Não iniciar mensagens, ativar a base, elevar limites ou adicionar consultas recorrentes.

## Detalhes técnicos
- Extrair a identificação de colunas por cabeçalho para uma função testável, reconhecendo títulos exatos `{{n}}` e também `Variável n`.
- Ajustar `MapearColunasImportDialog.tsx` para preencher `tplvar:n` somente quando a variável existir no template selecionado.
- Transportar os títulos identificados para a prévia de `NovoMundoContatosCard.tsx`, mantendo os dados de contatos enviados à importação no formato atual.
- Reutilizar a detecção de cabeçalho existente, sem migrações ou mudanças no mecanismo de disparos.

## Validação
- Testar `Telefone | {{1}} | {{2}}`: cabeçalho excluído dos dados, telefone correto e B/C ligados às variáveis corretas.
- Testar variáveis adicionais, títulos com espaços, variável duplicada e variável ausente no template.
- Testar arquivo sem cabeçalho: primeiro cliente preservado.
- Conferir as duas telas com valores distintos em B e C e confirmar que a prévia corresponde à planilha, sem salvar lote ou enviar WhatsApp real.