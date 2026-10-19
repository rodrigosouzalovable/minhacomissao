# Etiqueta de atendente no número não oficial (WALLACE 62 8174-6479)

## O que foi encontrado
- Últimos 4 dias: 71 conversas nesse número na caixa PADRÃO. **30 ficaram sem atendente** e, das 41 com etiqueta, **28 caíram todas em Wallace Maciel**.
- Nos números oficiais, cada mensagem recebida passa pelo rodízio da caixa (acordo do cliente → consulta no portal → quem atendeu manualmente → próximo da fila).
- No número não oficial, a mensagem recebida só verifica se o IAGO deve assumir. Como o IAGO está desligado nesse número, **o rodízio nunca é chamado**. As etiquetas existentes vieram de outros caminhos (envio manual, troca manual), por isso o Wallace — que usa o número — concentra as conversas.

## Correção
1. Ao receber mensagem no número não oficial ligado ao Inbox Meta, chamar o mesmo rodízio atômico dos números oficiais, com a mesma ordem de prioridade (acordo, consulta do portal, atendimento manual, fila circular da PADRÃO).
2. Nesses números o IAGO não entra no rodízio: se a vez for dele, passa para o próximo atendente humano.
3. Mensagens enviadas por esse número não valem como "atendeu a conversa" se forem disparo; apenas respostas manuais pelo Inbox, igual aos oficiais.
4. Corrigir as conversas atuais: as 30 sem atendente e ainda não lidas entram no rodízio da PADRÃO; a etiqueta do IAGO (1 conversa) é trocada por um humano. Etiquetas manuais são mantidas. As 28 do Wallace serão mantidas, salvo se você preferir redistribuir (pergunto na aprovação).

## Validação
- Simular uma entrada nesse número com conversa nova e confirmar a etiqueta de um atendente da PADRÃO seguindo a fila, sem IAGO.
- Confirmar que números oficiais e a caixa AQUECIMENTO continuam iguais.

## Detalhes técnicos
- `supabase/functions/whatsapp-chatbot/index.ts` (bloco do espelho, ~linha 1570): quando `iago_desativado`/`inbox_meta_ativo`, chamar `atribuir_atendente_conversa` reutilizando a resolução de prioridade do `meta-whatsapp-webhook` (extrair para `_shared` se necessário).
- Exclusão do IAGO via parâmetro/checagem na atribuição para espelhos UAZAPI.
- Limpeza pontual por instrução de dados. Sem cron, polling ou Realtime novo; custo só proporcional às mensagens do número.
