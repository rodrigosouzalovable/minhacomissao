# Corrigir falhas vermelhas na campanha Meta

## Diagnóstico confirmado

- A bolinha vermelha ao lado do horário significa **falha de entrega**: a Meta aceitou inicialmente o envio, mas depois devolveu o status de erro.
- Nas últimas 2 horas foram registradas **98 mensagens com erro**; **97** têm o motivo `Business Account locked`.
- A campanha atual **QUEBRADOS** está rodando, mas já tentou reenviar alguns contatos por números diferentes.
- O mesmo bloqueio está atingindo vários números das BMs **BM Rodrigo Ribeiro (Facebook Avatus)** e **Facebook Edna**, inclusive números que ainda aparecem como GREEN/ativos. Portanto, qualidade GREEN não garante que a BM esteja autorizada a enviar.
- O sistema já retira um número depois da falha, porém ainda tenta outros números da mesma BM bloqueada. Isso gera várias bolinhas vermelhas para o mesmo contato antes de encontrar uma conta saudável.

## Correção

1. **Reconhecer bloqueio por BM, não apenas por número**
   - Ao receber `Business Account locked (#131031)`, identificar a BM vinculada ao número.
   - Retirar imediatamente da campanha atual todos os números pertencentes à mesma BM.
   - Marcar essas instâncias como restritas até a Meta confirmar a liberação.

2. **Evitar novas tentativas inúteis no mesmo contato**
   - O contato continuará na fila somente se existir número disponível de outra BM saudável.
   - Nunca tentar novamente em outro número da BM que acabou de apresentar o bloqueio.
   - Manter o limite atual de tentativas e não duplicar mensagens já entregues.

3. **Reforçar a seleção antes de cada envio**
   - Excluir números e BMs já bloqueados na campanha, mesmo quando a leitura de qualidade ainda estiver GREEN.
   - Preservar as regras atuais de YELLOW/RED, pool, saldo, horário, domingo e round-robin.

4. **Melhorar a explicação no Inbox e nos detalhes da campanha**
   - Manter a bolinha vermelha nas mensagens que realmente falharam; elas não podem ser convertidas em entregues.
   - Ao passar sobre o ícone, mostrar o motivo amigável: “Não entregue — Business Manager bloqueado pela Meta”.
   - Nos detalhes da campanha, agrupar as falhas por BM e mostrar quantos números foram retirados.

5. **Validar com dados reais**
   - Publicar as funções envolvidas no envio e no retorno de status da Meta.
   - Confirmar que um novo `#131031` bloqueia toda a BM na campanha, que o contato migra apenas para outra BM saudável e que não surgem novas tentativas repetidas.

## Observação importante

As 97 mensagens já marcadas com vermelho realmente não foram entregues e permanecerão assim no histórico. A correção impedirá que o bloqueio continue se multiplicando; a liberação definitiva dessas BMs depende da Meta.

## Custo

Sem novo agendamento, consulta periódica ou canal em tempo real. A correção reaproveita o processamento atual e tende a reduzir chamadas e custos ao eliminar tentativas inúteis.
