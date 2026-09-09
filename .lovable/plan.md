# Fazer a campanha respeitar os 3–6s configurados

## O que os dados mostram (campanha UME + NOVO MUNDO 10)

- Configurado: 3–6s (teórico ~1 msg / 4,5s). 2376 destinatários, 250 processados.
- Intervalo real entre envios: mediana **13,2s**, média **17,6s**, mínimo **4,5s**, 90% até **33s**, máximo 122s.
- Ritmo por minuto nos últimos 25 min: entre 1 e 9 envios/min (média ~3,7/min ≈ 16s).

O mínimo de 4,5s prova que o relógio do delay funciona. O problema é o **tempo gasto em cada envio**, que se soma ao delay:

1. Cada item faz ~10 idas e voltas em sequência antes de dormir o delay: checar status do job, buscar o pendente, reabilitar instâncias recuperadas, checar queda de qualidade, escolher a instância (`pick-meta-instance`), reservar o item, atualizar o job, chamar a Meta (`send-whatsapp-meta`), gravar o item, gravar contadores. Com 3–6s configurados, o custo fixo domina o ritmo.
2. O delay só começa a contar **depois** de todo esse trabalho — ou seja, o intervalo real é "processamento + 3 a 6s", nunca 3 a 6s.
3. A validação de WhatsApp durante o envio roda em blocos de 30 números e é **bloqueante**: a cada ~30 contatos a campanha para para consultar as UAZAPI conectadas. Hoje ainda há 2105 pendentes sem validação, então isso vai continuar acontecendo em todo o resto da campanha.
4. Cada execução tem orçamento de 120s; ao esgotar, devolve para o agendador que roda a cada 10s — o que cria as pausas grandes (máximo observado 122s).

## Correção

1. **Delay passa a ser o intervalo real**: o tempo gasto no processamento do item é descontado do delay sorteado. Se o envio levou 5s e o sorteio deu 4s, o próximo sai imediatamente; se levou 1s, espera os 3s restantes. Assim o ritmo fica igual ao configurado, sem nunca ficar abaixo do mínimo pedido.
2. **Validação de WhatsApp deixa de travar a fila**: o bloco de 30 números é validado em segundo plano (e com bloco maior, ~100), enquanto o envio segue. Números sem WhatsApp continuam marcados e não recebem mensagem.
3. **Menos idas e voltas por envio**: reaproveitar o estado do job já carregado no laço, checar reabilitação/qualidade das instâncias no máximo a cada 2 minutos (em vez de a cada item), unir as gravações de item/contadores e buscar o próximo pendente junto com a gravação do anterior.
4. **Execução mais longa e contínua**: orçamento por execução de 120s → 240s, para reduzir os retornos ao agendador de 10s que causam as pausas de 30–120s.
5. **Sem mudança nas regras de segurança**: janela de horário, domingo, saída de YELLOW/RED, blacklist, cotas e freios continuam exatamente como estão.

Efeito esperado nesta campanha: ritmo de ~16s por mensagem para ~5s, e a previsão de término dos ~2100 restantes cai de ~11h30 para cerca de 3h.

## Aviso de custo (Lovable Cloud)

Não cria cron, tabela nem polling novo. O envio já fica ativo durante o delay hoje; a mudança aumenta um pouco o tempo de função ativa por execução, mas a campanha termina em muito menos tempo — o custo total tende a ficar igual ou menor. A validação em segundo plano usa as mesmas chamadas de hoje, só sem travar a fila.

## Detalhes técnicos

- `supabase/functions/envio-meta-massa-tick/index.ts`:
  - `processarItem` retorna também o tempo de processamento; no laço do `Deno.serve`, `sleep(max(0, delayMs - gastoMs))`.
  - `validarLotePendentes`: chamada sem `await` (fire-and-forget com guarda de concorrência por job), `VAL_LOTE` 30 → 100; envio não espera resultado.
  - Cache em memória por job para `reabilitarInstanciasRecuperadas` e `removerInstanciasComQuedaQualidade` (TTL 120s).
  - Remover o `jobEstaRodando` redundante (o job recém-lido no laço já traz o status) e fundir os `update` de `atual_telefone`/`falhas_por_instancia_run` no bump final.
  - `ORCAMENTO_MS` 120_000 → 240_000; `DELAY_CURTO_MS` mantido em 25s.
- Sem migração, sem alteração de frontend (a previsão de término se ajusta pelo ritmo real).
