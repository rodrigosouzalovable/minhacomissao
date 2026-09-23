# Envio de template Meta pelos cards de acordos

## Objetivo
Transformar o botão de WhatsApp de cada cliente em um atalho para o envio oficial da Meta, tanto em **Meus Acordos** quanto em **Acordos da Equipe**.

## Implementação

1. **Reutilizar o diálogo “Nova conversa Meta”**
   - Abrir o mesmo fluxo de seleção de template usado hoje na Inbox Meta Oficial.
   - Preencher automaticamente o telefone e o nome do cliente do card, mantendo ambos editáveis antes do envio.
   - Manter pesquisa, favoritos, pré-visualização e preenchimento obrigatório das variáveis do template.
   - Exibir somente as instâncias que possuem o template escolhido aprovado, permitindo ao usuário selecionar qual número fará o envio.

2. **Atualizar “Meus Acordos”**
   - Trocar o comportamento atual do botão, que hoje envia um lembrete pela integração UAZAPI, pelo diálogo de template da API Oficial Meta.
   - Disponibilizar a ação nos cards que o usuário já pode operar e bloquear o botão quando o cliente não possuir telefone.
   - Remover desse envio individual os estados e consultas exclusivos do antigo diálogo UAZAPI que deixarem de ser necessários, sem alterar os disparos em lote existentes.

3. **Adicionar o mesmo fluxo em “Acordos da Equipe”**
   - Incluir o botão de WhatsApp em cada card da equipe.
   - Impedir que o clique abra os detalhes do acordo.
   - Usar o nome e o telefone daquele cliente como dados iniciais do diálogo.
   - Respeitar o acesso já existente à página para administradores, gestores e usuários autorizados.

4. **Garantir o registro na caixa padrão**
   - Enviar com a caixa explicitamente definida como padrão, independentemente da última caixa visitada na Inbox.
   - Reutilizar o envio oficial atual, que registra a mensagem enviada e cria ou atualiza o contato na Inbox Meta.
   - Preservar o vínculo pelo número selecionado, a identificação do atendente e a normalização do telefone.

## Detalhes técnicos
- Estender `MetaNovaConversaDialog` com valores iniciais opcionais de telefone e nome, sincronizados a cada abertura.
- Carregar as instâncias Meta disponíveis pelo mesmo procedimento usado pela Inbox Meta Oficial.
- Reutilizar `TemplateFavoriteSelect`, a paginação completa de templates e `send-whatsapp-meta`; não criar nova tabela nem nova função.
- Passar `folder_id` nulo para que o contato e a mensagem fiquem na caixa padrão.

## Validação
- Testar um card em **Meus Acordos** e outro em **Acordos da Equipe**.
- Confirmar preenchimento automático de nome/telefone, busca e favorito, variáveis, troca de instância e pré-visualização.
- Confirmar envio somente após preencher os campos obrigatórios.
- Confirmar que a conversa e a mensagem enviada aparecem na caixa padrão da Inbox Meta Oficial.
- Verificar que o botão não navega para os detalhes do acordo e que os demais controles dos cards continuam funcionando.
