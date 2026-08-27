# Recuperar números Meta de RED/YELLOW para GREEN

## Resposta direta à sua ideia

Enviar da instância RED para os seus números UAZAPI (que o IAGO responde na caixa AQUECIMENTO) **ajuda, mas não é o que resolve** — e feito do jeito errado piora.

O que os dados dos 5 números RED mostram (últimos 3 dias):

```text
número                 saídas  entradas  % entrada
SOUZA 62 8269-9096      1060      574      54%
SOUZA 62 8269-3452       992      486      49%
SOUZA 62 8269-3446       869      449      52%
SOUZA 62 8269-3405       804      390      49%
SOUZA 62 8269-3397       801      400      50%
```

Ou seja: esses números **já tinham ~50% de entrada** e caíram para RED de qualquer forma. O sinal que derrubou não foi falta de resposta — foi **volume frio alto (250–350/dia por número) + bloqueios/denúncias de clientes reais**. Mandar mais 200 mensagens hoje para os próprios chips não apaga esse histórico: a qualidade da Meta é uma janela móvel de ~7 dias de feedback negativo. O que faz voltar para GREEN é **parar o volume frio por alguns dias** e manter só conversa boa e recebida.

Então o teste vale como **manutenção de sinal positivo**, não como cura, e precisa ser em volume baixo (10–20 msgs/dia por número). Disparar centenas para os próprios chips é o cenário que a Meta lê como comportamento artificial.

## Estado atual que atrapalha (verificado agora)

- **3 dos 5 números RED continuam com `estado_pool = 'ativo'`** (8269-3452, 8269-3405, 8269-3397) — mesmo com quarentena até 02/09 registrada. Se o disparo não olhar quarentena, eles seguem queimando.
- **`freio_ativo = false`** — o freio de qualidade por engajamento existe mas está desligado; a última gravação de teto é de 19/08.
- **`aquecimento_ativo = false`** e a tabela de pares de aquecimento está **vazia** — o aquecimento oficial nunca rodou.
- O aquecimento atual envia Meta→Meta usando `display_phone`, e **quase todos os números Meta estão sem `display_phone` preenchido** — por isso nunca teria funcionado. Já os espelhos UAZAPI têm telefone preenchido (30+ números).

## Plano de recuperação

### 1. Trancar o volume frio dos RED/YELLOW (o passo que realmente cura)
- Colocar os 5 RED em `estado_pool = 'restrita'` durante a quarentena, e o disparo passa a excluir instância com `quarentena_ate` no futuro (hoje ele não olha esse campo).
- Ligar o `freio_ativo` para que o teto diário caia sozinho quando resposta/leitura piora.

### 2. Recuperação automática — o sistema faz sozinho
Sim, dá para ser 100% automático. No momento em que a checagem de saúde detecta GREEN→YELLOW ou →RED, o próprio sistema:

1. Tira o número das campanhas (quarentena, já existe hoje).
2. **Liga o modo recuperação** para aquele número (novo campo `recuperacao_ativa` + `recuperacao_desde`).
3. Um agendador roda a cada 10 min e, para cada número em recuperação, envia sozinho um template para um dos seus **números UAZAPI da caixa AQUECIMENTO**, que o IAGO responde automaticamente.
4. Quando a qualidade volta a GREEN e fica 3 dias assim, o modo recuperação se desliga e o número volta ao pool pela escada (20 → 40 → 80 → teto da fase).
5. Você recebe aviso no WhatsApp em cada transição: entrou em recuperação, voltou para GREEN, voltou ao pool.

Quantidade e momento (calculados pelo sistema, sem você mexer):
- **10 a 20 mensagens por dia** por número em recuperação, sorteado dentro dessa faixa a cada dia.
- Intervalo de **20 a 40 min** entre uma e outra, sempre randomizado.
- Somente **09h–19h BRT**, nunca domingo.
- Rodízio de destinos: nunca o mesmo número UAZAPI duas vezes seguidas, e no máximo 2 conversas por destino no dia.
- O IAGO responde de 1 a 3 mensagens na conversa, gerando leitura e entrada real.
- Se a qualidade piorar em vez de melhorar, o volume cai para 5/dia em vez de subir — evita insistir num número que a Meta já marcou.

### 3. Aquecimento preventivo dos GREEN (opcional, mesmo motor)
- Os números que estão em campanha também recebem um mínimo diário de entrada (3–5 conversas com os UAZAPI), para não chegarem em YELLOW.


### 4. Escada de retorno automática
- Número sai da quarentena com teto 20/dia; se ficar GREEN por 3 dias sobe para 40, depois 80, depois teto normal da fase. Cai de degrau ao primeiro YELLOW.
- A escada já tem campos (`teto_escada`, `escada_retorno`), falta o agendador aplicar a promoção diária.

### 5. Higiene da base antes de voltar a disparar
- Só voltar a mandar campanha desses números para listas filtradas: sem quem já falhou entrega 2x, sem quem recebeu 3 campanhas sem responder, sem quem está na blacklist.
- Rotação de templates e frase de opt-out ("responda SAIR") nas campanhas — denúncia é o gatilho mais forte de queda.

### 6. Acompanhamento
- Checagem de saúde 3x/dia nos números em recuperação e aviso no WhatsApp na transição RED→YELLOW→GREEN, com volume das 24h para relacionar causa e efeito.
- Painel simples no Monitor de Envios: número, qualidade, dia da quarentena/recuperação, mensagens de aquecimento enviadas hoje, teto do degrau, % de entrada.

## Expectativa realista

Com volume frio zerado e aquecimento leve, a qualidade normalmente sai de RED em **3 a 7 dias** (a janela de avaliação da Meta). Não existe caminho de 1 dia. Se voltar a disparar 300/dia assim que virar YELLOW, cai de novo na mesma semana.

## Detalhes técnicos

- `pick-meta-instance` / `envio-meta-massa-*`: excluir instância com `quarentena_ate > now()`, `recuperacao_ativa = true`, `estado_pool <> 'ativo'`, ou teto do dia (`meta_instance_freio_diario.teto_efetivo`) já consumido.
- Migração: em `meta_whatsapp_instances`, campos `recuperacao_ativa`, `recuperacao_desde`, `recuperacao_msgs_meta_dia`, `dias_green_consecutivos`; nova tabela `meta_recuperacao_log` (instância, destino UAZAPI, enviado_em, resposta_em, status) com grants e RLS igual às demais tabelas Meta.
- `check-meta-instance-health`: ao detectar queda para YELLOW/RED, além da quarentena atual, ligar `recuperacao_ativa` e sortear `recuperacao_msgs_meta_dia` entre 10 e 20 (5 se a qualidade piorar de novo); ao detectar GREEN, incrementar `dias_green_consecutivos` e, ao chegar a 3, desligar a recuperação; avisar no WhatsApp em cada transição. Passa a rodar 3x/dia.
- Novo `meta-recuperacao-tick` (cron a cada 10 min, 09–19h BRT, sem domingo): para cada instância em recuperação, se o intervalo aleatório de 20–40 min desde o último envio já passou e a meta do dia não foi atingida, escolhe por rodízio um telefone UAZAPI vinculado à pasta AQUECIMENTO (máx. 2/dia por destino), envia o template utility pela Graph API e registra em `meta_recuperacao_log` + `meta_aquecimento_pares`. Diferente do tick atual, aqui emissor RED é permitido.
- `meta-aquecimento-tick`: reaproveitado para o preventivo dos GREEN, com alvo trocado de Meta→Meta para os telefones UAZAPI da pasta AQUECIMENTO (hoje falha porque quase nenhuma instância Meta tem `display_phone`).
- `meta-envio-pool-config`: `freio_ativo = true`, `aquecimento_ativo = true`, novos campos `recuperacao_auto` (liga/desliga tudo), `recuperacao_msgs_min/max_dia` (10/20), `recuperacao_intervalo_min/max_seg` (1200/2400), `preventivo_msgs_dia` (3).
- `meta-rampup-scheduler` (diário): instância com quarentena vencida e 3 dias GREEN volta ao pool no degrau seguinte de `escada_retorno`; ao detectar YELLOW, volta um degrau.
- Backfill: preencher `display_phone` das instâncias Meta a partir de `display_phone_number` da Graph API, para os relatórios ficarem legíveis.
- Controles de segurança do job: teto por número e por dia gravado no banco (idempotente), lock por instância, e parada automática do ciclo se a Graph API responder erro de bloqueio/pagamento.

## Custo (Lovable Cloud)

⚠️ Aumento de custo: o aquecimento passa a rodar em ciclos de 10 min na janela útil e a checagem de saúde vai a 3x/dia; são execuções de função e consultas agregadas por instância (com índice por instância/data). Em contrapartida, os tetos e a quarentena reduzem o volume de mensagens Meta, que é o custo maior. Confirme antes de eu implementar.
