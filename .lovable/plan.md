# Por que os $10 sumiram em 1 dia — e o plano para cortar o gasto

## O que os dados reais mostram agora

**1. O banco nunca dorme.** Existe um agendamento rodando **a cada 10 segundos**, 24h por dia (`envio-meta-massa-tick`). Ele já executou **8.961 vezes nas últimas 24h**. Mesmo quando não faz nada (só checa se há campanha rodando), essa batida constante mantém a máquina do Cloud ligada e ocupada o tempo todo — e o Cloud cobra por hora de máquina ligada.

**2. Três consultas do app estão consumindo horas de CPU.** Somando o tempo total de execução acumulado:

| Consulta | Chamadas | Média | Tempo total |
| --- | --- | --- | --- |
| `envio_meta_job_item` (itens da campanha) | 435.147 | 95 ms | ~11,5 horas de CPU |
| `meta_whatsapp_envios_log` (por telefone) | 80.681 | 254 ms | ~5,7 horas |
| `meta_whatsapp_envios_log` (lista) | 395.204 | 35 ms | ~3,8 horas |
| `meta_whatsapp_contatos` (lista do Inbox) | 15.682 | **740 ms** | ~3,2 horas |

Ou seja: mais de **24 horas de CPU** gastas só nessas quatro consultas. As tabelas são pequenas (8.934 e 11.891 linhas) — o problema não é volume de dados, é **número de chamadas**: o painel de campanhas relê a lista inteira de itens a cada evento em tempo real, e cada telefone gera uma consulta extra ao log de envios.

**3. A lista do Inbox está lenta por falta de índice adequado.** O filtro usado é `arquivado = false AND folder_id IS NULL`, mas o índice existente cobre só `arquivado + data`. Resultado: 740 ms de média por abertura da lista.

**4. Memória em 69% numa máquina Small e WAL em 1 GB.** Sinal de pressão constante, coerente com a carga acima.

**5. 157.453 transações revertidas desde o último boot.** Trabalho de CPU que foi pago e descartado — precisa ser rastreado.

## Plano de redução (em ordem de impacto)

### 1. Deixar a máquina poder ficar ociosa (maior economia)
Trocar o cron de 10 segundos por um modelo **sob demanda**: o tick só roda enquanto existe campanha com status `rodando`. Duas mudanças combinadas:
- Reduzir a frequência base para **1 minuto** quando não há campanha (em vez de 6x por minuto).
- Manter cadência rápida durante a campanha, disparada pelo próprio worker (auto-reagendamento) em vez do cron batendo sempre.

Efeito: de ~8.900 execuções/dia para algumas centenas, e a máquina passa a ter janelas reais de inatividade.

### 2. Parar de relê a campanha inteira a cada evento
No painel de campanhas (Envio Meta):
- Substituir a releitura completa dos itens por **atualização incremental** com os dados que já chegam no evento em tempo real (telefone + status), sem nova consulta ao banco.
- Só fazer leitura completa quando o usuário **abre** o detalhe da campanha, ou clica em "Atualizar".
- Trocar as consultas por telefone (fatiadas de 200 em 200) por **uma única consulta agregada** por campanha.

Isso ataca diretamente as 435 mil + 395 mil chamadas — a maior fatia da CPU.

### 3. Índice para a lista do Inbox
Criar índice parcial em `meta_whatsapp_contatos (arquivado, ultima_mensagem_em DESC)` restrito a `folder_id IS NULL`, e o equivalente por pasta. Alvo: sair de 740 ms para poucos milissegundos.

### 4. Limpeza automática do histórico de agendamentos
A tabela de histórico do cron tem **83.480 linhas / 78 MB**. Reduzir a retenção de 7 para 2 dias e limpar diariamente.

### 5. Investigar as transações revertidas
Rastrear nos logs qual chamada falha em loop (candidatos: retry de envio, webhook, tick) e corrigir a causa.

### 6. Ajustes finos de polling no app
Revisar os intervalos curtos que ainda existem (`LembreteMeta` e `CampanhasVoz` a cada 5 s, `AutomacaoCobMais` a cada 10 s) para só rodarem com guard de aba visível e com intervalo maior quando não há envio ativo.

## Observações importantes

- As mudanças afetam o custo **a partir do momento em que forem aplicadas** — não recuperam o que já foi consumido. Os $25 gratuitos renovam em **1 Sep 2026**.
- Nenhuma regra de negócio muda: envios, IAGO, lembretes, relatórios e aquecimento continuam funcionando igual. O que muda é a **frequência com que o banco é consultado**.
- Não recomendo aumentar a máquina agora: o gargalo é excesso de chamadas, não falta de capacidade.

## Detalhes técnicos

- Cron jobid 50: schedule `10 seconds` → `* * * * *`; worker `envio-meta-massa-tick` passa a se reagendar durante campanha ativa.
- `src/contexts/EnvioMetaSendingContext.tsx`: `scheduleCarregarItens` deixa de refetch em evento; aplicar patch incremental no estado; `carregarLogs` passa a uma única consulta por janela da campanha.
- Migração: `CREATE INDEX idx_meta_contatos_inbox_default ON meta_whatsapp_contatos (arquivado, ultima_mensagem_em DESC NULLS LAST) WHERE folder_id IS NULL;` + variante com `folder_id`.
- Cron jobid 24: retenção de `cron.job_run_details` de 7 → 2 dias, diária.
