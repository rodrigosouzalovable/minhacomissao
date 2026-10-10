# Decisões técnicas

<!-- LOVABLE:BEGIN -->
- Agreement documents use local PDF text parsing and validated individual installment rows; imported dates/values persist exactly and summary-only screenshots retain the existing schedule generator to avoid invented document rows.
- Campaign images persist in recipient vars keyed by name/language; use isolated send snapshots and path-keyed media caches without updating template defaults, so scheduled and resumed campaigns preserve the chosen image.
- Campaign sharing is per-job read-only through indexed grants and scoped RPCs; never extend owner controls or realtime subscriptions.
- Recovery timing reuses loaded exact cycles with independent drop-to-GREEN and accepted-first-send-to-GREEN samples, distinguishing waiting from sending without extra queries.
- Account-violation pauses retain source WABA and require positive matching entity health before individual release; only pending-name limits with GREEN/UNKNOWN are informational, never bans, mixed restrictions, quarantine or recovery.
- Recovery volume uses shared constants and atomic reservations; budget changes require authenticated owner-admin idempotent authorization to prevent compounded targets and preserve safety reductions.
<!-- LOVABLE:END -->

- Resolve Meta redirects before rendering; save owner-scoped URLs atomically, override stale templates, preserve sent previews.

- Agreements require audited phone confirmation before saving; remain pending until terms are sent via source/authorized suffix-matched Meta chat or downloaded.
- Inbox dialogs share parsing/state; require body/header values and validated button links, never guesses.
- Meta composer keeps editing during sends; guard submission and focus on activation only to preserve drafts and dialog focus.

- Meta webhook alerts need failed recovery and confirmed subscription errors, not timeouts.
- Valores de parcelas próprias, inclusive pagas, e suas datas efetivas de pagamento usam RPC atômica com recálculo de totais e comissões; vencimentos e baixas seguem RPCs autenticadas específicas.

- Inbox atomically assigns eligible box members and authorizes sends server-side; IAGO rotates only in PADRÃO. Unread filters precede pagination; opening never clears unread, only confirmed later outgoing does.
- Unknown Meta messages keep restricted diagnostics and show a clear content-unavailable notice.
- Inbox pool returns reuse authorized RPCs after individual Meta health confirmation; never bypass real blocks.
- Inbox media uses conversation-level authorization, never broad folder access, to isolate attachments.
- Meta→UAZAPI migrations reuse the official instance, verify its phone and fix its inbox before disabling Meta, preserving history and preventing duplicates.
- Reservas do Certificado são vinculadas a uma única instância: recusa da Meta marca só o contato como falha e não interrompe as demais, para preservar a cota e a auditabilidade por número.
- De 28/09 a 02/10/2026, o Certificado busca a data exata de um ano antes; não retoma D+5 a D+30 após o teste.
- Cobmais diário envia o XLSX a armazenamento privado e processa no servidor; staging/publicação são atômicos, chave = CPF+credor+contrato+parcela e vencimento é substituível.
- Meta stays owner-scoped; catalogs retain own Utility master links after copy reclassification so distribution continues; messaging still needs approved Utility copies.
- Automatic copies use selected owner Utility on verified CONNECTED GREEN/UNKNOWN only; preserve blocks, tier 250 two/day and sequential queues. Manual HSM sync requires an approved Utility source to avoid drafts.
- Resposta automática é registrada sem encerrar Clara; ela interpreta mensagens consecutivas e resolve oferta→validade→agendamento→documentos por etapa antes da IA.
- Campaign results match replies/agreements by normalized phone suffix/CPF and indexed time windows for fast manual checks without polling.
- “Não é o cliente” alterna a blacklist por sufixo sem sobrescrever bloqueios anteriores, fica visível no card; todos desfazem pelo card, somente admins listam/exportam.
- Navigation uses explicitly granted tabs; `parceiro_meta` scopes instances, never grants extra screens.
- National lead capture has separate scheduling/config/locks, daily query and monthly Google-account limits, never dollar caps or message sends.
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


- Maps warming/recovery share permanent global suffix claims with historical backfill, consent and opt-out checks; never release after delay or transport uncertainty. Preserve one-time replies and volume limits.

- Manual Meta checks batch all owner-connected instances; automatic checks remain due-only to limit cost and timeouts.
- Overdue audits owner-admin cost consent; isolated scheduler credentials start bounded cycles and stop after drain.
- Inbox phone search uses indexed reverse-normalized ranges and bounded SECURITY INVOKER RPC; RLS precedes pagination, filters preserve matches, opening selects the actual box.

