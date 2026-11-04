# IAGO atendendo a caixa "Odres Amaral" (Tiago Nogueira)

## O que acontece hoje
O IAGO foi marcado como atendente da caixa "Odres Amaral", mas o atendimento automático tem uma trava: ele só responde conversas da caixa PADRÃO (por rodízio) e da AQUECIMENTO. Qualquer outra caixa é ignorada com o motivo "IAGO restrito às caixas PADRÃO e AQUECIMENTO" — por isso nada acontece na caixa do Tiago.

## O que vou mudar
- Liberar o IAGO em qualquer caixa onde ele estiver marcado como atendente (como na tela da imagem). Caixas onde ele não estiver marcado continuam sem IA.
- Nessas caixas ele funciona como na PADRÃO: entra no rodízio, responde o cliente, gera boleto/PIX quando pedido e, se precisar de humano, transfere para os atendentes humanos daquela mesma caixa (nunca para atendentes de outras caixas).
- Mantidas sem alteração: AQUECIMENTO (respostas curtas, sem transferência), Clara exclusiva do CERTIFICADO, proteção da etiqueta do Rodrigo, prioridade do humano já vinculado ao telefone, leads do Google Maps fora do IAGO.
- O credor usado nas respostas segue o da conversa/caixa (Odres Amaral → Odres Cred), sem citar UME.

## Detalhes técnicos
- `iago-atendimento`: trocar a trava `!modoCaixaPadrao && !modoAquecimento` por verificação `iagoAtendeCaixa(supabase, iago.id, folderId)` para caixas personalizadas; transferências e textos "rodízio da caixa PADRÃO" passam a usar a caixa real.
- Conferir a função de rodízio do banco (`atribuir_atendente_rodizio`/membros da caixa) para permitir o IAGO como próximo da fila fora da PADRÃO e escolher humanos só da mesma caixa.
- Conferir `iago-followup-tick` para aplicar o mesmo critério.
- Atualizar a regra do projeto "IAGO rotates in PADRÃO only" para "PADRÃO e caixas onde estiver marcado".
- Validar enviando uma chamada de teste para uma conversa da caixa Odres Amaral e ler os logs.

Sem custo extra relevante: nenhuma rotina nova, apenas respostas nas conversas que já chegam.
