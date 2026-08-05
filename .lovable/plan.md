# Aviso de atenção humana da caixa IA não chega no WhatsApp

## O que foi verificado

- A conversa do teste ficou corretamente marcada como "aguardando humano" (CPF 074.606.402-04, etapa `aguardando_humano`), ou seja, a IA **decidiu** chamar o humano.
- Os dois contatos de emergência estão cadastrados e ativos (Admin 62991672674 e Anna Flavia 6484480875).
- A função que a IA usa hoje para o aviso (`send-whatsapp`, com a instância global de secrets) **não registrou nenhuma execução** — o aviso morre em silêncio, porque o erro é apenas capturado e escrito no console.
- Em contrapartida, o caminho usado pelas outras notificações do sistema (round-robin entre as instâncias conectadas, com log em `admin_notificacoes_log`) enviou mensagens com sucesso hoje às 22:05 e 22:14. Esse caminho é o confiável.

Conclusão: o problema é o meio de envio do aviso, não a lógica da IA.

## Correção

1. Trocar o envio do aviso de emergência da IA para o mesmo motor confiável já usado nas notificações do sistema: percorre as instâncias ativas, testa quais estão conectadas e tenta uma a uma até enviar de verdade.
2. Enviar para **todos** os contatos de emergência ativos (não só o número do admin), com o texto: cliente, telefone, CPF, caixa de mensagens (IA), motivo (já possui acordo / aceitou proposta / dúvida / CPF não identificado) e atendente que lançou o acordo.
3. Registrar cada aviso (enviado ou com erro, com o detalhe do erro) no log de notificações, para nunca mais falhar silenciosamente.
4. Se nenhuma instância conseguir enviar, a IA registra o erro e mantém a conversa marcada como "aguardando humano" (nada é perdido).

## No painel "Configurar IA da caixa"

- Na aba **Emergência**: botão **"Enviar aviso de teste"** para conferir na hora se a mensagem chega nos números cadastrados.
- Mostrar o status do último aviso disparado (enviado/erro e horário), para diagnóstico rápido.

## Reenvio do caso atual

Disparar manualmente o aviso pendente do cliente do teste (Rodrigo / CPF 074.606.402-04) para os dois números, para você confirmar o recebimento.

## Detalhes técnicos

- `supabase/functions/meta-ia-atendimento/index.ts`: substituir `avisarEmergencia` (que invocava `send-whatsapp`) por uma chamada ao helper compartilhado `_shared/notificar-admin.ts`, generalizado para aceitar uma lista de destinatários (`meta_ia_contatos_emergencia`) em vez de somente `admin_notificacoes_config.admin_phone`, mantendo round-robin, checagem de conexão, retry e gravação em `admin_notificacoes_log` (`tipo = 'ia_humano'`).
- Nova rota de teste em `notificar-admin` (`tipo = 'ia_teste'`) usada pelo botão do painel.
- `src/components/inbox/meta/MetaIAConfigDialog.tsx`: botão de teste + leitura do último registro de `admin_notificacoes_log` com `tipo = 'ia_humano'`.
- Sem cron novo, sem polling novo — custo inalterado.
