# Erro #131053 (Media upload error) no disparo Meta

## O que o erro significa

`#131053 Media upload error` é a Meta dizendo: **eu não consegui baixar/processar a imagem do cabeçalho do template no momento do envio**. Não é bloqueio de conta nem template pausado — é falha na mídia.

Hoje o sistema envia a imagem como **link público a cada mensagem**: em cada envio a Meta tenta baixar a URL de novo. Se o link expirar, demorar, ou a Meta receber muitos downloads simultâneos (rajada), ela devolve #131053 — e por isso o erro aparece de forma intermitente (só 8 falhas no meio de milhares).

Causa provável identificada no código: a URL gravada no template vem de uma **URL assinada com validade** (`mediaSignedUrl` em Templates HSM). Quando a assinatura vence, ou quando a Meta tenta baixar sob carga, o download falha.

## Sim, dá para corrigir do nosso lado

Três frentes, em ordem de impacto:

1. **Usar URL pública permanente em vez de URL assinada**
   Gravar no template a URL pública do arquivo no storage (sem expiração), não a URL assinada. Elimina a causa mais provável do #131053.

2. **Fazer upload da imagem para a Meta uma única vez e reutilizar o ID**
   Em vez de mandar `image: { link }` em cada mensagem, subir a imagem para a Meta uma vez por instância, guardar o `media_id` retornado e enviar `image: { id }` nos disparos. A Meta deixa de baixar nada durante o disparo — é o padrão usado em envios em massa e remove a fragilidade por completo. O `media_id` é revalidado/renovado automaticamente quando expira ou é rejeitado.

3. **Retry automático em #131053 em vez de marcar como falha**
   Tratar #131053 como erro temporário: devolver o contato para a fila e tentar de novo (até 2 vezes, com pequeno intervalo), como já é feito com rate limit. Assim falhas isoladas não deixam contatos sem receber.

Complemento: mensagem amigável dedicada para #131053 ("A Meta não conseguiu baixar a imagem do template neste envio; o contato será reenviado automaticamente").

## Detalhes técnicos

- `supabase/functions/send-whatsapp-meta/index.ts` → `buildMetaComponents`: passa a resolver `media_id` (cache por instância + template) e usar `{ type: 'image', image: { id } }`, com fallback para `link` se o upload falhar.
- Novo campo de cache do `media_id` (e validade) em `meta_templates_instancia.variaveis` — sem nova tabela.
- Upload via endpoint `/{phone_number_id}/media` com o token da instância; reaproveita a lógica já existente em `send-whatsapp-meta-media`.
- `src/pages/MetaTemplates.tsx`: gravar URL pública em `_header_image_url` em vez de URL assinada.
- Workers `envio-meta-massa-tick` / `envio-meta-massa-burst`: classificar `#131053` como retryable (contato volta a `pendente`, `tentativas + 1`, limite 2).
- `src/lib/humanizarErroEnvio.ts`: entrada específica para `#131053`.

## Fora do escopo

Nenhuma alteração no ritmo de envio, nos filtros de qualidade ou nas travas de custo.
