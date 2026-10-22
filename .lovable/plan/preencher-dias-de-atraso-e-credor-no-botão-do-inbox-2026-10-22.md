## Preencher dias de atraso e credor no botão "+" do Inbox

**Credor (da mensagem do cliente):**
- Ler o credor citado na proposta ("débito com UME", "Odres", "Novo Mundo") e já deixá-lo selecionado.
- Se a mensagem não citar o credor, nada fica selecionado (o usuário escolhe).

**Dias de atraso (da nossa base):**
- Ao abrir o diálogo, buscar pelo CPF a parcela em aberto mais antiga na carteira UME/Odres importada do SFTP.
- Dias de atraso = hoje menos o vencimento dessa parcela. Ex.: Gleuciany (CPF 021.906.882-80) tem parcela aberta desde 25/07/2025, ou seja, cerca de 454 dias.
- O campo continua editável; mostrar a data base usada ("vencida desde 25/07/2025").
- Se o CPF não estiver na carteira, o campo fica vazio, sem chute.

**Sem custo extra:** uma única consulta indexada por CPF ao abrir o diálogo; sem consultas repetidas.

### Detalhes técnicos
- `umePropostaPortal.ts`: adicionar `credor` à `PropostaPortal` (regex UME / Odres / Novo Mundo → `ume_novo_mundo` / `odres_cred` / `mundo_da_moda`).
- `InboxMeta.tsx`: passar `credor` em `dados`; `LancarAcordoDialog` repassa para `credorInicial`.
- `LancarAcordoConversa.tsx`: ao montar, `select min(vencimento)` em `ume_carteira_parcelas` filtrando o CPF (formatos com e sem pontuação) e preencher `dias` se vazio.
- Teste unitário do parser de credor (UME, Odres, sem credor).
