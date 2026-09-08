# Por que as instâncias GREEN saíram do rodízio da campanha "UME + NOVO MUNDO 9" — e como corrigir

## O que realmente aconteceu (verificado nos dados)

A Meta **não** bloqueou esses números por qualidade nem por pendência de pagamento. O que aconteceu:

- Hoje, entre **08:02 e 08:10 (BRT)**, a Meta aceitou as mensagens mas devolveu o status de entrega com o erro **"Business Account locked"** (conta comercial travada — o mesmo travamento de conta/cobrança que você já regularizou).
- O sistema tem uma regra própria: **3 falhas de entrega seguidas → a instância sai do rodízio daquela campanha**. Cada um desses números levou 3 falhas nesse intervalo de 8 minutos e foi retirado.
- Checando agora a saúde direto na Meta: 7 desses números estão **GREEN, conectados, nome aprovado, "pode enviar: disponível", limite 10.000/dia**. Ou seja, o motivo já passou, mas eles continuaram fora.
- Três números da campanha realmente estão limitados pela Meta: **8270-2300 (RED)**, **8269-3506 (RED)** e **8270-2314 (YELLOW)** — esses são bloqueios legítimos.
- A campanha ficou em espera com a mensagem "todas as instâncias saíram do envio" e **853 contatos ainda pendentes**, porque a lista de instâncias retiradas nunca é reavaliada: uma vez fora, só voltava se você clicasse manualmente em "Voltar".

Resumo: foi um travamento temporário da conta na Meta que virou uma exclusão permanente dentro da campanha.

## O que vou corrigir

1. **Guardar o motivo real da saída** de cada instância (travamento de conta, entrega recusada, qualidade), em vez do rótulo genérico "falhas consecutivas".
2. **Recolocar sozinho as instâncias saudáveis**: quando a campanha for reavaliada, o sistema confere a saúde direto na Meta e devolve ao rodízio as instâncias que saíram por motivo temporário (conta travada, limite momentâneo) e que a Meta confirma como disponíveis e GREEN. Quem está YELLOW/RED ou com bloqueio real continua fora.
3. **Retomar campanhas paradas**: uma campanha em espera volta a enviar assim que houver instância recuperada, sem precisar recriar nada. A "UME + NOVO MUNDO 9" retoma os 853 contatos restantes.
4. **Zerar o contador de falhas** da instância recolocada, para ela não sair de novo por falhas antigas.
5. **Aviso no WhatsApp** quando uma instância for recolocada, informando o motivo da saída e que voltou.
6. **Mostrar o motivo no painel de instâncias da campanha**: em vez de "falhas consecutivas" para todos, o texto exato ("conta travada na Meta", "qualidade RED", etc.), mantendo o botão "Voltar" do administrador.

## Detalhes técnicos

- Motivo por instância gravado em `envio_meta_job.falhas_por_instancia_run` (chave `mot:<instancia_id>`), sem mudança de banco.
- `meta-whatsapp-webhook`: ao cortar por falha de entrega, registra o motivo e o código Meta.
- `envio-meta-massa-tick`: nova etapa de reabilitação antes de escolher a instância — chama `check-meta-instance-health` para as retiradas por motivo temporário e as remove de `instancias_bloqueadas_run` quando a Meta responde `can_send_message = AVAILABLE` e qualidade GREEN.
- `CampanhaInstanciasPanel.tsx` / `CampanhaDetalheDialog.tsx`: exibem o motivo real.
- Sem novo cron, sem novo Realtime, sem query extra por contato — a checagem roda apenas nas reavaliações de 5 min já existentes e só para instâncias retiradas. Impacto de custo desprezível.

## Verificação

- Rodada forçada da campanha para confirmar que as 7 instâncias GREEN voltam ao rodízio e o envio dos 853 contatos continua.
- Conferir que 8270-2300, 8269-3506 e 8270-2314 permanecem fora.
