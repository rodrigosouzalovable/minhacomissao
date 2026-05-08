## Objetivo

Criar a Edge Function reutilizável `get-group-jid` que consulta a UAZAPI e retorna a lista de grupos (nome + JID) de uma instância. Em seguida, executar para a instância **62981810202 IPHONE B1 08/05** (`80246258-c679-4637-b97c-0ad4fb496e6a`) — onde foi criado o grupo "Família Souza e Ribeiro" e que será a admin do aquecimento em grupo.

> Obs.: não existe nenhum registro em `whatsapp_aquecimento_grupos` ainda (tabela vazia). Vou usar essa instância como referência por ser a que você citou na mensagem anterior. Se quiser outra, me avise.

## O que vai ser criado

### 1. `supabase/functions/get-group-jid/index.ts`

- Aceita `POST` com `{ instance_id: uuid }` (ou `instance_name` opcional para fallback).
- Busca `server_url` e `instance_token` em `user_whatsapp_instances`.
- Tenta endpoints UAZAPI em ordem, com header `token: <instance_token>`:
  1. `GET  /group/list`
  2. `POST /group/list` (algumas builds aceitam só POST)
  3. `GET  /chat/getGroups`
  4. `GET  /instance/groups`
  5. `GET  /instance/groupsList`
- Normaliza a resposta para o formato:
  ```json
  {
    "ok": true,
    "endpoint_used": "/group/list",
    "instance_id": "...",
    "instance_name": "62981810202 IPHONE B1 08/05",
    "total": 12,
    "groups": [
      { "jid": "1203630...@g.us", "nome": "Família Souza e Ribeiro", "participants_count": 8, "is_admin": true }
    ]
  }
  ```
- Suporta filtro opcional `name_contains` para já devolver só o grupo procurado.
- CORS completo + `verify_jwt = false` em `supabase/config.toml`.
- Tratamento padrão UAZAPI: se voltar "disconnected", responde HTTP 200 com `{ ok:false, fallback:true, reason:"disconnected" }` (regra de resiliência do projeto).

### 2. Registro em `supabase/config.toml`

Adicionar bloco:
```toml
[functions.get-group-jid]
verify_jwt = false
```

### 3. Execução imediata via `supabase--curl_edge_functions`

Chamar a função recém-criada com:
```json
{ "instance_id": "80246258-c679-4637-b97c-0ad4fb496e6a", "name_contains": "souza" }
```
e devolver no chat o JID do grupo "Família Souza e Ribeiro" (ou de "Aquecimento WhatsApp", se você confirmar outra instância).

## Como reutilizar depois

Você pode chamar de qualquer lugar:

```ts
const { data } = await supabase.functions.invoke("get-group-jid", {
  body: { instance_id: "<uuid>", name_contains: "opcional" }
});
```

Ou via curl (admin):
```bash
curl -X POST https://cymdrkeukockakfzjeen.supabase.co/functions/v1/get-group-jid \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"instance_id":"<uuid>"}'
```

## Pontos que preciso confirmar antes de implementar

1. Você disse "instância que está no grupo Aquecimento WhatsApp", mas no banco a tabela `whatsapp_aquecimento_grupos` está **vazia**. Confirma que devo rodar para a **62981810202 IPHONE B1 08/05** (do contexto anterior, grupo "Família Souza e Ribeiro")?
2. Pode aprovar para eu já criar e executar?
