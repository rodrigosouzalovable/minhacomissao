## Objetivo
Permitir que o login admin edite qualquer acordo — inclusive os marcados como **Quebrado** — podendo mexer em valores, número de parcelas, adicionar e remover parcelas. Usuários comuns continuam com as regras atuais.

## Mudanças

### 1. `src/pages/AcordoDetalhe.tsx`
- Exibir o botão **Editar** também quando `acordo.status === 'quebrado'` (ou `cancelado`), **desde que o usuário seja admin**. Hoje a linha 573 só mostra Editar quando `status === 'ativo'`.
- Ao clicar em Editar num acordo quebrado, o admin será levado para `/acordos/:id/editar` normalmente.
- Manter para admin os botões de excluir parcela individual (já existem) — nada muda ali.

### 2. `src/pages/EditarAcordo.tsx`
- A carga do acordo já funciona para qualquer status (não filtra por status). Nenhuma mudança na leitura.
- No `handleSubmit`, quando o usuário for admin:
  - Se o acordo estava `quebrado` (ou `cancelado`), atualizar `status = 'ativo'` junto com os demais campos, para reativar o acordo editado.
  - Continuar regenerando as parcelas pendentes preservando as pagas (fluxo atual do admin já faz isso, inclusive quando aumenta/diminui o número de parcelas).
- Remover o aviso "campos financeiros bloqueados" quando o usuário é admin (já está condicionado a `!isAdmin`, apenas confirmar).
- Nada muda para não-admin (regras atuais permanecem).

### 3. Backend / RLS
- Verificar rapidamente que as policies de `acordos` e `pagamentos` já permitem `UPDATE`/`DELETE`/`INSERT` para admin em qualquer registro (via `has_role`). Se alguma policy restringir por `status`, ajustar via migration para admin. Não vou criar migration se as policies atuais já cobrem admin globalmente — apenas confirmarei via leitura do schema antes de codar.

## Fora do escopo
- Nenhuma alteração para usuários não-admin.
- Nenhuma alteração visual/comportamental em acordos `ativos` ou `concluídos`.

## Confirmação
Ao editar um acordo **quebrado**, ele volta para status **ativo** automaticamente após salvar. Está ok? Se preferir manter o status "quebrado" mesmo depois da edição, me avise antes de eu implementar.
