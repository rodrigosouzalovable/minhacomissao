---
name: Aquecimento inteligente de tier Meta
description: Motor que sobe tier das BMs (2k→10k→100k) misturando números UAZAPI e leads do Google Maps, com aprendizado de nicho e teto de R$50/dia
type: feature
---

Objetivo: subir o tier dos números novos da API Oficial Meta com qualidade GREEN e volume de destinatários únicos.

- `meta-aquecimento-planejar` (cron diário): IA (`google/gemini-3.7-flash`) define por instância o `alvo_unicos_dia` e o mix UAZAPI/leads em `meta_aquecimento_trilha`.
- `meta-aquecimento-tick` (10 min): dispara respeitando janela 08–19h BRT, orçamento diário (`meta_aquecimento_orcamento`, padrão R$ 50) e trilha; grava `meta_aquecimento_destino_log`. YELLOW/RED ficam fora (vão para `meta-recuperacao-tick`).
- `meta-whatsapp-webhook`: marca `entregue_em`, `lido_em`, `respondeu_em` e `segundos_para_resposta` por wamid/sufixo, alimentando o aprendizado.
- `meta-aquecimento-aprender` (cron diário): recalcula `aquecimento_nicho_score` (score = resposta*60 + resposta rápida*40 - reclamação*200), bloqueia nicho com reclamação ≥2% e repõe estoque de leads (mínimo 120) chamando `google-maps-buscar-leads` nos nichos campeões.
- `google-maps-buscar-leads` aceita modo interno: quando o Authorization/apikey é a chave de serviço, usa o primeiro admin de `user_roles` como dono da busca (para os crons).
- Frontend: abas "Aquecimento Meta" e "Ideias de Templates" em `ConfigurarMeta.tsx` (admin). Ideias em `meta_template_ideias` (rascunho → cadastrado → aprovado), geradas por `meta-template-ideias-gerar`.
