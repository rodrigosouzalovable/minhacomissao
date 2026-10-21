# Edge function rules

- Campaign ticks reuse handlers and pace globally start-to-start to avoid HTTP overhead.
- Meta health checks use a request deadline, bounded database/Graph reads and request-local token-scoped caching; incomplete reads preserve prior state and return per-instance errors instead of timing out the whole request.
- Template audits sync bounded manual batches before enqueueing; failed reads never mean missing templates, and only identified internal reservation failures may be recovered automatically.
- Daily Meta maintenance runs through meta-rotina-diaria, authorized only by its own cron token; it chains health, template sync/injection and webhook checks so internal callers keep service-role auth.
- SFTP UME/Odres daily sync (sftp-ume-auto, cron token 'sftp-ume-auto-*') downloads once to a private temp bucket because the SFTP server cannot seek, then UPSERTs in self-chained byte slices to stay under CPU limits; the final slice auto-applies payments matched to active agreements (CPF, value, due date) and keeps the history.
