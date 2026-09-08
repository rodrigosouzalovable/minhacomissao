# Campanha lenta + liberar YELLOW/RED por campanha iniciada manualmente

## 1. Por que a campanha de 3–8s está lenta (medido agora)

Campanha "UME + NOVO MUNDO 9" (669 contatos, 3–8s configurados, 71 enviados):

- Intervalo real entre envios: mediana 9,7s, média 46,7s, máximo 220,9s.
- Distribuição dos 73 intervalos: 37 até 10s, 16 entre 10–20s, 2 entre 20–40s, 4 entre 40–120s e **14 acima de 120s**.
- Esses 14 intervalos longos somam 43 minutos — cerca de 75% de todo o tempo gasto pela campanha. O resto está próximo do configurado.

Causa confirmada no código: antes de cada envio, o motor da campanha para e revalida a saúde de todas as instâncias na Meta uma vez a cada 5 minutos, **esperando resposta de uma em uma** (17 instâncias nesta campanha = 17 chamadas à Meta em fila) e, quando há instâncias fora, faz outra rodada igual para tentar recolocá-las. Enquanto isso, nenhuma mensagem sai. Daí os buracos de 2 a 4 minutos a cada ~5 minutos, exatamente como aparece nos dados.

Somam-se dois efeitos menores: a escolha da instância consulta contadores de uso número por número (também em fila), e o intervalo real é sempre "tempo de processamento + delay sorteado", então qualquer lentidão de processamento aparece como delay maior do que 3–8s.

### Correção

- A revalidação de saúde e a reabilitação de instâncias deixam de bloquear o envio: as chamadas passam a ser disparadas em paralelo e sem esperar resposta; a decisão de tirar/recolocar número usa a última leitura já gravada no banco. Efeito: o envio nunca mais fica parado esperando a Meta responder.
- A contagem de uso por instância na escolha do próximo número passa a ser feita em paralelo (uma consulta agregada por conjunto de instâncias em vez de duas por número).
- O controle de "no máximo 1 rodada de checagem a cada 5 min" passa a ficar gravado na própria campanha, e não na memória da execução — hoje, cada reinício de execução podia repetir a rodada antes dos 5 minutos.
- Resultado esperado nesta campanha: ritmo passa de ~1 msg/47s para ~1 msg/7–9s, e a previsão de término dos 598 restantes cai de ~7h48 para ~1h20.

## 2. Usar instâncias YELLOW/RED quando a campanha é iniciada manualmente

Situação real hoje: a chave global "Liberar YELLOW/RED" já está ligada, então o usuário consegue **iniciar** com números YELLOW/RED. O que derruba o uso é o motor: no meio da campanha, todo número que estiver YELLOW ou RED é retirado do rodízio automaticamente, independentemente da chave. Foi isso que aconteceu com as instâncias do Thiago.

Mudança:

- A campanha passa a guardar se foi iniciada manualmente com números de qualidade baixa selecionados de propósito. Nesse caso, YELLOW/RED **permanecem** no rodízio até o fim da campanha, com ritmo reduzido (peso menor no round-robin, como já existe).
- Continuam saindo da campanha, mesmo assim: número banido, restrito, conta bloqueada, pendência de pagamento, nome de exibição reprovado e cota real da Meta esgotada.
- Campanhas agendadas/automáticas seguem a regra atual (queda para YELLOW/RED tira o número).
- O aviso no WhatsApp muda de tom nessas campanhas: informa a queda de qualidade, mas diz que o número segue enviando por escolha manual.

## 3. Aba Instâncias no Envio Meta

"Selecionar todas" continua marcando **apenas** números sem nenhum problema (conectados, nome aprovado, BM com saldo e qualidade GREEN) — YELLOW, RED e sem leitura ficam de fora e só entram se marcados manualmente. Isso já é o comportamento atual e será mantido; apenas o texto de ajuda passa a explicar que YELLOW/RED marcados à mão continuarão na campanha até o fim.

## Aviso

Disparar volume com números RED/YELLOW tende a piorar a qualidade e pode levar a restrição ou banimento pela Meta. Recomendo volume baixo nesses números.

## Custo (Lovable Cloud)

Sem novo cron, nova tabela pesada, novo polling ou Realtime. A mudança reduz chamadas à Meta e consultas por envio, então o efeito no custo é neutro a levemente menor.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`: em `removerInstanciasComQuedaQualidade` e `reabilitarInstanciasRecuperadas`, trocar o `for … await fetch(check-meta-instance-health)` por disparo paralelo sem `await` (fire-and-forget) e decidir pelo estado já persistido; mover o controle de intervalo dos `Map` em memória (`ultimaChecagemSaude`, `ultimaReabilitacao`) para colunas/keys no próprio job; respeitar a nova flag do job antes de bloquear YELLOW/RED.
- Migração: `alter table public.envio_meta_job add column permitir_qualidade_baixa boolean not null default false, add column saude_checada_em timestamptz, add column reabilitacao_checada_em timestamptz;` (sem novas tabelas, GRANT/RLS existentes já cobrem a tabela).
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: gravar `permitir_qualidade_baixa = true` quando o job é criado manualmente e alguma instância selecionada não é GREEN.
- `supabase/functions/pick-meta-instance/index.ts`: substituir os `await enviadosHojeBrt/enviadosUltimaHora` por instância por consultas agregadas para todas as candidatas (`_shared/meta-freio.ts` ganha versões em lote).
- `src/pages/EnvioMeta.tsx`: apenas ajuste do texto/tooltip de "Selecionar todas (GREEN)"; lógica de seleção mantida.
