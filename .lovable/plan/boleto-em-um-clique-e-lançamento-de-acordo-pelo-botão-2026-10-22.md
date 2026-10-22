# Boleto em um clique e lançamento de acordo pelo botão "+"

## O que muda

1. **Depois de efetivar o acordo na UME** (tela "Gerar acordo UME"):
   - Os dois botões ("Gerar boleto + PIX da 1ª parcela" e "Enviar na conversa") viram **um só**: **"Gerar boleto e PIX da primeira parcela e enviar na conversa"**.
   - Ao clicar: gera o boleto/PIX e já envia a mensagem com o resumo do acordo, PIX copia e cola e link do boleto na conversa. Se a geração falhar, nada é enviado e aparece o erro.
   - A seção "Lançar acordo no sistema (Meus Acordos)" sai dessa tela.

2. **Botão "+" no topo da conversa** ("Lançar acordo desta negociação"):
   - Em vez de abrir a página de novo acordo, abre um **diálogo de conferência** já preenchido: nome, telefone, CPF, parcelas, valores, total e 1º vencimento (vindos do acordo efetivado na UME ou da última proposta enviada na conversa).
   - O usuário confere/ajusta, informa dias de atraso, escolhe o credor, marca "Confirmei que este telefone é do cliente" e clica em **Salvar acordo**. Nada é salvo automaticamente.
   - Se a conversa não tiver proposta nem acordo efetivado, o diálogo abre com nome e telefone preenchidos e um link para a tela completa de novo acordo (comportamento atual).

## Detalhes técnicos

- `AcordoUmeApiDialog.tsx`: une `gerarBoleto` + `onEnviar(textoEnvio())` num handler; remove `<LancarAcordoConversa>`; ao efetivar, guarda os dados do acordo (parcelas, total, vencimento, nome, observação com ID UME) em estado elevado via callback `onEfetivado`.
- Novo `LancarAcordoDialog.tsx` (Dialog envolvendo o `LancarAcordoConversa` existente, com campos de parcelas/total/vencimento editáveis e botão "Salvar acordo").
- `InboxMeta.tsx`: botão "+" abre o novo diálogo; dados vêm do acordo efetivado da conversa (estado por conversa) ou de `ultimaPropostaPortal(mensagens)`.
- Sem mudanças de banco, cron ou polling; custo inalterado.
