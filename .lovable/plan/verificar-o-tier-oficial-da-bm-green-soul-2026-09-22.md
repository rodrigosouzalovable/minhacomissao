# Verificar o tier oficial da BM Green Soul

## Objetivo
Confirmar se o novo token da Green Soul já permite ler diretamente da Meta o limite oficial de mensagens do portfólio empresarial.

## Execução
1. Acionar a verificação de saúde somente nas instâncias ativas vinculadas à Green Soul.
2. Conferir a resposta da Meta para o campo oficial `whatsapp_business_manager_messaging_limit`.
3. Validar se o limite foi registrado na BM e nas instâncias com data de sincronização atualizada.
4. Informar o tier retornado ou, se ainda falhar, apontar exatamente qual requisito está pendente: acesso do token à BM, vínculo do portfólio ou permissão.

## Regra já confirmada
Com um token válido, acesso à BM e a permissão `business_management`, o sistema consegue sincronizar automaticamente o limite oficial. Esse limite pertence à BM/portfólio empresarial e é compartilhado pelos números vinculados; não é um tier separado por número. A atualização automática só substitui o valor quando o tier não está marcado como manual.
