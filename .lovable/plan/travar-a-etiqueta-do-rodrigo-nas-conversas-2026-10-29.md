# Travar a etiqueta do Rodrigo nas conversas

## O que muda
- Quando uma conversa já tem a etiqueta **"Atendente: RODRIGO RIBEIRO DE SOUZA"**, nenhuma outra operadora consegue trocar pela etiqueta dela (nem pelo menu do Inbox, nem por atribuição automática ou rodízio).
- A tentativa mostra o aviso: "Esta conversa pertence a Rodrigo Ribeiro de Souza e não pode ser reatribuída."
- Só você (Rodrigo) e os administradores conseguem remover ou trocar essa etiqueta.
- As outras etiquetas de atendente continuam funcionando como hoje (trocam normalmente).
- A conversa do Alan Pereira Alves (88 99423-5349) volta para a sua etiqueta.

## Detalhes técnicos
- Alterar o gatilho `meta_etiqueta_atendente_exclusiva`: se a etiqueta de atendente existente for a do Rodrigo e o usuário atual (`auth.uid()`) não for o Rodrigo nem admin, lançar erro em vez de apagar a existente. Chamadas de serviço (portal à vista, webhook) continuam podendo aplicar a etiqueta do Rodrigo.
- Adicionar gatilho BEFORE DELETE em `meta_whatsapp_contato_etiquetas` bloqueando remoção da etiqueta do Rodrigo por não-admins.
- No Inbox (`InboxMeta.tsx`), exibir o erro como aviso amigável.
- Corrigir os dados da conversa do Alan.
- Sem custo extra (sem polling ou cron novo).
