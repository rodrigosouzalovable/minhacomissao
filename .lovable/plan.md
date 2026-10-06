# Envio Meta — "Selecionar todas" deve respeitar o filtro de Qualidade

## Problema
No diálogo "Instâncias" da aba Envio Meta, ao filtrar por qualidade RED, o botão "Selecionar todas" fica desabilitado.

Causa (confirmada em src/pages/EnvioMeta.tsx):
- `instanciasElegiveisSelecaoMassa` (linhas ~1103-1108) só considera instâncias GREEN/UNKNOWN/sem qualidade.
- O botão (linha ~1830) usa `disabled={instanciasElegiveisSelecaoMassa.length === 0}`.
- Com o filtro RED ativo, nenhuma instância visível é elegível → botão sempre desabilitado.

A restrição GREEN-only existe para evitar selecionar em massa números YELLOW/RED sem intenção. Mas quando o usuário aplica explicitamente um filtro de qualidade (RED, YELLOW etc.), a intenção é justamente trabalhar com essas instâncias.

## Solução
Arquivo: src/pages/EnvioMeta.tsx (mudança só no frontend).

1. Ajustar `instanciasElegiveisSelecaoMassa`:
   - Se `qualidadeFiltro.length > 0` → considerar todas as `instanciasVisiveis` (o filtro já expressa a intenção do usuário).
   - Se nenhum filtro de qualidade ativo → manter a regra atual (GREEN/UNKNOWN/sem qualidade).

2. Ajustar o botão:
   - `disabled` passa a usar essa lista atualizada (fica habilitado com filtro RED/YELLOW).
   - O toggle "Selecionar todas / Limpar seleção" continua funcionando sobre as visíveis (desmarcar já usa `idsVisiveis`, mantido).
   - Tooltip atualizado: com filtro de qualidade ativo, seleciona todas as instâncias visíveis; sem filtro, mantém o comportamento GREEN/sem qualidade.

3. Não alterar: regras de envio, bloqueios de qualidade, round-robin, filtro de BMs ou qualquer outra parte da página.

## Validação
- tsgo typecheck + build.
- Playwright no diálogo "Instâncias": aplicar filtro RED → botão "Selecionar todas" habilitado, marca as instâncias visíveis; "Limpar seleção" desmarca; sem filtro, comportamento atual preservado (botão desabilitado quando não há elegíveis).
- Nenhum envio real em teste.
