# Manter a qualidade dos números Meta em GREEN

## O que os dados mostram (últimos 3 dias)

Cruzando envios por número com a qualidade atual:

```text
número                saídas  entradas  qualidade
SOUZA 62 8268-4796      679     142      RED
SOUZA 62 8268-4793      650     113      RED
SOUZA 62 8269-0260      579      99      RED
62 8267-7609            554     163      RED
62 8268-4838            483     124      RED
62 8267-7580            460     104      RED
...
AMARAL 62 8271-1628     134     249      GREEN
Novo Mundo 3144         288     268      GREEN
MEMU 37                   2       8      GREEN
```

O padrão é direto: **todo número que passou de ~450 saídas em 3 dias está RED; os que ficaram abaixo disso, ou que recebem quase tanto quanto enviam, estão GREEN.** Mandar mensagem para os nossos próprios números ajuda, mas não compensa: o peso do volume frio (cliente que não responde, que bloqueia ou reporta) é muito maior que o volume de aquecimento interno. Além disso o aquecimento interno oficial (`aquecimento_ativo`) está **desligado** no pool, então hoje o aquecimento acontece só "de carona" nas campanhas.

## Táticas propostas

1. **Teto real por número, muito abaixo da cota Meta** — hoje a fase 3 permite 150/dia e os números estão passando disso (245, 529 num único dia). Passar a usar teto efetivo por fase bem menor (ex. fase1 15, fase2 40, fase3 80, fase4 200) e nunca consumir mais de ~60% da cota Meta.
2. **Limite por hora e por janela** — além do teto diário, no máximo N mensagens/hora por número (ex. 12) e nada fora de 09h–19h. Rajadas concentradas são o que a Meta lê como spam.
3. **Freio por engajamento em tempo real** — a cada 50 envios de um número, medir: % de resposta, % entregue e % lida. Se resposta < 8%, ou não-lidas > 60%, reduzir o teto do número pela metade automaticamente; se piorar, pausar o número no dia. Hoje existe `guardrail_ratio_inbound` (5%) mas ele não corta volume progressivamente nem olha leitura/entrega.
4. **Higiene da base antes do disparo** — bloquear automaticamente destinatários que já falharam entrega 2x ou que receberam 3 campanhas sem nenhuma resposta. Número inválido/abandonado é o que mais derruba qualidade.
5. **Quarentena e recuperação de RED/YELLOW** — número que cai para YELLOW/RED sai do pool de campanha por 7 dias e só faz: conversas recebidas (IAGO) + aquecimento interno. Volta com teto de 20/dia e sobe em escada (20 → 40 → 80) se ficar GREEN por 3 dias.
6. **Ligar o aquecimento interno oficial** (`aquecimento_ativo`) com conversas **bidirecionais** — hoje o número nosso recebe e o IAGO responde, o que gera entrada real; formalizar isso no rodízio de pares (`meta_aquecimento_pares`) garante entrada diária para todo número, inclusive os que não estão em campanha.
7. **Rotação de conteúdo** — alternar entre vários templates aprovados por campanha em vez de um só texto para milhares de destinatários, e incluir saída explícita ("responda SAIR para não receber mais"). Opt-out reduz denúncia, que é o gatilho mais forte de queda.
8. **Diluir em mais números** — a mesma base distribuída em mais chips com teto baixo cada um mantém o total diário sem sacrificar qualidade. Com 2000 mensagens, 25 números a 80/dia é seguro; 6 números a 350/dia não é.
9. **Alerta imediato de queda** — avisar no WhatsApp no momento em que um número muda de GREEN para YELLOW (não só no relatório de 12h/18h), com o histórico de volume das últimas 24h para entender a causa.

## Detalhes técnicos

- **`meta_envio_pool_config`**: reduzir defaults de `cota_fase1..4`, e adicionar `cota_max_hora`, `pct_max_cota_meta`, `resposta_min_pct`, `nao_lidas_max_pct`, `quarentena_dias`, `escada_retorno` (jsonb).
- **Novo controle por número/dia**: tabela `meta_instance_freio_diario` (instância, dia, teto_efetivo, enviados, motivo_reducao) alimentada pelo tick de envio; `pick-meta-instance` passa a ler o teto efetivo em vez de `tier_diario`.
- **`pick-meta-instance`**: excluir instância com `saude_quality` em (YELLOW, RED, UNKNOWN sem checagem recente), com quarentena ativa, com teto horário estourado, ou fora da janela 09–19h.
- **Freio por engajamento**: nova função `meta-qualidade-freio` (cron a cada 30min) que calcula, por instância nas últimas 24h a partir de `meta_whatsapp_mensagens`, `%resposta`, `%entregue` e `%lida` (usando `direcao` e `status_envio`) e grava o teto reduzido em `meta_instance_freio_diario`.
- **Higiene de base**: tabela `meta_destinatario_supressao` (telefone sufixo 8, motivo, criado_em) preenchida por falha de entrega repetida e por campanhas sem resposta; `envio-meta-massa-iniciar` filtra contra ela antes de inserir os itens do job.
- **Quarentena**: campos `quarentena_ate`, `teto_escada` em `meta_whatsapp_instances`, aplicados por `check-meta-instance-health` na transição de qualidade; `meta-rampup-scheduler` cuida da escada de retorno.
- **Aquecimento interno**: ativar `aquecimento_ativo` e ajustar `meta-aquecimento-tick` para garantir pelo menos 1 par de ida-e-volta por número por dia, respeitando o rodízio de `meta_aquecimento_pares`.
- **Rotação de template**: no disparo, alternar entre os templates aprovados equivalentes da instância (round-robin por item), sem mudar a UI de seleção além de permitir marcar mais de um template.
- **Alerta de queda**: em `check-meta-instance-health`, ao detectar GREEN→YELLOW/RED, disparar `notificar-admin` na hora (1 aviso por número por dia, como já é o padrão do projeto).

## Custo (Lovable Cloud)

Inclui um novo cron a cada 30min (`meta-qualidade-freio`, consultas agregadas com índice por instância/data) e o aquecimento interno diário. O impacto é pequeno em execuções, mas é aumento de custo — vale confirmar antes de implementar. Em contrapartida, os tetos menores reduzem volume de envio e, com isso, o custo de mensagens Meta.
