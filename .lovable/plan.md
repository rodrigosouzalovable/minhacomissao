## Objetivo
Na página `/admin/configurar-meta` (aba **API Oficial Meta**), adicionar um botão destacado (ex.: "Ver custos detalhados") que abre um dialog mostrando, minuciosamente, o custo de cada dia, cada conversa e cada mensagem enviada via API oficial da Meta.

## Onde colocar
Em `src/pages/ConfigurarMeta.tsx`, logo abaixo do título "API Oficial Meta WhatsApp" e acima do card `MetaGuardrailCard` (Segurança de Custos). Um card compacto com valor gasto hoje + botão "Ver custos detalhados".

## O que o dialog mostra
Componente novo `src/components/meta/CustosDetalhadosDialog.tsx`, com 3 abas:

### Aba 1 — Por dia (últimos 35 dias)
Fonte: `meta_billing_snapshot` (dados reais cobrados pela Meta).
Tabela com: data · conversas iniciadas · categoria (MKT/UTIL/AUTH/SERVICE) · custo USD · custo BRL · câmbio aplicado. Total do dia em destaque. Ordenado do mais recente. Cada linha expansível mostra o detalhamento por categoria/WABA.

### Aba 2 — Por conversa (hoje + filtro de data)
Fonte: `meta_whatsapp_envios_log` agrupado por `waba_conversation_id` (ou por contato+dia quando não houver). Colunas: hora início · contato · categoria pricing · tipo (`marketing`/`utility`/`authentication`/`service`/`referral_conversion`) · foi_gratis · qtd mensagens · custo estimado. Badge verde quando `foi_gratis=true` (CSW).

### Aba 3 — Por mensagem (hoje + filtro)
Fonte: `meta_whatsapp_envios_log` linha a linha. Colunas: hora · contato · template · `pricing_category` · `pricing_type` · status · foi_gratis · custo unitário estimado (0 se grátis, caso contrário `PRECO_USD[categoria] * fx_rate` do snapshot do dia). Paginação de 100 em 100. Busca por contato/template.

Rodapé fixo do dialog: total do período filtrado em BRL e USD, quantidade grátis vs paga, alerta se divergir mais de 15% do `meta_billing_snapshot` do mesmo dia (indicativo de conversas não fechadas ainda pela Meta).

## Detalhes técnicos
- Reutilizar `PRECO_USD` (MARKETING 0.0625 / UTILITY 0.0068 / AUTH 0.0068 / SERVICE 0) e o `fx_rate` do snapshot do dia (fallback 5.5).
- Botão "Sincronizar com Meta agora" no header do dialog chamando a edge function existente `meta-billing-sync` (mesma usada em `MetaBilling.tsx`), para forçar refresh antes de inspecionar.
- Link secundário "Ver histórico completo" apontando para a página existente `/admin/meta-billing` (não duplicar aquela tela; o dialog é resumo minucioso do dia-a-dia inline).
- Queries com `staleTime` alto e paginação para respeitar a regra de custo Cloud (memória Core "ALERTA DE CUSTO ALTO").
- Sem novas tabelas, sem cron novo, sem edge functions novas.

## Fora de escopo
- Nenhuma mudança em `client.ts`, `types.ts`, `.env`, `config.toml`.
- Nenhuma alteração no motor de envio, nas categorias de templates ou no webhook.
- Sem novas migrations.

## Arquivos afetados
- `src/pages/ConfigurarMeta.tsx` — adicionar card com botão.
- `src/components/meta/CustosDetalhadosDialog.tsx` — novo componente.

⚠️ **ALERTA DE CUSTO ALTO LOVABLE CLOUD**: impacto mínimo. Só lê tabelas já existentes (`meta_billing_snapshot`, `meta_whatsapp_envios_log`) sob demanda quando o dialog abrir, com paginação e `staleTime` alto. Sem cron/polling/realtime novo.
