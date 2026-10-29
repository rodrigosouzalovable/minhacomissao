# Etiqueta automática RODRIGO para acordos à vista do portal

## O que muda
Quando um cliente fechar um acordo **à vista (1x)** pelo portal de negociação, a conversa dele no Inbox recebe a etiqueta **"Atendente: RODRIGO RIBEIRO DE SOUZA"**:
1. No envio da mensagem de confirmação do portal (template `confirmacao_acordo_portal` pelo número 3144).
2. Quando o cliente mandar mensagem ao Inbox e tiver acordo à vista do portal ativo (cobre casos em que a confirmação falhou ou ele escreve de outro número/caixa).

Regras:
- Só acordos à vista feitos no portal; parcelados seguem como hoje.
- Se a conversa já tiver outra etiqueta de atendente, ela é trocada pela do Rodrigo apenas se for um acordo à vista do portal (sem duplicar etiqueta).
- Usa a etiqueta já existente; nada é criado novo. Busca por sufixo de 8 dígitos.
- Sem custo extra: uma consulta curta por mensagem recebida, usando índice.

## Detalhes técnicos
- `_shared/portal-confirmacao-cliente.ts`: após envio OK com `parcelas === 1`, gravar vínculo em `meta_whatsapp_contato_etiquetas` com a etiqueta `03a9298c-…` (dono ee649720).
- Novo helper `_shared/etiqueta-portal-avista.ts` reutilizado pelo envio e por `meta-whatsapp-webhook` (mensagem recebida): verifica acordo ativo do portal com `parcelas = 1` pelo sufixo do telefone (identificar a marca de origem do portal no fluxo de criação antes de codar) e aplica a etiqueta de forma idempotente.
- Teste unitário da regra "só à vista do portal recebe etiqueta".
- Deploy das funções alteradas.
