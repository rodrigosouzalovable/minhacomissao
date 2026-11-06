# Permitir aplicar templates pelo botão "Templates"

## Causa
O número 62 92007-4871 está com a opção "copiar templates automaticamente" desligada. O botão "Templates" usa a mesma regra da cópia automática, então quando essa opção está desligada ele é recusado com "copia_automatica_desativada", mesmo quando é você (admin) clicando de propósito.

## Correção
1. Quando o admin dono do número clica em "Templates", o pedido passa a valer como **aplicação manual autorizada** e não depende mais da opção de cópia automática.
2. Continuam bloqueando (como hoje): números de teste do aquecimento, números de parceiro, números de outro dono, bloqueios reais da Meta e pausas por reprovação.
3. A cópia automática dos números com a opção desligada continua desligada (nada muda no automático).
4. Se ainda houver bloqueio, o aviso mostra o motivo em português (não o código técnico).

## Verificação
Aplicar os templates no 62 92007-4871 após a correção e conferir que entram na fila.

## Detalhes técnicos
- `ConfigurarMeta.tsx` (botão Templates): enviar `aplicacao_manual: true`.
- `meta-templates-onboarding-enfileirar`: `aplicacaoManual = body.aplicacao_manual === true && !interno` (já exige admin + dono); trocar a condição para `(!manualDefer && !aplicacaoManual && templates_auto_copiar !== true)`. Agendamento imediato, mesmas cotas/tier.
- Garantir tradução de `copia_automatica_desativada` em `humanizarErroTemplate`. Deploy da função.
