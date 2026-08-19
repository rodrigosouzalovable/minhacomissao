# Agendar retorno direto na conversa do Inbox Meta

## O que muda

1. **Botão "Modelo" vira só ícone**
   No cabeçalho de cada conversa do Inbox Meta Oficial, o botão passa a ser um botão quadrado apenas com o ícone de documento, mantendo o tooltip "Gerar mensagem de negociação".

2. **Novo ícone de relógio ao lado**
   Ao clicar, abre um dialog "Agendar retorno" com:
   - Data (calendário)
   - Hora (campo de horário)
   - Observação (texto livre, opcional)
   - Nome e telefone já preenchidos automaticamente com os dados do contato da conversa
   - Botão "Agendar retorno" com confirmação por toast

3. **Pop-up no dia/hora marcados**
   O agendamento é salvo na mesma base de retornos que o sistema já monitora, então no horário definido o alerta já existente aparece na tela (com som), mostrando nome, telefone e a observação.

## Detalhes técnicos

- Novo componente `src/components/inbox/meta/AgendarRetornoDialog.tsx`: insere em `retornos` (`user_id` = usuário logado, `cliente_nome`, `cliente_telefone`, `cliente_cpf` preenchido com o CPF conhecido do contato ou vazio, `data_retorno` = data+hora local convertida, `observacao`, `status = 'pendente'`).
- `src/pages/InboxMeta.tsx`: reduz o botão Modelo (`size="icon"`, sem texto) e adiciona botão com ícone `Clock` que abre o novo dialog, passando o contato ativo.
- O pop-up usa o `RetornoAlertChecker` já montado no layout (poll de 2 min + checagem ao voltar à aba) — sem novo polling, sem custo extra de backend.
- Sem mudanças de schema nem novas funções de backend.
