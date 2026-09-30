# Ações rápidas no menu da conversa — Inbox Meta Oficial

## O que muda

Ao clicar com o botão direito em qualquer card de conversa, o menu passa a incluir:

- **Não precisa de resposta**: interrompe imediatamente o alerta amarelo/vermelho daquele card. Se já estiver marcado, aparece **Voltar a exigir resposta** para desfazer.
- **Qualificar conversa**: abre a mesma janela de qualificação já usada no cabeçalho, mas aplicada diretamente ao card clicado.

As duas ações respeitam a configuração da caixa: qualificação só aparece onde estiver ativada, e a dispensa de resposta só aparece onde o alerta de espera estiver ativado.

## Comportamento

- Não será necessário abrir a conversa antes de usar as ações.
- A dispensa continuará valendo somente para a última mensagem recebida; uma nova mensagem do cliente reativa a contagem automaticamente.
- Ao marcar ou desmarcar pelo menu, a aparência do card será atualizada na hora e continuará sincronizada com o botão do cabeçalho.
- Ao qualificar pelo menu, a qualificação exibida e os filtros serão atualizados como já ocorre pelo cabeçalho.

## Detalhes técnicos

- Ampliar o menu de contexto da conversa para receber o estado e os comandos das duas ações.
- Guardar separadamente qual card solicitou a janela de qualificação, evitando depender da conversa atualmente aberta.
- Reutilizar a gravação e a janela existentes; não criar nova tabela, consulta periódica, automação ou custo adicional.
- Validar o menu, a atualização visual do card e a qualificação em conversa aberta e não aberta.
