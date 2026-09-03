# Aquecimento inteligente para subir tier das novas BMs (2k → 10k → 100k)

## Objetivo

Os números novos das BMs liberadas em 2k precisam de dois ingredientes que a Meta olha para promover o tier: **qualidade alta (GREEN)** e **volume de conversas abertas com destinatários únicos**. O plano constrói um motor único que combina três fontes de destino e vai aprendendo sozinho qual fonte/nicho responde melhor.

Fontes de destino:
1. Números UAZAPI da pasta AQUECIMENTO (respondem sozinhos pelo IAGO) — já existe e continua sendo a base segura.
2. Leads do Google Maps com WhatsApp confirmado (clínicas, psicólogos, dentistas, estética etc.), que costumam ter resposta automática.
3. Novos leads coletados automaticamente pelos nichos que o sistema aprendeu serem os melhores.

## Como vai funcionar no dia a dia

### 1. Escada de tier por número
Cada número novo entra numa trilha automática com meta diária de **destinatários únicos**, não só de mensagens (é o que conta para a Meta):
- Alvo do dia definido pela IA, olhando: qualidade atual, dias em GREEN, taxa de resposta das últimas 48h, quantos únicos já foram atingidos em 7 dias e o teto do tier atual.
- Regra dura: se a qualidade cair para YELLOW/RED, o número sai da trilha e volta para a recuperação já existente.
- O painel mostra por número: tier atual, únicos nos últimos 7 dias, quanto falta para o gatilho de promoção (a Meta pede volume próximo de 2× o tier em 7 dias), previsão de dias até 10k.

### 2. Pool de destinos aprendido (a parte que fica mais inteligente)
- Cada envio para lead do Maps é registrado com nicho, cidade, horário e o que aconteceu depois: entregue, lido, respondido, respondido em menos de 2 min (indício de resposta automática), bloqueado/denunciado.
- Um placar por nicho é recalculado todo dia: taxa de resposta, taxa de resposta automática, taxa de reclamação. Nichos com boa resposta e zero reclamação sobem no ranking; nichos que geram bloqueio são banidos do aquecimento.
- Com base nesse placar, o sistema agenda buscas novas no Google Maps só nos nichos e cidades campeões, mantendo sempre um estoque mínimo de leads verificados com WhatsApp, e respeitando o limite mensal de consultas Google que já existe.
- Todo lead entra no aquecimento uma única vez por período (sem repique), com blacklist e supressão respeitadas.

### 3. Aba "Ideias de Templates"
Nova aba onde o sistema sugere templates para você cadastrar nas BMs:
- Lista de modelos prontos (utility e marketing) com nome sugerido, categoria, idioma, corpo, botões e a justificativa de por que funciona para aquecimento.
- Botão de copiar o texto para colar no cadastro da BM e um gerador por IA para criar variações novas.
- Estado por template: rascunho → cadastrado → aprovado. O motor só usa o que já está **aprovado** na BM (verificado pela sincronização de templates que já existe), e ignora automaticamente template pausado ou reprovado.
- Round-robin entre os templates aprovados, para não repetir sempre o mesmo conteúdo.

### 4. Controle de gasto — R$ 50/dia
- Orçamento diário configurável (padrão R$ 50), somando todos os números.
- Antes de cada envio o motor calcula o custo estimado pela categoria do template e para de disparar quando o teto é atingido, retomando no dia seguinte.
- Painel com gasto do dia, custo por conversa aberta e custo por resposta obtida.

### 5. Janela e segurança
- Disparos só de 08h às 19h BRT, nunca domingo, intervalos aleatórios entre mensagens, sem rajada para leads reais.
- Parada total automática em erro fatal da Meta (banimento, restrição, cobrança, cota da BM esgotada) e aviso no WhatsApp do admin.
- Leads reais recebem sempre template aprovado, com opção de saída na mensagem quando o template permitir.

## Detalhes técnicos

Banco (migração):
- `meta_aquecimento_trilha`: por instância — tier alvo, alvo de únicos do dia, únicos 7d, decisão da IA do dia, status (ativa/pausada/promovida).
- `meta_aquecimento_destino_log`: instância, lead ou instância UAZAPI de destino, nicho, template, custo estimado, wamid, resultado (entregue/lido/respondido/erro), `respondeu_em`, `segundos_para_resposta`.
- `aquecimento_nicho_score`: nicho + cidade, envios, respostas, respostas rápidas, reclamações, score, `bloqueado`, atualizado diariamente.
- `meta_template_ideias`: nome sugerido, categoria, idioma, corpo, botões, justificativa, status (rascunho/cadastrado/aprovado), `bm_id`.
- `meta_aquecimento_orcamento`: dia, teto em reais (padrão 50), gasto acumulado.
- Acrescentar em `google_maps_leads`: `usado_aquecimento_em`, `resultado_aquecimento`.
- GRANTs + RLS admin-only em todas as novas tabelas.

Edge functions:
- `meta-aquecimento-tick` (existente) ganha as fontes de destino: mantém UAZAPI e passa a alternar com leads do Maps conforme o mix definido pela IA, gravando em `meta_aquecimento_destino_log` e checando o orçamento antes de cada envio.
- `meta-aquecimento-planejar` (nova, 1x/dia 07h BRT): decide por número o alvo de únicos do dia e o mix de fontes (chamada única ao Lovable AI com os números reais dos últimos 7 dias); grava em `meta_aquecimento_trilha`. Trava de execução única, sem loop.
- `meta-aquecimento-aprender` (nova, 1x/dia 21h BRT): recalcula `aquecimento_nicho_score` a partir do log, bane nichos com reclamação e dispara buscas novas no Maps nos nichos campeões quando o estoque de leads verificados cair abaixo do mínimo.
- `meta-whatsapp-webhook` (existente): marcar resposta/leitura no `meta_aquecimento_destino_log` pelo wamid, para alimentar o aprendizado.
- Reaproveitar `google-maps-buscar-leads`, `google-maps-verificar-whatsapp`, `meta-sync-templates` e `check-meta-instance-health` — nada duplicado.

Frontend:
- Nova aba "Aquecimento Meta" (dentro da área Meta): trilha por número com barra de progresso até o próximo tier, ranking de nichos, gasto do dia e log dos últimos envios.
- Nova aba "Ideias de Templates" com a biblioteca, gerador por IA e controle de status.

## Aviso de custo (Lovable Cloud)

Esse plano adiciona **2 crons novos (1x/dia cada)**, 2 tabelas de log com escrita diária e 1 chamada de IA por dia. Impacto de infraestrutura baixo e controlado (sem polling, sem Realtime novo, índices em todas as consultas do motor). O custo relevante é o da Meta por conversa, limitado ao teto de R$ 50/dia. Confirme para eu seguir.
