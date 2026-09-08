---
name: Campanha com qualidade baixa
description: YELLOW/RED sai da campanha ao cair durante o envio; só entra no início com confirmação explícita de risco
type: feature
---
- Durante qualquer campanha, instância que cair para YELLOW/RED sai do rodízio imediatamente e o admin é avisado. Reentrada exige GREEN.
- Antes de iniciar, o usuário (inclusive parceiro Meta) pode marcar à mão números YELLOW/RED/sem leitura, mas precisa confirmar um diálogo de risco com checkbox. Os IDs aceitos ficam em `envio_meta_job.instancias_risco_aceito` e podem enviar mesmo não-GREEN.
- "Selecionar todas" seleciona apenas instâncias GREEN, conectadas, com nome aprovado e BM com saldo.
- Aviso "Qualidade baixa, mas seguindo no envio" foi removido.
