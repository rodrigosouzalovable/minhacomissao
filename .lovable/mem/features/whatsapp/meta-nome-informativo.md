---
name: Nome Meta apenas informativo
description: Estado do nome de exibição nunca bloqueia pool, seleção, aquecimento ou envio; recusas reais da Meta continuam registradas
type: feature
---

- `PENDING_REVIEW`, `NON_EXISTS`, `AVAILABLE_WITHOUT_REVIEW`, `REJECTED` ou status vazio são apenas informativos.
- O botão Ativar Pool não exige nome `APPROVED` e ignora `LIMITED` quando o único detalhe é aprovação do nome.
- Seleção, campanha, aquecimento e envio não descartam uma instância apenas pelo nome.
- Desconexão, banimento, `ACCOUNT_VIOLATION`, bloqueio comercial/pagamento, cota, quarentena e retirada manual continuam sendo respeitados.
- Uma recusa real devolvida pela Meta por nome continua registrada como falha.