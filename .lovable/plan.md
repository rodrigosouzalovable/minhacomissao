## Contexto

Investigação da fatura de R$ 884,10 revelou:

- **2.918 tentativas de envio** desde 02/jul (2.209 com sucesso).
- Apenas **339 registros (12%)** têm `pricing_category` gravado — todos como **UTILITY**. Os outros **2.579 (88%)** estão com `pricing_category = NULL`, então o card "Custo de envios" está chutando o valor em vez de mostrar o que a Meta realmente cobrou.
- Existe um template **`solicitacao_de_renegociacao`** cadastrado como **MARKETING approved** em alguma instância antiga, mesmo que nenhuma instância ativa esteja usando essa versão hoje. Ele aparece selecionável e é um risco: se cair no round-robin, custa 7x mais.

Nenhuma das duas coisas é fraude da Meta — são gaps do nosso lado que impedem você de ver o custo real e de bloquear categoria errada.

## O que vou entregar

### 1) Bloquear categoria MARKETING no envio em massa

- Na aba **Envio Meta → seleção de template**, filtrar a lista para mostrar **apenas templates `categoria = 'UTILITY'`** (approved).
- Adicionar badge amarelo "MARKETING — R$ 0,35/msg" ao lado de qualquer template não-utility, e desabilitar a seleção (com tooltip explicando).
- No backend (`envio-meta-massa-iniciar`), validar antes de criar o job: se o template escolhido tiver alguma versão MARKETING approved, retornar erro pedindo confirmação explícita.
- Rodar um `UPDATE` em `meta_whatsapp_templates` marcando `habilitado_envio_massa = false` em todas as linhas com `categoria='MARKETING'` para não caírem no round-robin nunca mais.

### 2) Registrar `pricing_category` real cobrada pela Meta

Diagnóstico do porquê 88% está NULL:

- O webhook `meta-whatsapp-webhook` já lê `s.pricing.category`, mas a Meta só envia esse campo em **um dos eventos de status** (geralmente `sent` ou `delivered`, não em ambos). Quando um evento posterior chega **sem** `pricing`, o código atual atualiza `status` mas mantém o `pricing_category` (ok). O problema é o oposto: mensagens que **falharam antes** de gerar evento `sent` nunca tiveram `pricing`, e algumas que passaram por Cloud API v20+ trazem o pricing dentro de `s.pricing.pricing_model` como `PMP` sem `category` no mesmo payload — o código então grava `pricing_type` mas deixa `pricing_category` NULL.

Correções no webhook:

- Ampliar leitura para também aceitar `s.pricing.category` em qualquer evento (`sent`, `delivered`, `read`) — hoje já está no loop, mas garantir que roda antes do `break`.
- Ler também `s.conversation.origin.type` (`utility` | `marketing` | `authentication` | `service`) como fallback quando `pricing.category` vier vazio.
- Escrever em UPPERCASE consistente (`UTILITY`, `MARKETING`, `AUTHENTICATION`, `SERVICE`).
- Fazer um **backfill retroativo**: para os 2.579 registros com `pricing_category NULL` cuja `template_nome` bate em `meta_whatsapp_templates.categoria`, copiar a categoria do template (é a melhor aproximação disponível — a Meta pode ter reclassificado, mas cobre 90%+ dos casos).

### 3) Card "Custo real" com dados verdadeiros

- Novo card na página **Envio Meta** (abaixo do card de custo estimado atual) com:
  - Total gasto hoje / este mês / desde o início — **calculado a partir de `pricing_category` real**, não estimativa.
  - Breakdown por categoria (Utility / Marketing / Auth / Service-free) com contagem e valor.
  - Selo "X% dos envios com preço confirmado pela Meta" para deixar claro quando ainda há NULL.
- Valores por unidade (BR): UTILITY R$ 0,04 · MARKETING R$ 0,35 · AUTHENTICATION R$ 0,04 · SERVICE R$ 0,00.

## Detalhes técnicos

**Arquivos a alterar:**

- `supabase/functions/meta-whatsapp-webhook/index.ts` — melhorar captura de `pricing_category` (linhas 550-565), adicionar fallback via `s.conversation.origin.type`.
- `src/pages/EnvioMeta.tsx` — filtrar dropdown de templates por `categoria='UTILITY'`, adicionar badge de aviso.
- `src/hooks/useMetaWhatsAppCusto.ts` — passar a somar `pricing_category` real quando presente, e só cair no estimado quando NULL.
- `src/components/meta/CustoEnvioCard.tsx` — mostrar breakdown e % confirmado.
- `supabase/functions/envio-meta-massa-iniciar/index.ts` — validar categoria do template antes de enfileirar.

**Operações de dados (via insert tool):**

- `UPDATE meta_whatsapp_templates SET habilitado_envio_massa=false WHERE categoria='MARKETING';`
- Backfill: `UPDATE meta_whatsapp_envios_log l SET pricing_category = t.categoria FROM meta_whatsapp_templates t WHERE l.pricing_category IS NULL AND l.template_nome = t.nome_template AND t.status='approved' AND t.categoria IS NOT NULL;`

## O que fica de fora deste plano

- Teto de gasto diário com auto-bloqueio (você não pediu agora — pode ser um próximo passo).
- Confirmação obrigatória antes de disparar em massa (idem).
- Mudar preço nominal usado na estimativa (o card estimado continua existindo para envios sem pricing confirmado, só que agora coexiste com o card de custo real).
