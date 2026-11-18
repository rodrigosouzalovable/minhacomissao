# Cliente de teste USA: sistema em inglês, caixa pronta e IA no idioma escolhido

## O que muda para o cliente
1. **Sistema inteiro em inglês (ou no idioma escolhido)** – o idioma escolhido no AI Assistant (EN/ES/PT) passa a valer para tudo que o cliente de teste vê: menu lateral (My Account, Conversations, AI Assistant), botão Sair, tela Minha Conta e a tela de conversas (filtros, busca, abas, botões, avisos, campo de mensagem). O idioma fica salvo na conta dele (não só no navegador), então vale em qualquer computador. Funcionários e você continuam em português.
2. **Caixa de mensagens já criada** – ao marcar o usuário como USA B2B/USUÁRIO TESTE, o sistema cria automaticamente uma caixa própria dele (ex.: "Minha caixa – nome do cliente") e o coloca como membro. Some o aviso "Sem caixa de mensagens atribuída". Para o testerodrigo já criado, a caixa é criada na hora da implantação. As conversas do WhatsApp que ele conectar pelo QR Code passam a cair nessa caixa.
3. **IA responde no idioma escolhido** – o idioma escolhido no AI Assistant vira o padrão da resposta: escolheu English, a IA responde sempre em inglês; Español, em espanhol; Português, em português. A opção "Same as the customer" continua disponível. O teste de IA da própria tela segue a mesma regra.

## Detalhes técnicos
- `cliente_usa_config.idioma_interface` (en/es/pt, padrão en); ClienteUsa grava nela ao trocar idioma; o seletor "Reply language" acompanha o idioma escolhido por padrão.
- Dicionário leve `src/lib/clienteUsaI18n.ts` + hook `useClienteUsaLang`; aplicado só quando o usuário é cliente USA (AppSidebar, Conta, InboxMeta e MetaComposer nos textos visíveis ao cliente). Sem biblioteca nova.
- `admin_definir_cliente_usa`: cria `meta_inbox_folders` do usuário e `meta_inbox_folder_members` de forma idempotente; migration faz backfill para clientes USA existentes. Ligação da instância UAZAPI do cliente com essa caixa via `definir_uazapi_inbox_meta` após conectar o QR.
- `_shared/cliente-usa-ia.ts`: instrução de idioma reforçada ("Always reply in English…") quando idioma ≠ auto; `whatsapp-chatbot` e `cliente-usa-ia` já passam `cfg.idioma`.
- Sem novo cron, polling ou consulta pesada (sem aumento de custo).

## Verificação
Entrar como usuário de teste: menu e Inbox em inglês, caixa visível, e teste da IA respondendo em inglês a uma mensagem em português.
