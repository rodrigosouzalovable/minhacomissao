---
name: IAGO — descontos manuais e espera de 20s
description: Descontos à vista/parcelado configuráveis em iago_config sobrepõem as faixas do credor; IAGO espera 20s extras e cede a vez ao atendente humano
type: feature
---

- `iago_config.desconto_avista_pct` / `desconto_parcelado_pct` (nullable): quando preenchidos, `calcularProposta` ignora `credor_desconto_faixas` e as faixas padrão por dias de atraso. Em branco = comportamento automático anterior. Grade 2x–24x e parcela mínima R$ 100 continuam.
- Campos editáveis em Usuários > Configurar IAGO > Personalidade ("Descontos da proposta").
- Antes de responder, o `iago-atendimento` aguarda **20 segundos a mais** e reconfere as saídas da conversa: se houver mensagem de saída não pertencente ao IAGO depois do corte, ele não envia nada (`followup_em: null`, finaliza a entrada). A regra dos 10 minutos de silêncio após resposta humana continua valendo.
