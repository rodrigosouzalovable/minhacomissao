# Operador vinculado e tela completa preenchida (botão "+" do Inbox Meta)

## O que muda

1. **Escolher o operador no diálogo "Lançar acordo desta negociação"**
   - Novo campo **Operador vinculado**, já marcado com quem está logado.
   - Aparece só para admin (mesma regra da tela completa de Novo Acordo). Funcionários continuam lançando no próprio login.
   - Ao salvar, o acordo e a comissão ficam com o operador escolhido; a confirmação de telefone continua registrada em nome de quem salvou.

2. **"Abrir tela completa de novo acordo" já preenchida**
   - Hoje a tela abre na aba "PDF ou print" com só nome e telefone.
   - Passa a abrir direto na aba **Preencher Manualmente**, com nome, CPF, telefone, total, nº de parcelas, valor das parcelas, 1º vencimento, dias de atraso, credor e operador (se admin) — exatamente o que estava no diálogo, inclusive ajustes feitos à mão.
   - Continua vinculada à conversa (termo de formalização enviado pela mesma conversa).

## Detalhes técnicos

- `LancarAcordoConversa.tsx`: `isAdmin` via `useUserRole`; carrega `profiles` (id, nome) só para admin; `Select` "Operador vinculado"; `user_id: operadorId` no insert. Expor os valores atuais (nome, telefone, dias, empresa, operador) via callback `onChange` para o diálogo.
- `LancarAcordoDialog.tsx`: guarda esses valores e passa ao `onTelaCompleta(prefill)` junto de CPF/total/parcelas/vencimento.
- `InboxMeta.tsx`: inclui `prefill` em `navigate('/acordos/novo', { state: { metaOrigem, prefill } })`.
- `NovoAcordo.tsx`: se houver `prefill`, `setActiveTab('manual')`, preenche `form` (formatando CPF/telefone/valores), `setEmpresa`, `setSelectedUserId` (admin).
- Sem mudanças de banco, cron ou polling.
