# Liberar YELLOW / RED / UNKNOWN nas campanhas Meta

## Situação atual (verificada no banco)

- A chave global **"Liberar YELLOW/RED"** já está **ligada** (`liberar_qualidade_global = true`), mas hoje ela vale só para aquecimento/recuperação — a campanha continua exigindo GREEN confirmado.
- Instâncias ativas hoje: 25 GREEN, 2 YELLOW, 1 RED, 5 UNKNOWN e **79 sem qualidade lida** (leitura da Meta falhou/nunca rodou). Ou seja, hoje só 25 números podem disparar em campanha.

## O que vou fazer

1. **A chave "Liberar YELLOW/RED" passa a valer também para campanha e disparo em massa.** Com ela ligada, números YELLOW, RED, UNKNOWN, sem qualidade e com leitura desatualizada/falhada entram nas campanhas normalmente.
2. **Quarentena, pausa por qualidade e modo recuperação deixam de barrar a campanha** enquanto a chave estiver ligada (já é assim no aquecimento).
3. **Continuam bloqueando** (proteção real da Meta, não é qualidade): número banido, conta bloqueada, pendência de pagamento, restrição da Meta e a cota real do número.
4. **Rodízio prioriza os melhores**: GREEN continua com peso maior, YELLOW/RED/UNKNOWN entram com peso reduzido para diluir o volume.
5. **Sinalização mantida**: os badges `GREEN` / `YELLOW` / `RED` / `SEM LEITURA` / `DESATUALIZADA` continuam aparecendo, e o painel do Pool Meta passa a avisar que a campanha está liberada para todas as qualidades.
6. Desligando a chave, volta ao comportamento atual de "somente GREEN confirmado".

## Aviso

Disparar volume com números RED/YELLOW tende a piorar a qualidade e pode levar a restrição ou banimento pela Meta. Recomendo volume baixo nesses números — o rodízio com peso reduzido ajuda nisso.

## Detalhes técnicos

- `pick-meta-instance`: quando `cfg.liberar_qualidade_global === true`, tratar `ignoraQualidadeGlobal = true` mesmo em `modoCampanha`, e pular o bloco "CAMPANHA: só GREEN com leitura recente" (checagens de `qualidade_leitura_ok`, idade de `saude_checked_at` e `qCamp !== 'GREEN'`). Peso de qualidade para UNKNOWN/vazio volta a ser não-zero em campanha.
- `envio-meta-massa-iniciar`: ler `liberar_qualidade_global` da config e, quando ligada, pular o filtro server-side de GREEN/leitura fresca, mantendo os motivos por instância no `CampanhaInstanciasPanel` quando desligada.
- `send-whatsapp-meta`: já usa `liberacaoGlobal`; garantir que o gate de qualidade da campanha também respeite a flag.
- `PoolMetaPanel.tsx`: ajustar o texto do switch e o aviso de "fora de campanha" para refletir o novo comportamento.
- Atualizar a memória `campanha-somente-green-confirmado` para a nova regra.
- Sem migração, sem novos crons, polling ou consultas — sem impacto de custo no Lovable Cloud.
