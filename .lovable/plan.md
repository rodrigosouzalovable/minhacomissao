

## Problema identificado

Existem dois controles separados que não estão conectados:

1. **Toggle na aba Usuários** (`whatsapp_lembretes_habilitado` na tabela `profiles`) — controla apenas o envio de **lembretes de pagamento**
2. **Toggle na aba Robô CobMais** (`chatbot_config.ativo`) — controla as **respostas automáticas do chatbot**

Quando você desativa o WhatsApp na aba Usuários, isso só desliga os lembretes. O chatbot continua respondendo porque verifica apenas a tabela `chatbot_config`.

## Solução

Unificar a verificação: o chatbot WhatsApp deve respeitar **ambos** os controles. Se o toggle global do chatbot (`chatbot_config.ativo`) estiver desativado, o bot não responde. Isso já funciona.

O que falta: o toggle na aba Usuários deve ter um significado mais claro, e o toggle do chatbot na página Robô CobMais deve ser o controle principal.

### Mudanças

| Arquivo | Ação |
|---------|------|
| `src/pages/AdminUsuarios.tsx` | Renomear o label do toggle de WhatsApp para "Lembretes" para ficar claro que controla apenas lembretes, não o chatbot |
| `src/pages/AutomacaoCobMais.tsx` | Garantir que o card do Chatbot tenha descrição clara: "Controla as respostas automáticas do chatbot para todos os clientes" |

Alternativamente, se o que o usuário quer é que o toggle na aba Usuários **também** controle o chatbot globalmente:

### Mudança principal

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-chatbot/index.ts` | Além de verificar `chatbot_config.ativo`, verificar também se o admin (dono da instância UAZAPI) tem `whatsapp_lembretes_habilitado = true` no perfil. Se o toggle do admin estiver desativado, o chatbot não responde. |

Isso significa que:
- Toggle do **admin na aba Usuários** OFF → chatbot para de responder
- Toggle do **Chatbot na aba Robô CobMais** OFF → chatbot para de responder
- Ambos precisam estar ON para o chatbot funcionar

### Detalhes técnicos

No `whatsapp-chatbot/index.ts`, após verificar `chatbot_config.ativo`, adicionar uma consulta ao perfil do admin que possui a instância UAZAPI sendo usada. Se esse admin tiver `whatsapp_lembretes_habilitado = false`, ignorar a mensagem.

