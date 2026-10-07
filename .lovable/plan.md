# Preenchimento de todas as variáveis no Inbox Meta

## Diagnóstico confirmado
- A janela **Reabrir com template UTILITY**, mostrada na imagem, exibe apenas “Nome do cliente” e não envia valores individuais para as outras variáveis. A prévia usa esse mesmo nome como substituição padrão, podendo dar a impressão de que tudo está preenchido.
- A janela **Nova conversa Meta** já tem campos separados para variáveis do texto e do cabeçalho. O envio atual aceita esses valores individualmente.

## Alteração proposta
1. Ao selecionar um template no Inbox Meta, mostrar um campo para **cada variável exigida**, tanto no texto quanto no cabeçalho. Identificar os campos pelo marcador (`{{1}}`, `{{2}}` ou nome da variável) e pelo significado cadastrado, quando disponível.
2. Não repetir campos para uma variável que aparece várias vezes no mesmo texto. Manter separados os campos do cabeçalho e da mensagem, mesmo que ambos sejam `{{1}}`.
3. Sugerir o nome conhecido somente quando a variável corresponder ao nome do cliente; deixar as demais disponíveis para preenchimento, sem inventar CPF, valor, vencimento ou outras informações.
4. Atualizar a prévia com os valores digitados. Campos vazios continuam aparecendo como marcadores, nunca substituídos automaticamente pelo nome do cliente.
5. **Bloquear o envio enquanto houver variável obrigatória vazia**, inclusive valores contendo somente espaços. Ao trocar de template, limpar valores do template anterior para evitar informações incorretas.
6. Quando houver botão com URL dinâmica, exibir também o campo de link, com o destino salvo como sugestão editável. Validar o endereço antes do envio, preservando as regras atuais de destino exato. Botões com URL estática permanecem inalterados.
7. Aplicar o mesmo comportamento à reabertura e ao início de uma conversa, mantendo os templates Utility aprovados e as permissões atuais. Não alterar campanhas, modelos cadastrados, destinatários ou regras de bloqueio da Meta.

## Detalhes técnicos
- Reutilizar a identificação de variáveis hoje existente em `MetaNovaConversaDialog` em uma função comum aos dois diálogos.
- Identificar variáveis numéricas e nomeadas usando o texto cadastrado e os componentes do template; ordenar parâmetros numéricos corretamente e separar valores por seção.
- Enviar os valores explicitamente por `cliente.vars`, `cliente.header_vars` e o link por `cliente.button_url`, já aceitos por `send-whatsapp-meta`.
- Reutilizar `TemplateWhatsAppPreview` com valores individuais e preservação dos marcadores vazios.
- Manter a mudança no formulário e nas funções auxiliares do frontend, sem novas rotinas periódicas, consultas adicionais ou alteração das regras de envio no servidor.

## Validação
- Adicionar testes para templates sem variável, com uma variável, com várias variáveis numéricas ou nomeadas, marcadores repetidos e cabeçalho/texto com a mesma numeração.
- Testar obrigatoriedade de todos os valores, limpeza ao trocar de template, separação dos parâmetros e validação de URL dinâmica.
- Conferir visualmente os dois diálogos e o conteúdo preparado para envio, sem enviar mensagens reais a clientes.
