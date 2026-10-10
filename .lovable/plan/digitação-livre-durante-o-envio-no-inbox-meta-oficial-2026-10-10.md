# Digitação livre durante o envio no Inbox Meta Oficial

## Objetivo
Permitir escrever a próxima mensagem enquanto a anterior é enviada e abrir cada conversa com o cursor já ativo no campo, sem precisar clicar.

## Diagnóstico confirmado
- O Inbox passa o estado de envio para o bloqueio do campo de digitação, impedindo escrever durante a espera.
- O botão de envio do campo não verifica separadamente o estado de envio. Ao liberar a digitação, será necessário bloquear também o envio pelo teclado para evitar perder o novo texto.
- O campo limpa o texto ao trocar de conversa, mas essa troca não ativa seu foco automaticamente.

## Alterações
1. **Manter o campo disponível durante o envio:** retirar a espera de envio do bloqueio de digitação. O texto da próxima mensagem continuará editável e não será apagado quando o envio anterior terminar.
2. **Bloquear apenas o novo envio de texto durante a espera:** desabilitar o botão de enviar e impedir envio por Enter enquanto houver uma mensagem em processamento, preservando o texto digitado. Shift+Enter continuará inserindo uma quebra de linha.
3. **Ativar o cursor automaticamente:** focar o campo ao abrir ou trocar de conversa, assim que ele estiver disponível, sem deslocar a página. Após enviar, manter ou devolver o foco ao campo para continuar digitando.
4. **Preservar as regras existentes:** não liberar texto livre fora da janela de 24 horas nem alterar permissões, anexos, gravação de áudio, templates, etiquetas ou indicadores de não lido. O foco automático não deve roubar o foco de janelas abertas posteriormente.

## Validação
- Abrir uma conversa habilitada e confirmar que é possível digitar imediatamente, sem clicar no campo.
- Simular envio demorado e confirmar que o campo continua editável, o botão fica bloqueado e Enter não envia nem apaga a próxima mensagem.
- Confirmar que a próxima mensagem permanece intacta após sucesso ou falha do envio anterior e pode ser enviada quando a espera termina.
- Trocar de conversa e verificar que o cursor fica ativo no campo correto, preservando a limpeza de texto já existente na troca.
- Confirmar crescimento do campo, respostas rápidas, Shift+Enter e restrição da janela de 24 horas.

## Detalhes técnicos
Alterações limitadas a `src/pages/InboxMeta.tsx` e `src/components/inbox/meta/MetaComposer.tsx`. Separar a disponibilidade do campo do estado de envio; adicionar proteção em `submit` e foco após montagem/troca de `conversationKey` e habilitação do campo. Sem novas consultas, rotinas automáticas ou aumento previsto de custo do Lovable Cloud.