# Decisões técnicas

<!-- LOVABLE:BEGIN -->
- Imported agreement documents preserve validated installments and manual review; never invent missing rows.
- Campaign media uses persisted recipient overrides and isolated send snapshots to preserve history.
- Campaign sharing is scoped read-only; no extra realtime channels.
- Recovery timings separate quality/delivery evidence using loaded cycles.
- Meta violation pauses require matching-entity confirmation; inconclusive reads never imply bans.
- Recovery volume changes use authenticated idempotent consent and shared atomic budgets.
- Template paths share atomic number/WABA cooldowns and a BM lease; selected-model deferrals reuse the worker without enabling broad copying.
<!-- LOVABLE:END -->

- Resolve Meta redirects before rendering; save owner-scoped URLs atomically, override stale templates, preserve sent previews.

- Agreements need audited phone confirmation and sent/downloaded terms before completion.
- Inbox dialogs share parsing/state; require body/header values and validated button links, never guesses.
- Meta composer keeps editing during sends; guard submission and focus on activation only to preserve drafts and dialog focus.

- Meta webhook alerts need failed recovery and confirmed subscription errors, not timeouts.
- Installment values/payment dates use atomic recalculation RPCs; due dates and payments use dedicated authenticated RPCs.

- Inbox assignments/sends are atomic and authorized; IAGO rotates in PADRÃO only. Unread filtering precedes pagination; opening does not clear unread.
- Unknown Meta messages keep restricted diagnostics and show a clear content-unavailable notice.
- Inbox pool returns reuse authorized RPCs after individual Meta health confirmation; never bypass real blocks.
- Inbox media uses conversation-level authorization, never broad folder access, to isolate attachments.
- Meta→UAZAPI migration reuses the instance, verifies phone/inbox before disabling Meta, and preserves history.
- Certificate reservations belong to one instance; Meta refusal fails only that contact, preserving other sends and quotas.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- Cobmais diário envia o XLSX a armazenamento privado e processa no servidor; staging/publicação são atômicos, chave = CPF+credor+contrato+parcela e vencimento é substituível.
- Meta stays owner-scoped; catalogs retain own Utility master links after copy reclassification so distribution continues; messaging still needs approved Utility copies.
- Template completion shares owner-scoped approved sources, pagination and atomic tier reservations.
- Clara logs automatic replies without closing; consecutive messages resolve offer, validity, scheduling and documents before AI.
- Campaign results use indexed suffix/CPF and time windows, without polling.
- “Não é o cliente” alterna a blacklist por sufixo sem sobrescrever bloqueios anteriores, fica visível no card; todos desfazem pelo card, somente admins listam/exportam.
- Navigation uses explicitly granted tabs; `parceiro_meta` scopes instances, never grants extra screens.
- National leads have separate locks/scheduling and daily/monthly Google-account limits; no message sends or dollar caps.
- Destinatários confirmados sem WhatsApp usam categoria própria de supressão obrigatória por sufixo; falhas inconclusivas nunca são persistidas.
- Bell/Retornos share pending payments of active agreements; scheduled-return alerts avoid overdue queries, preventing popups and redundant fetching.
- Employee commission uses payment dates and independent tiers; office fees stay separate.
- Receipt views share a versioned ranking RPC and success cache invalidation for consistent totals without polling.
- UME loads client/totals first and alternatives on demand; bound waits, cache 12h without polling.
- Creditor negotiation templates keep independent editable text despite shared extraction/calculation.
- O IAGO participa do rodízio somente na PADRÃO, mas responde toda entrada UAZAPI da AQUECIMENTO com uma resposta curta, sem transferência e sem follow-up.
- A recuperação automática de números próprios RED/YELLOW opera diariamente das 08h às 19h BRT, exceto domingos, e desativa imediatamente remetentes com bloqueio real confirmado pela Meta.
- Maps blacklist matches suffixes, removes source contacts and prevents recreation.

- Meta payment errors share commercial classification and cached revalidation before alerts; inconclusive checks never claim unpaid billing or release protected senders.


- Maps warming/recovery share permanent suffix claims, consent/opt-out checks and one-time replies; uncertainty never releases claims.

- Manual Meta checks batch all owner-connected instances; automatic checks remain due-only to limit cost and timeouts.
- Overdue audits owner-admin cost consent; isolated scheduler credentials start bounded cycles and stop after drain.
- Inbox phone search uses indexed reverse ranges and bounded invoker RPC; RLS precedes pagination; opening selects the actual box.

