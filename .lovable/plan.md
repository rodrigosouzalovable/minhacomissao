## Diagnóstico dos status

Verifiquei no banco:

- **REJECTED (20 instâncias)** — a Meta aceitou o POST (todas têm `meta_template_id`) e depois reprovou na revisão. É decisão de conteúdo da Meta, não bug do sistema. `motivo_rejeicao` ficou vazio porque a listagem geral de templates da Graph API raramente traz `rejected_reason` — precisamos consultar cada template individualmente (`GET /{template_id}?fields=status,rejected_reason,quality_score,category`).
- **FALHA_ENVIO (LD 06 YASMIM)** — Meta bloqueou já no POST: *"Essa conta do WhatsApp Business não pode criar um novo modelo"*. Causas típicas: WABA sem verificação business, conta em restrição ou limite de templates atingido nessa WABA específica.
- **6 instâncias sem linha** — o lote anterior travou no timeout de 150s antes do fix de background. Agora processa até o fim.

## Correção

1. **Enriquecer o `meta-verificar-status-templates`** para, quando encontrar um filho `REJECTED` sem `motivo_rejeicao`, chamar `GET https://graph.facebook.com/v21.0/{meta_template_id}?fields=status,rejected_reason,quality_score,category` e gravar o motivo real (`INVALID_FORMAT`, `PROMOTIONAL`, `TAG_CONTENT_MISMATCH`, `ABUSIVE_CONTENT`, etc.).
2. **Mostrar o motivo/erro na aba "Aplicar em lote"** — hoje o badge só mostra o status. Vou adicionar um tooltip (ou linha abaixo do nome) exibindo `motivo_rejeicao` para REJECTED e `erro` para FALHA_ENVIO. Isso responde na hora "por que essa foi rejeitada".
3. **Botão "Atualizar motivos agora"** na aba Status, que dispara `meta-verificar-status-templates` sob demanda em vez de esperar o cron de 30 min.
4. **Reprocessar as 6 instâncias faltantes**: elas voltam automaticamente quando você clicar "Enviar para Meta" de novo (o filtro `apenas_falhas` não é necessário — mestre novo, sem linha, entra no lote).

## Fora do escopo agora

- Editar o conteúdo do template mestre para tentar aprovação: uma vez REJECTED com aquele `name`, a Meta pede um nome diferente. Se quiser, posso adicionar depois um botão "Duplicar como novo template" que copia o mestre com sufixo `_v2`.

## Custo

Desprezível — 20 fetches extras (um por template REJECTED) só na próxima verificação; depois fica cacheado no banco.
