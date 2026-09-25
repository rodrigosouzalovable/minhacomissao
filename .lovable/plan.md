# Corrigir “Abrir Conversa” nos retornos agendados

## Diagnóstico confirmado
- O retorno da imagem foi criado em 05/09, antes de os agendamentos guardarem a conversa de origem. Seu vínculo com a conversa está vazio.
- Não há conversa na Inbox Meta para os últimos oito dígitos do telefone desse retorno. Portanto, não existe uma conversa exata para abrir neste caso; criar uma ou escolher outra pelo nome seria arriscado.
- A tentativa atual de buscar esse telefone em toda a lista de conversas ainda terminou por tempo esgotado, e o aviso genérico não explica a situação.

## O que muda
1. **Retornos agendados dentro da Inbox Meta:** manter o vínculo direto da conversa. Ao clicar em **Abrir Conversa**, conferir se ela ainda existe e se o usuário pode acessá-la; só então abrir a conversa exata, inclusive se estiver arquivada ou em outra caixa permitida.
2. **Retornos antigos ou criados fora da Inbox:** não prometer abertura de uma conversa que não foi registrada. Se não houver vínculo confirmado, mostrar uma explicação clara no próprio aviso e oferecer **Ver retorno** para consultar os dados e a observação na página Retornos; manter o número disponível para copiar. Não abrir automaticamente uma conversa parecida.
3. **Falhas e permissões:** se a conversa vinculada foi removida ou não está acessível, manter o aviso aberto e diferenciar indisponibilidade de falha de conexão. Evitar a busca ampla por telefone que hoje expira, sem aumentar consultas periódicas nem alterar permissões.
4. **Validação:** testar um agendamento novo na Inbox (inclusive conversa arquivada/outra caixa), este retorno antigo sem vínculo, e o caso de conversa excluída ou sem acesso. Nenhum retorno será apagado ou concluído automaticamente.

## Detalhes técnicos
- Ajustar `RetornoAlertChecker` para verificar `meta_contato_id` por ID antes de navegar; remover a consulta global por sufixo sem índice adequado. Direcionar registros sem vínculo à página `/retornos`, preservando o contexto do retorno para destacá-lo ali.
- Ajustar `Retornos` apenas para destacar/posicionar o registro vindo do aviso, se necessário. Manter `InboxMeta` usando o ID salvo no agendamento e tratar erros da abertura sem mascará-los como “não encontrado”.
- Sem novo agendamento automático, polling, tabela ou mudança de acesso a dados.
