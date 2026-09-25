# Abrir a conversa original pelo lembrete de retorno

## Resultado esperado
- No aviso “Retorno Agendado!”, incluir **Abrir conversa** ao lado das ações existentes.
- Ao clicar, fechar o aviso e abrir diretamente a conversa da Inbox Meta Oficial em que o retorno foi agendado, na caixa e no número da instância corretos, sem marcar o retorno como concluído.

## Como implementar
- Associar cada novo retorno agendado na Inbox ao identificador da conversa Meta original. Preservar os dados atuais do retorno e o funcionamento dos botões “Entendido” e “Marcar como concluído”.
- Usar o link direto já aceito pela Inbox (`contato`) para selecionar a conversa exata e sua caixa, inclusive quando ela não está entre as primeiras conversas carregadas.
- Para lembretes antigos, que só guardam telefone e não identificam a conversa, procurar uma correspondência acessível ao usuário: abrir somente quando houver uma única conversa correspondente; se houver várias instâncias/conversas possíveis, não escolher arbitrariamente — informar que não foi possível identificar a conversa original.
- Tratar conversa excluída ou sem acesso com aviso claro; não alterar a situação do retorno nem transferir a conversa de caixa.

## Detalhes técnicos e validação
- Adicionar referência opcional à conversa em `retornos` com migração segura para os registros existentes, mantendo as permissões já aplicadas.
- Passar o ID do contato selecionado ao agendamento, lê-lo no aviso e navegar para a Inbox pelo ID; manter um fallback restrito a correspondência única para dados antigos.
- Conferir o fluxo com conversa existente em outra caixa, mais de uma conversa para o mesmo telefone, retorno antigo sem vínculo e fechamento do aviso; verificar erros da aplicação sem disparar mensagens.
