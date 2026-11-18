# Etiquetas e idioma para clientes USA B2B

## O que muda
1. **Etiquetas**: o cliente USA passa a ver só as etiquetas que ele mesmo criou. Somem ACORDO FECHADO, UME, ODRES, NOVO MUNDO e as demais da empresa. Isso vale na lista do filtro, nas etiquetas dentro da conversa e também no servidor, para que as da empresa não cheguem até ele.
2. **Idioma**: o quadro de etiquetas passa para o idioma escolhido: "Labels", "Create label", "Label settings", "Cancel", "Save" e similares. A janela de criar etiqueta também.

A equipe continua vendo tudo como hoje.

## Detalhes técnicos
- `InboxMeta.tsx`: em `fetchEtiquetas`, para cliente USA, buscar `meta_whatsapp_etiquetas` com `user_id = user.id` (ignorando a RPC da caixa); filtrar também a lista usada nas etiquetas exibidas no card da conversa.
- Migração: policy/RPC `meta_etiquetas_da_caixa` e SELECT em `meta_whatsapp_etiquetas` restritos a `user_id = auth.uid()` quando o usuário tiver `cliente_usa_config.usa_b2b = true`.
- `useClienteUsaLang`: adicionar os textos do quadro e da janela de etiquetas; trocar textos fixos por `tr(...)`.
