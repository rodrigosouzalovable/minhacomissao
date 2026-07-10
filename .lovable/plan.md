## Objetivo
Reconfigurar as credenciais globais da UAZAPI usadas pelas edge functions (criar instância, QR code, webhook global, etc.).

## O que será feito
1. Gravar/atualizar dois secrets do backend com os valores fornecidos:
   - `UAZAPI_SERVER_URL` = `https://meusacordos.uazapi.com`
   - `UAZAPI_ADMIN_TOKEN` = `X50BRgJYqVAby9HQFzBxMGKmCLruzKLS56mf4CvlUzDXXl7iHn`
2. Como esses secrets provavelmente já existem, o fluxo será: tentar `set_secret` primeiro; se algum já estiver criado, usar `update_secret` (abre formulário seguro) só para o que restar.
3. Nenhum código será alterado — as edge functions já leem `Deno.env.get("UAZAPI_SERVER_URL")` e `UAZAPI_ADMIN_TOKEN`.

## Fora do escopo
- Não altera limite de instâncias na UAZAPI (isso continua sendo suporte da UAZAPI).
- Não mexe em `user_whatsapp_instances` (tokens por instância dos funcionários permanecem).

## Recomendação de segurança
Você colou o Admin Token no chat. Assim que confirmar que o sistema voltou a funcionar, **rotacione esse token no painel UAZAPI** e me peça pra atualizar de novo — dessa vez pelo formulário seguro.
