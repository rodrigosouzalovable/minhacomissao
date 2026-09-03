# Relatório só dos seus números + saída automática de YELLOW/RED da campanha

## 1. Relatório de aquecimento (12h e 18h) só com seus números da API oficial

Hoje o relatório lista **todas** as instâncias ativas: os 35 números oficiais (incluindo 6 vinculados a parceiros) e também os 79 espelhos dos números UAZAPI. Por isso aparecem "14 B2", "THIAGO 2 B1", "AMARAL" etc.

Passa a listar apenas números com `provider = 'meta'` **e** sem vínculo de parceiro. Resultado: só os números oficiais que você mesmo conectou. O restante do formato (qualidade, aquecimento 24h, enviadas/inbound/falhas, dólar/euro) fica igual.

## 2. Como está hoje o número que cai para YELLOW/RED durante a campanha

Verifiquei: existe toda a estrutura para tirar o número da campanha (auto-pausa, quarentena de 7 dias, entrada em recuperação e filtro de qualidade na escolha da instância), **mas a chave global "Liberar YELLOW/RED" está ligada** (foi você que pediu para liberar). Com ela ligada:

- a queda de qualidade não pausa, não põe em quarentena e não tira o número do rodízio;
- o número continua disparando na campanha em andamento até o fim.

Ou seja: hoje ele **não** sai. Proposta:

- Quando a qualidade de um número cair para YELLOW ou RED, ele sai imediatamente da campanha em andamento (é excluído do rodízio do job, o envio continua com as demais instâncias) e você recebe aviso no WhatsApp dizendo qual número saiu e por quê.
- Essa saída passa a valer mesmo com a chave "Liberar YELLOW/RED" ligada — a chave continua servindo para você poder **selecionar** e usar números YELLOW/RED manualmente, mas não impede mais a retirada automática após uma queda detectada durante o envio.
- Números em campanha passam a ter a saúde checada com mais frequência enquanto o job está rodando (checagem só durante campanha ativa, sem cron novo).

## 3. "Selecionar todas" na aba Envio Meta

O botão passa a marcar apenas números sem nenhum problema: conectados, nome não reprovado, BM com saldo **e qualidade GREEN** (exclui YELLOW, RED e sem leitura/UNKNOWN). Você continua podendo marcar um YELLOW/RED manualmente no card, um por um.

## Detalhes técnicos

- `supabase/functions/meta-aquecimento-relatorio/index.ts`: consulta de instâncias com `.eq('provider','meta')` e filtro `NOT is_instancia_parceiro(id)` (via lista de `meta_instance_parceiros`).
- `supabase/functions/envio-meta-massa-tick/index.ts`: antes de cada pick, verificar `saude_quality` das instâncias do job; ao detectar YELLOW/RED, adicionar o id em `instancias_bloqueadas_run`, registrar o motivo e notificar via `notificar-admin`. Se todas saírem, o job encerra com o aviso atual de conclusão.
- `supabase/functions/check-meta-instance-health/index.ts`: a retirada do pool/quarentena por queda de qualidade deixa de ser anulada por `liberar_qualidade_global` (a chave continua valendo para o gate de seleção/envio manual em `pick-meta-instance`).
- `src/pages/EnvioMeta.tsx`: filtro do "Selecionar todas" acrescenta `saude_quality === 'GREEN'`; texto/tooltip atualizados.
- Sem novo cron, polling ou canal Realtime — nenhum impacto de custo no Lovable Cloud.
