
# Sistema de multiplas mensagens com rotacao automatica

## O que muda

### Card "Mensagens" (antes "Mensagem Padrao")
- Renomear titulo do card de "Mensagem Padrao" para "Mensagens"
- Renomear botao de "Salvar mensagem padrao" para "Salvar mensagem"
- Ao clicar em "Salvar mensagem", a mensagem e adicionada a uma lista de mensagens salvas e o campo de texto e limpo
- Abaixo do botao, exibir a lista de mensagens salvas, cada uma com um botao de lixeira para excluir
- As mensagens salvas sao persistidas no `localStorage` (nova chave `acionamento_mensagens_salvas`)

### Envio com rotacao automatica
- Ao clicar no botao WhatsApp de um cliente, o sistema escolhe automaticamente uma das mensagens salvas
- A mensagem escolhida nunca e a mesma que foi usada no envio imediatamente anterior
- Logica: manter um estado `lastUsedIndex` e selecionar aleatoriamente entre as demais mensagens

## Detalhes tecnicos (arquivo `src/pages/Acionamento.tsx`)

- Novo estado `mensagensSalvas: string[]` carregado do localStorage
- Novo estado `lastUsedMsgIndex: number | null` para controlar rotacao
- Constante `MENSAGENS_KEY = 'acionamento_mensagens_salvas'`
- Funcao `handleSaveMessage`: adiciona `mensagem` ao array, limpa o textarea, salva no localStorage
- Funcao `handleDeleteMessage(index)`: remove mensagem do array, salva no localStorage
- No `handleSend`: seleciona uma mensagem aleatoria diferente da ultima usada, substitui variaveis e envia
- Remover a chave antiga `STORAGE_KEY` (mensagem padrao unica) ou migrar o valor existente como primeira mensagem salva
- Lista de mensagens salvas renderizada como cards compactos com texto truncado e botao Trash2
