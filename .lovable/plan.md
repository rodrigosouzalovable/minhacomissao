## Problema

O botão "Enviar para Meta" chama `supabase.functions.invoke("meta-criar-template-lote")`, mas a função retorna **404 NOT_FOUND** — o código está no repositório (`supabase/functions/meta-criar-template-lote/index.ts` e `meta-verificar-status-templates/index.ts`), porém as funções nunca foram publicadas no ambiente. É por isso que o toast mostra "Failed to send a request to the Edge Function".

## Correção

1. Fazer o deploy das duas edge functions que já existem:
   - `meta-criar-template-lote` (a que o botão chama)
   - `meta-verificar-status-templates` (usada pelo cron de status)
2. Validar com um POST direto na função para garantir que responde `200` (com o `mestre_id` real seria enviado à Meta; para o teste uso um id inválido só para confirmar que roda e retorna JSON).
3. Se o deploy falhar por causa do `deno.lock` (problema comum em edge-runtime), removê-lo e refazer.

Nenhuma mudança de código é necessária — a lógica atual já está correta e as GRANTs no banco foram aplicadas na mensagem anterior.

## Custo

Zero adicional além do que já foi planejado — as funções já estavam previstas.
