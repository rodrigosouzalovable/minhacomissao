# Ajustes no Inbox para clientes USA B2B

Vale só para quem tem o botão USA B2B ativado. A equipe continua vendo tudo como hoje.

## O que muda para o cliente USA
1. **Filtro "Todos"**: mostra apenas os números de WhatsApp da própria conta do cliente (hoje aparecem 217 números da empresa). Sem número conectado, a lista fica vazia.
2. **Filtrar por etiqueta**: some toda etiqueta de atendente (as que começam com "Atendente:"). Ficam só as etiquetas comuns.
3. **Sino "Notificações de consulta de CPF"**: removido.
4. **Botão "Meus Clientes"**: removido.

## Proteção extra
Além de esconder na tela, a lista de números enviada pelo sistema para um cliente USA passa a conter só os números dele. Assim ninguém vê os números da empresa mesmo mexendo no navegador.

## Detalhes técnicos
- `InboxMeta.tsx`: usar `lang !== null` de `useClienteUsaLang` como sinal de cliente USA; filtrar `instancias` por `user_id === user.id`; filtrar etiquetas `/^atendente:/i`; não renderizar `NotificacoesCpfBell` nem o botão Meus Clientes.
- Migração: na RPC `get_meta_whatsapp_active_instances_for_sending`, quando o usuário tiver `cliente_usa_config.usa_b2b = true`, retornar só instâncias com `user_id = auth.uid()`.
- Teste do filtro de etiquetas de atendente.
