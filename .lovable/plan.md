# Intervalo de 5–10 min e barra de progresso da injeção de templates

## O que muda

1. **Intervalo entre modelos**: hoje cada número espera de 15 a 25 minutos entre um template e o próximo. Passa para **5 a 10 minutos** (sorteado, nunca fixo). A janela continua 07h–20h, nunca no domingo, um modelo por vez por número, pausa automática após 2 reprovações seguidas ou bloqueio/limite da Meta.

2. **Barra de progresso geral** na aba API Oficial Meta (só administrador), num bloco novo acima dos cards:
   - Barra com o total: "X de Y modelos injetados".
   - Quantos faltam, quantos estão aguardando resposta da Meta, quantos reprovados/falharam.
   - Quantos números ainda têm pendência.
   - **Previsão de término** estimada com o ritmo real (intervalo médio de 7,5 min por número, números em paralelo, apenas horas dentro da janela 07h–20h e pulando domingo). Ex.: "previsão: hoje ~16:40" ou "previsão: amanhã ~09:20".
   - Atualiza sozinho a cada 60s enquanto houver pendência (para quando termina, para não gastar recursos).
   - O selo por número continua, agora com barrinha fina de progresso no card.

3. Os textos que citam "15–25 min" passam a citar "5–10 min" nas telas e nos avisos.

## Observação importante sobre o ritmo real

A fila avança de carona num agendamento que roda **de 10 em 10 minutos** e processa até 3 números por execução. Então, na prática, com 5–10 min configurados, cada número avança no máximo a cada ~10 min. Para o intervalo menor valer de verdade, vou subir o limite por execução de 3 para 10 números (cada número mantém o seu próprio intervalo, então não aumenta risco de ban por número).

## Aviso de custo (Lovable Cloud)

Impacto baixo: nenhum cron novo, nenhum Realtime. A barra usa uma consulta agregada leve a cada 60s, só para o administrador e só enquanto existir fila pendente. Processar até 10 números por execução aumenta um pouco as chamadas à Meta por execução, sem novo agendamento.

## Detalhes técnicos

- Migração: `update meta_templates_onboarding_config set intervalo_min_seg = 300, intervalo_max_seg = 600 where id = 1`.
- `supabase/functions/meta-templates-onboarding-tick/index.ts`: fallbacks `900/1500` → `300/600`; `MAX_INSTANCIAS_POR_RUN` 3 → 10; comentários do cabeçalho.
- `src/pages/ConfigurarMeta.tsx`: novo componente de progresso (agregado por status em `meta_templates_onboarding_fila` para as instâncias com `templates_auto_copiar = true`), cálculo de ETA (pendentes ÷ números ativos × 7,5 min, respeitando janela/domingo), `refetch` de 60s com guarda de visibilidade, barrinha no card e texto "5–10 min".
- `src/pages/MetaTemplates.tsx` e mensagens de `meta-templates-onboarding-enfileirar` / `meta-templates-auditar-instancias`: trocar "15–25 min" por "5–10 min".
- Republicar as três Edge Functions.
