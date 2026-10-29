# Corrigir "Janela de 24h fechada" no envio de arquivo para números internacionais

## Causa (confirmada)
A Fabiola tem número do Reino Unido (+44 7469 094835). A conversa está com a janela aberta (última mensagem dela às 12:48 de hoje). Mas, ao enviar um arquivo, o sistema coloca "55" na frente de todo número que não começa com 55, e o número vira 55447469094835. Esse número não existe nos contatos, então o sistema acha que a cliente nunca escreveu e bloqueia o envio dizendo que a janela está fechada.

## Correção
- Só colocar o "55" quando o número tiver até 11 dígitos (DDD + número brasileiro sem código do país). Números com 12 dígitos ou mais já trazem o código do país e ficam como estão.
- Aplicar a mesma regra no envio de arquivo e no envio de texto do Inbox, para que nenhum número internacional seja alterado.
- Na verificação da janela de 24h, se o contato não for encontrado pelo número exato, procurar também pelos últimos 8 dígitos na mesma instância (padrão do sistema), antes de bloquear.

## Detalhes técnicos
- `supabase/functions/send-whatsapp-meta-media/index.ts` e `send-whatsapp-meta-text/index.ts`: `formatTel` passa a prefixar 55 somente se `d.length <= 11`.
- Verificação da janela: fallback `like '%<sufixo8>'` em `meta_whatsapp_contatos` filtrado por `instancia_id`, usando o contato mais recente.
- Validar enviando novamente o PDF para a Fabiola.
