---
name: Meta pendência de pagamento (#131042)
description: Business eligibility payment issue restringe a instância, exige regularizar cartão/faturas na BM e agora libera sozinho na revalidação de saúde
type: feature
---

- `#131042 – Business eligibility payment issue` é pendência de faturamento/elegibilidade da **Business Manager** (cartão recusado/vencido, fatura aberta, verificação de negócio incompleta) — não é qualidade do número nem do contato. Afeta todos os números da mesma BM.
- Resolução do lado da Meta: Configurações de pagamento da BM → cartão internacional válido, faturas pagas, cartão principal definido, verificação de negócio concluída.
- `_shared/meta-conta-bloqueada.ts` expõe `ehMotivoPagamento`; `ehMotivoBloqueioMeta` inclui pagamento/faturamento/elegibilidade.
- `check-meta-instance-health` libera automaticamente instâncias pausadas por pagamento quando a Graph volta CONNECTED sem `ban_info` (avisa admin com texto específico).
- UI: badge "fora do pool" explica a pendência em português; botão "Revalidar na Meta" no card da instância e botão de revalidação em lote no card da BM (`BusinessManagersManager`).
