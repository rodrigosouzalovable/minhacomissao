# Ajustar janela de injeção de templates Meta para 07h–20h BRT

## Contexto
Hoje a injeção automática de templates aprovados em novos números da API Oficial Meta roda das **09h às 18h** BRT (configurada em `meta_templates_onboarding_config.hora_inicio` e `hora_fim`). O usuário quer estender para **07h às 20h** BRT.

## O que muda

- `hora_inicio`: 9 → 7
- `hora_fim`: 18 → 20
- Janela total passa a ser 13 horas (07h–20h BRT).
- Bloqueio de domingo continua ativo.
- Doses diárias (3/5/8/10) e intervalo de 15–25 min entre templates permanecem inalterados — a proteção anti-ban se mantém.

## Considerações de risco

- **Banimento:** 07h–20h está dentro do horário comercial aceitável no Brasil e da janela permitida pela Meta. Não há risco adicional de banimento desde que as doses e os intervalos entre envios sejam preservados.
- **Taxa de aprovação:** iniciar às 07h pode reduzir ligeiramente a taxa de resposta/engajamento, pois é mais cedo, mas não afeta a aprovação dos templates pela Meta.
- **Volume:** a janela maior permite terminar a fila mais cedo no dia, mas o volume diário por número continua limitado pelas doses.
- **Outros motores:** esta mudança afeta **apenas** a injeção de templates. Campanhas Meta (08h–19h/20h) e aquecimento entre números (08h–19h) não serão alterados, salvo se o usuário solicitar alinhamento posterior.

## Passos técnicos

1. **Banco de dados:** atualizar a linha `id = 1` de `meta_templates_onboarding_config` para `hora_inicio = 7` e `hora_fim = 20`.
2. **Edge Function `meta-templates-onboarding-tick`:** ajustar os valores padrão (fallback) de `hora_inicio` e `hora_fim` de 9/18 para 7/20, e atualizar o comentário inicial de "09h às 18h" para "07h às 20h".
3. **Frontend:** atualizar todos os textos de ajuda que mencionam "09h às 18h" para "07h às 20h":
   - `src/pages/ConfigurarMeta.tsx` (diálogos de adicionar/editar instância e painel de auditoria).
   - `src/pages/MetaTemplates.tsx` (diálogo de seleção de modelos para números novos).
4. **Mensagens de notificação:** atualizar os textos das Edge Functions `meta-templates-onboarding-enfileirar` e `meta-templates-auditar-instancias` que informam o horário no WhatsApp.
5. **Verificação:** confirmar que a função respeita a nova janela e que não há hardcodes antigos de 9/18 remanescentes.

## Entregáveis

- Configuração do banco ajustada.
- Edge Function atualizada e republicada.
- Textos do frontend e notificações sincronizados.
- Smoke test da função confirmando `skipped: "fora_da_janela"` fora de 07h–20h.
