# Edge function rules

- Campaign ticks reuse handlers and pace globally start-to-start to avoid HTTP overhead.
- Meta health checks use a request deadline, bounded database/Graph reads and request-local token-scoped caching; incomplete reads preserve prior state and return per-instance errors instead of timing out the whole request.
