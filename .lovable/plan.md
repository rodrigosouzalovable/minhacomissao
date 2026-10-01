# Corrigir envio obrigatório do termo pela conversa do cliente

## Resultado esperado

O diálogo de emissão sempre tentará localizar a conversa Meta Oficial correspondente ao telefone confirmado do cliente, mesmo quando o acordo foi iniciado fora da Inbox.

- Se o acordo veio da Inbox, manter a conversa usada na negociação selecionada automaticamente.
- Se veio de outra tela, procurar as conversas acessíveis pelos últimos 8 dígitos do telefone confirmado.
- Com uma conversa encontrada, mostrar **Enviar no WhatsApp Oficial** imediatamente.
- Com mais de uma conversa encontrada, permitir escolher a conversa correta antes do envio.
- Sem conversa acessível, informar isso claramente e manter o download como forma obrigatória de conclusão.

## Correção

- Centralizar no diálogo de emissão a resolução da conversa, usando primeiro o vínculo salvo no acordo e depois a busca segura pelo telefone.
- Aplicar a mesma resolução nos três caminhos: lançamento normal, lançamento administrativo e ficha do devedor.
- Salvar no acordo a conversa e a instância escolhidas quando o termo for enviado.
- Manter a validação de acesso e da janela permitida pelo WhatsApp no envio já existente.
- Ao reabrir um acordo com formalização pendente, repetir a busca pelo telefone caso ainda não exista vínculo salvo.

## Validação

- Testar acordo iniciado dentro da Inbox: botão presente e conversa original preservada.
- Testar acordo iniciado fora da Inbox com uma, várias e nenhuma conversa correspondente.
- Confirmar que o envio chega à conversa escolhida e conclui a formalização.
- Confirmar que falha de envio não conclui o acordo e que o download continua disponível.
- Validar o diálogo em computador e celular e conferir a compilação.

## Detalhes técnicos

- Comparar telefones pelo padrão do projeto: últimos 8 dígitos.
- Consultar somente conversas que as permissões atuais permitem ao usuário visualizar.
- Não criar agendamento, polling, automação ou nova tabela; a busca ocorre apenas ao abrir a emissão.
