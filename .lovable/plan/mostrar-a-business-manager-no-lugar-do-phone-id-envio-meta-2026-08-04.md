# Mostrar a Business Manager no lugar do Phone ID (Envio Meta)

No diálogo "Instâncias" da aba Envio Meta, cada card mostra hoje o telefone de exibição ou, quando ele não existe, o Phone Number ID cru (ex.: `1207642279102534 • 79/250 hoje`). Essa linha passa a mostrar a Business Manager vinculada à instância, conforme já configurado/sincronizado na aba API oficial Meta.

## O que muda

- A linha de cada instância passa a exibir: `BM: <nome da Business Manager> • 79/250 hoje`.
- Se a instância tiver telefone de exibição, ele continua aparecendo antes da BM (ex.: `62 8147-4451 • BM: Souza e Ribeiro • 79/250 hoje`).
- Se a instância não tiver Business Manager vinculada, aparece `BM: não vinculada` — o Phone ID não volta a aparecer.
- Nenhuma mudança em envio, seleção, saúde ou round-robin.

## Detalhes técnicos

- `src/pages/EnvioMeta.tsx`:
  - Incluir `meta_bm_id` no tipo `Instancia` (o select já usa `*`).
  - Carregar `meta_business_managers` (`id, nome, business_id`, ativos) junto do carregamento inicial das instâncias e guardar num estado/mapa `id -> nome`.
  - Substituir `{i.display_phone || i.phone_number_id}` pela composição telefone + rótulo da BM resolvido pelo mapa.
- Sem migração de banco e sem alteração em edge functions: a coluna `meta_whatsapp_instances.meta_bm_id` e a tabela `meta_business_managers` já existem e são as mesmas usadas em ConfigurarMeta.
