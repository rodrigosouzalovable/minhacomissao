# Corrigir o nome no cabeçalho do Inbox Meta

## Objetivo
Exibir no cabeçalho da conversa o nome real recebido do perfil do cliente no WhatsApp, sem transformar textos da conversa em nome.

## Diagnóstico confirmado
- O cabeçalho mostra diretamente o campo `nome` do contato.
- Na conversa da imagem, esse campo foi gravado primeiro como “Tudo Bem” e depois como “Interactive”.
- O IAGO tenta descobrir nomes nas mensagens e pode interpretar frases curtas ou o marcador `[interactive]` como nome, sobrescrevendo o contato.
- O webhook da Meta já recebe o nome oficial em `contacts[].profile.name`, mas hoje ele divide o mesmo campo com nomes inferidos pelo atendimento.

## Implementação
1. **Separar o nome do perfil**
   - Guardar o nome recebido diretamente do perfil do WhatsApp em um campo próprio no contato.
   - Atualizá-lo sempre que uma mensagem recebida trouxer um nome de perfil válido.
   - Não criar novas consultas periódicas nem aumentar o volume de chamadas.

2. **Prioridade no cabeçalho**
   - Mostrar primeiro o nome do perfil do WhatsApp.
   - Usar como alternativas, nesta ordem: nome confirmado do cadastro/cliente, nome do CRM e telefone.
   - Aplicar a mesma prioridade nos cards e demais pontos do Inbox que mostram o contato.

3. **Impedir novas gravações incorretas**
   - Bloquear marcadores técnicos como `Interactive` e respostas comuns como “tudo bem” na identificação automática de nomes.
   - O IAGO poderá salvar um nome informado pelo cliente, mas nunca substituir o nome real vindo do perfil do WhatsApp.

4. **Corrigir a conversa apresentada**
   - Remover o nome incorreto atualmente salvo para o telefone da imagem.
   - Recuperar o nome mais confiável já disponível para essa cliente; quando o próximo evento da Meta chegar, o nome exato do perfil passa a prevalecer automaticamente.

5. **Validação**
   - Testar mensagens comuns, respostas de botão e mensagens interativas para confirmar que não viram nomes.
   - Conferir visualmente o cabeçalho e o card da conversa em desktop e celular.
   - Validar que nomes reais enviados pela Meta continuam sendo atualizados corretamente.

## Detalhes técnicos
A alteração exige um campo separado para preservar a origem do nome e uma atualização no webhook, no atendimento do IAGO e na leitura do Inbox. Será uma alteração leve, sem polling, cron ou custo recorrente adicional.
