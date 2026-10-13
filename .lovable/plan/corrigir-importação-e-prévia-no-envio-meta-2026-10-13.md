# Corrigir importação e prévia no Envio Meta

## O que foi conferido
- `teste_stela.xlsx` contém **99 clientes**, mais o cabeçalho: **Telefone | {{1}} | {{2}} | {{3}} | {{4}}**.
- A coluna **{{3}}** contém textos com várias linhas em todos os 99 clientes. A importação junta as células com vírgulas e depois a tela separa o conteúdo por quebras de linha. Isso transforma partes da mesma mensagem em linhas extras na tabela de destinatários.
- A prévia dentro da importação já utiliza a primeira linha de dados. Entretanto, a prévia principal da mensagem não recebe os valores importados, e por isso continua mostrando o exemplo “Rodrigo”.
- A janela de importação limita a altura da tabela, mas não da janela inteira. Com uma mensagem longa, o botão **Confirmar e importar** pode ficar fora da área visível.

## 1. Rolagem na janela de importação
- Limitar a janela à altura disponível da tela.
- Colocar uma barra vertical visível do lado direito para rolar o conteúdo, inclusive a prévia longa e o mapeamento.
- Manter o título e os botões **Cancelar** e **Confirmar e importar** fora da área rolável, sempre acessíveis.
- Preservar a rolagem horizontal da tabela para acessar todas as colunas.

## 2. Cada cliente em uma única linha
- Preservar cada registro e cada célula da planilha, sem transformar quebras de linha, vírgulas, ponto e vírgula ou aspas em novos clientes ou novas colunas.
- Mostrar a correspondência explícita:
  - **A → Telefone**
  - **B → {{1}}**, nome do cliente
  - **C → {{2}}**, texto de atualização
  - **D → {{3}}**, benefícios e pergunta, com todas as quebras de linha
  - **E → {{4}}**, telefone informado na mensagem
- Na tabela de destinatários, apresentar textos longos com quebra dentro da própria célula e cabeçalhos claros, sem cortar tudo em uma linha.
- Usar os papéis escolhidos no mapeamento para separar dados do cliente e variáveis: o texto de {{2}} não deve ser interpretado como CPF, nem {{3}} como atraso.
- Preservar as regras atuais de telefones válidos, duplicidade e blacklist. O arquivo tem 99 registros antes desses filtros; qualquer remoção legítima continuará sendo informada.

## 3. Prévia automática da mensagem
- Após confirmar a importação, preencher a prévia principal com as variáveis do primeiro destinatário mantido na lista.
- Neste arquivo, se o primeiro cliente não for removido pelos filtros, mostrar **Edson**, o texto de C, os benefícios completos de D e **(62) 98274-9908** em {{4}}.
- Preservar a imagem escolhida para a campanha e os botões do template.
- Continuar atualizando a prévia dentro da janela quando o usuário mudar o mapeamento ou formato de uma coluna.
- Variáveis sem valor devem permanecer identificadas, sem substituir tudo por “Rodrigo”. Ao trocar de template ou limpar a lista, evitar exemplos herdados indevidamente da importação anterior.
- Não modificar o texto fixo aprovado pela Meta; apenas preencher as variáveis para conferência.

## Detalhes técnicos
- Ajustar `MapearColunasImportDialog.tsx` com altura limitada e área de rolagem do projeto.
- Manter registros estruturados como fonte da importação em `EnvioMeta.tsx`, incluindo os papéis das colunas, campos padrão e variáveis. Evitar reconstruir registros dividindo textos livres por vírgula ou quebra de linha.
- Adaptar os consumidores da lista — contagem, tabela, deduplicação, filtros, validação, exportação e montagem dos destinatários — para preservar os mesmos registros. Se houver conversão para o modo texto, usar codificação e leitura que preservem células multilinha, mantendo compatibilidade com a digitação manual existente.
- Passar as variáveis do primeiro destinatário à `TemplateWhatsAppPreview`, reutilizando os parâmetros que ela já oferece.
- Registrar a decisão estrutural em `AGENTS.md` durante a implementação.
- Sem novas rotinas automáticas, consultas recorrentes, migrações ou alteração das regras de envio.

## Validação
- Testar 99 registros com as cinco colunas do arquivo, garantindo que as quebras de linha de D não gerem destinatários extras.
- Testar preservação de textos com vírgulas, ponto e vírgula, aspas, linhas vazias internas e emojis.
- Testar que as variáveis não preencham indevidamente CPF, atraso ou saldo; que o primeiro cliente seja preservado em arquivos sem cabeçalho; e que filtros removam somente os registros correspondentes.
- Conferir no navegador a importação do arquivo enviado, a rolagem até os botões, as cinco colunas e a prévia principal com os valores importados.
- Conferir compatibilidade com editar como texto e exportar os contatos, sem enviar mensagens reais nem iniciar campanha.