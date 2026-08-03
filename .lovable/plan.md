# Um único atendente por conversa (Inbox Meta oficial)

## Diagnóstico (confirmado no banco)

Hoje 74 conversas têm mais de uma etiqueta "Atendente: ...". Das 540 conversas com atendente:

- 62 casos: uma etiqueta veio automática (`auto_atendente`) e outra foi aplicada **manualmente** pelo menu de contexto. O menu permite marcar quantos atendentes quiser — não existe regra de exclusividade.
- 12 casos: **duas automáticas**. O webhook checa "já tem atendente?" antes de inserir, mas quando duas mensagens do mesmo contato chegam quase juntas as duas checagens passam e ambas gravam (condição de corrida).

Ou seja: não é problema de exibição, são dois vínculos reais no banco.

## O que será feito

1. **Regra de exclusividade no banco**
   - Índice único parcial garantindo no máximo 1 etiqueta de atendente por contato, para que nem corrida de webhook nem clique duplo consigam gravar a segunda.
   - Implementação: coluna/flag `is_atendente` na tabela de etiquetas (derivada do prefixo "Atendente:") + índice único em `(contato_id)` restrito aos vínculos de atendente; ou, se preferível, trigger `BEFORE INSERT` que remove o vínculo de atendente anterior antes de gravar o novo.

2. **Limpeza dos 74 casos atuais**
   - Manter apenas uma etiqueta por conversa, com esta prioridade: vínculo `auto_atendente` mais antigo (o que veio de acordo/consulta no portal); se não houver automático, manter o manual mais antigo. Os demais vínculos de atendente são removidos.

3. **Menu de contexto passa a ser "trocar atendente"**
   - `src/components/inbox/meta/MetaConversaContextMenu.tsx`: ao marcar um atendente, o anterior é substituído (não somado). Se o vínculo atual for `auto_atendente`, mantém a trava atual — apenas admin pode trocar.
   - As demais etiquetas (não atendente) continuam funcionando como múltipla escolha.

4. **Webhook à prova de corrida**
   - `supabase/functions/meta-whatsapp-webhook/index.ts`: tratar a violação do índice único como "já tem atendente" (ignorar silenciosamente), em vez de logar erro.

5. **Segurança na exibição**
   - `src/pages/InboxMeta.tsx`: ao montar as etiquetas de cada conversa, exibir no máximo um chip de atendente (o primeiro pela regra de prioridade), evitando que qualquer resíduo antigo volte a aparecer duplicado na lista.

## Resultado

Cada conversa do Inbox Meta mostra exatamente uma etiqueta de atendente; trocar de atendente substitui a anterior, e o sistema não consegue mais gravar duas.
