## Contexto

Os envios da aba **Envio Meta Massa** usam a **WhatsApp Cloud API oficial da Meta**. Diferente da UAZAPI (que pareia um celular), essas mensagens são enviadas server-to-server pela Meta e **não aparecem no aplicativo WhatsApp do celular** — só existem no Meta Business Manager e no Inbox Meta interno. Portanto, o fato de LD 18 / LD 02 / LD 03 não mostrarem mensagens no aparelho é esperado e não indica falha.

O que importa saber é o **status real de entrega** que a Meta devolve via webhook. Hoje o painel "Detalhamento dos envios" mostra apenas "Enviado" (= aceito pela Meta), sem revelar se a mensagem foi *delivered*, *read* ou *failed depois de aceita*.

O webhook `meta-whatsapp-webhook` já grava esses status na tabela `meta_whatsapp_envios_log` (colunas `status` = `sent|delivered|read|failed` e `erro`). Basta cruzar com os itens do job para exibir.

## O que será feito

### 1. Contexto de envio (`src/contexts/EnvioMetaSendingContext.tsx`)
- Estender `EnvioItem` com `deliveryStatus?: 'sent'|'delivered'|'read'|'failed'` e `deliveryErro?: string`.
- Após carregar `envio_meta_job_item`, fazer uma segunda query em `meta_whatsapp_envios_log` filtrando por `user_id` e por `enviado_em >= job.iniciado_em`. Indexar por `telefone` (último registro por telefone).
- No `useMemo` de `detalhes`, casar `it.telefone` normalizado com o log e preencher `deliveryStatus`/`deliveryErro` em cada `EnvioItem` da lista "enviados".
- Expor um contador agregado `deliveryResumo: { aceito, entregue, lida, falhou }` no contexto para uso no painel.
- Atualizar realtime: também escutar `meta_whatsapp_envios_log` (INSERT/UPDATE por `user_id`) para atualizar status ao vivo.

### 2. Painel de detalhes (`src/pages/EnvioMeta.tsx` → `DetalhesEnvioPainel`)
- Adicionar um banner informativo curto no topo do "Detalhamento dos envios":
  > *"Envios pela API oficial da Meta não aparecem no WhatsApp do celular do chip. O status abaixo vem direto da Meta."*
- Na seção "✅ Enviados", ao lado do telefone/instância, mostrar um badge do `deliveryStatus`:
  - `sent` → cinza · "Aceito"
  - `delivered` → azul · "Entregue"
  - `read` → verde · "Lida"
  - `failed` → vermelho · "Falhou" (com tooltip do `deliveryErro`)
  - `undefined` → cinza-claro · "Aguardando…"
- Exibir resumo de contagem no cabeçalho da seção: `599 aceitos · 512 entregues · 340 lidas · 47 falharam`.
- Botão "Atualizar status" ao lado de "Exportar CSV" que força um `carregar()` do contexto (útil se o realtime estiver atrasado).
- Adicionar coluna `delivery_status` e `delivery_erro` ao CSV exportado.

### 3. Nenhuma mudança de backend / schema
Todo o dado já é registrado pelo webhook Meta hoje. Zero mudança em edge functions, políticas RLS, tabelas, cron ou custos.

## Detalhes técnicos

- Match telefone: normalizar via `normalizeTelKey` (já existe no arquivo) e o campo `telefone` do log já vem em formato `55DDDNNNNNNNN`.
- Query do log limitada a `job.total * 2` linhas ou 5000, ordenada por `enviado_em desc`, pegando o registro mais recente por telefone (Map em memória).
- Realtime na tabela `meta_whatsapp_envios_log` filtrada por `user_id=eq.<uid>`; debounce simples para não recarregar em rajada.

## Diagrama de status

```text
send-whatsapp-meta  ──►  Meta API  ──►  wa_message_id (status: sent)
                                              │
                              webhook meta-whatsapp-webhook
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       ▼                      ▼                      ▼
                   delivered                 read                 failed
                (chegou no cel)         (cliente abriu)    (Meta rejeitou/bloqueou)
```

## Fora do escopo
- Reenvio automático dos "failed pós-envio" (posso adicionar em iteração futura se quiser).
- Diagnóstico de saúde das instâncias LD 18/02/03 (rodar `check-meta-instance-health`) — separado deste plano.
