# Liberar instâncias com nome PENDING_REVIEW

Hoje o sistema trata "nome de exibição em análise" (`PENDING_REVIEW`) como se fosse reprovado: mostra a tag vermelha "NÃO RECOMENDADA" no card da instância e remove o número do disparo, tanto na tela de Envio Meta quanto na escolha automática de instância. Isso será removido — o número passa a enviar normalmente.

## O que muda

1. A tag vermelha "NÃO RECOMENDADA — nome PENDING_REVIEW" some do card da instância em Envio Meta.
2. Instâncias com nome em análise deixam de ser removidas do disparo (nada de aviso "instâncias removidas: nome de exibição em análise").
3. A escolha automática de instância (envios automáticos, lembretes, campanhas) volta a considerar esses números.
4. O status do nome continua visível de forma neutra: o texto "Meta: <nome> (PENDING_REVIEW)" no card e o badge cinza/âmbar "Nome: PENDING_REVIEW" na linha de saúde permanecem, apenas como informação.

`REJECTED` (nome reprovado pela Meta) continua bloqueado, porque nesse caso a entrega realmente falha com #131000.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`: no filtro `nomeProblema` (~linha 769) considerar apenas `REJECTED`; no card (~linha 1546) exibir a badge destrutiva apenas para `REJECTED`, com o texto ajustado.
- `supabase/functions/pick-meta-instance/index.ts` (~linha 147): descartar só `REJECTED`; redeploy da função.
- `src/components/meta/SaudeBadges.tsx` e `src/components/inbox/meta/MetaInstanceHealthBanner.tsx`: mantidos (são informativos, não bloqueiam envio).
- Sem alteração de banco, sem novo cron: custo inalterado.
