# Enviar termo de acordo direto na conversa (diálogo "+" do Inbox Meta)

## O que muda
Depois de clicar em **Salvar acordo** no diálogo "Lançar acordo desta negociação", aparece o botão **Enviar termo de acordo na conversa**.

- Ao clicar, o sistema gera o PDF do termo com as parcelas recém-salvas e o envia na própria conversa aberta (mesmo número/instância da negociação).
- Também fica disponível **Baixar termo** como alternativa.
- O acordo passa a constar como formalizado (enviado ou baixado), igual ao fluxo da tela Novo Acordo.
- Se a janela de 24h do WhatsApp estiver fechada ou o envio falhar, aparece o aviso e o download continua disponível; o acordo não é marcado como concluído.
- Substitui a mensagem atual "Envie o termo de formalização pela tela do acordo para concluir".

## Detalhes técnicos
- Em `LancarAcordoConversa.tsx`, após salvar, buscar o acordo e os pagamentos criados e abrir o `FormalizarTermoDialog` já existente, passando `metaOrigem` com contato e instância da conversa atual (novas props vindas de `LancarAcordoDialog`/`InboxMeta.tsx`).
- Reutiliza geração de PDF, upload privado e envio de mídia Meta já existentes, com as mesmas validações de acesso.
- Sem nova tabela, cron ou polling; custo desprezível.
