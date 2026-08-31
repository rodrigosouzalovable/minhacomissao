# Liberar instâncias em quarentena (YELLOW/RED) para todos os usuários

## Situação atual (verificada agora no banco)

7 números estão travados hoje:

```text
SOUZA 62 8269-3397   RED      pausado    quarentena até 04/09   em recuperação
SOUZA 62 8269-3405   RED      pausado    quarentena até 05/09   em recuperação
SOUZA 62 8269-3446   RED      pausado    quarentena até 03/09   em recuperação
SOUZA 62 8269-3452   RED      pausado    quarentena até 03/09   em recuperação
SOUZA 62 8269-3474   RED      pausado    quarentena até 05/09   em recuperação
SOUZA 62 8269-9096   RED      restrita   quarentena até 03/09   em recuperação
AMARAL 62 8273-8416  YELLOW   ativo      quarentena até 04/09
```

Hoje o sistema barra esses números em quatro pontos: o início da campanha recusa RED e recusa quarentena (é a mensagem do print), o seletor de instância descarta quarentena/recuperação/pausa, o envio direto bloqueia pausa por qualidade, e a checagem de saúde volta a colocar em quarentena a cada leitura da Meta.

## O que vou fazer

1. **Chave global "Liberar YELLOW/RED"** no painel do Pool Meta (aba API Oficial). Ligada, vale para todos os usuários, inclusive parceiros.
2. Com a chave ligada:
   - campanhas deixam de recusar instância por qualidade RED e por quarentena;
   - o seletor passa a aceitar números em quarentena, em recuperação e pausados por qualidade;
   - o envio manual e automático segue o mesmo critério.
   - Continuam bloqueando (proteção real, não é qualidade): número banido pela Meta, conta bloqueada/pendência de pagamento, nome de exibição reprovado e a cota real da Meta do número.
3. **Limpeza imediata dos 7 números acima**: zerar quarentena, desligar o modo recuperação, tirar a pausa por qualidade e devolver ao pool ativo.
4. **A checagem de saúde para de recolocar em quarentena** enquanto a chave estiver ligada — ela continua lendo e mostrando a qualidade e avisando por WhatsApp quando cair, mas sem tirar o número do ar.
5. Desligando a chave, tudo volta ao comportamento protetivo atual.

## Aviso importante

Disparar volume com número RED normalmente aprofunda a queda e pode levar a bloqueio definitivo pela Meta. A liberação é a que você pediu; recomendo manter volume baixo nesses números.

## Detalhes técnicos

- Migração: coluna `liberar_qualidade_global boolean not null default false` em `meta_envio_pool_config`; e atualização de dados nos 7 números (`quarentena_ate = null`, `quarentena_motivo = null`, `recuperacao_ativa = false`, `pausa_automatica_ate/motivo = null` quando a pausa é `quality=`, `estado_pool = 'ativo'`).
- `envio-meta-massa-iniciar`: pular o filtro de RED e o filtro de quarentena quando `liberar_qualidade_global` é true (a config já é lida na função).
- `pick-meta-instance`: `ignoraQualidadeGlobal = ignorar_pausa_qualidade === true || cfg.liberar_qualidade_global === true`, o que já cobre quarentena, recuperação, estado do pool e o gate de qualidade; manter o peso reduzido de RES no rodízio para diluir volume.
- `send-whatsapp-meta`: incluir a mesma flag em `ignoraQualidade`.
- `check-meta-instance-health`: quando a flag está ligada, não gravar `quarentena_ate`, `recuperacao_ativa` nem `estado_pool='pausado'/'restrita'` por motivo de qualidade; manter as pausas por ban/bloqueio de conta e as notificações.
- `PoolMetaPanel.tsx`: novo switch com rótulo claro e aviso de risco, no mesmo bloco do "sem teto global".
- Sem novos crons, polling ou consultas adicionais — sem impacto de custo.
