## Objetivo

Tornar **toda e qualquer informação de comissão** visível **apenas para administradores** (`role = 'admin'`). Funcionários e gestores não devem ver nenhum valor, percentual, total, gráfico, coluna, badge, item de menu, página ou exportação relacionada a comissão.

## Como saber se é admin

Já existe o hook `useUserRole()` (`src/hooks/useUserRole.tsx`) que expõe `isAdmin`. Vou usar `isAdmin` como única condição para renderizar qualquer bloco de comissão. Enquanto `loading === true`, não exibir nada.

## Mudanças por arquivo

### 1. `src/components/layout/AppLayout.tsx`
- Remover/ocultar o item de menu **"Minhas Comissões"** (`/comissoes`) quando `!isAdmin`.

### 2. `src/App.tsx`
- Proteger as rotas `/comissoes` e `/usuario-comissoes/:id` redirecionando para `/` quando `!isAdmin` (defesa em profundidade caso alguém acesse via URL).

### 3. `src/pages/Dashboard.tsx`
- Esconder os cards **"Comissão Pendente"**, **"Comissão Recebida"** e o gráfico **"Comissões por Mês"** se `!isAdmin`. Ajustar o grid para reorganizar sem buracos.

### 4. `src/pages/Acordos.tsx`
- No card de cada acordo (linhas ~316-317): remover o bloco **"Comissão / R$ x"** quando `!isAdmin`.
- Na exportação de Excel (linhas ~820-854): remover as colunas `comissao_total` e `percentual_comissao` para não-admins.

### 5. `src/pages/AcordoDetalhe.tsx`
- Esconder os blocos de **"Comissão Recebida"**, **"Comissão Pendente"**, **"Percentual de Comissão"**, **"Comissão por Parcela"** e **"Comissão Total"** (linhas ~677-732) para `!isAdmin`.
- Esconder o badge **"Comissão: R$ x"** dentro de cada parcela (linhas ~907-955) — incluindo o ícone de editar (`setEditandoComissao`) — para `!isAdmin`. Esse é o trecho do screenshot enviado.

### 6. `src/pages/EditarAcordo.tsx`
- Esconder o card **"Cálculo da Comissão"** e a **"Tabela de Comissões"** (linhas ~448-490) para `!isAdmin`. Os cálculos continuam acontecendo no backend para preservar o registro da comissão; apenas a UI fica oculta.

### 7. `src/pages/NovoAcordo.tsx` e `src/pages/NovoAcordoAdmin.tsx`
- Esconder qualquer painel/preview que exiba os valores calculados de comissão para `!isAdmin` (mantendo o cálculo silencioso para gravar `comissao_total`/`comissao_parcela` no banco).

### 8. `src/components/devedor/AcordoDevedorSection.tsx`
- Ocultar a coluna **"Comissão Montreal"** e o total **"Comissão Montreal acumulada"** (linhas ~601-691) para `!isAdmin`.

### 9. `src/pages/Comissoes.tsx` (página "Minhas Comissões")
- Adicionar guarda no topo: se `!isAdmin && !loading`, renderizar mensagem "Acesso restrito" e botão de voltar (a rota também já será bloqueada no `App.tsx`).

### 10. `src/pages/UsuarioComissoes.tsx`, `src/pages/EquipeAcordos.tsx`, `src/pages/Financeiro.tsx`
- Já são páginas administrativas, mas adicionar o mesmo guard `isAdmin` no topo para garantir.

### 11. (Opcional, mas recomendado) `src/components/ComparativoMensal.tsx`
- Verificar se exibe valores de comissão na visão de funcionário. Se sim, ocultar.

## Backend / Banco

Não vou mexer em RLS de `pagamentos` nem em colunas. Os valores `comissao_parcela` e `comissao_total` continuam sendo gravados normalmente, porque admin precisa visualizá-los e exportá-los. A restrição é puramente de UI.

> Observação: como funcionários têm acesso de leitura aos próprios `pagamentos` via RLS, em teoria poderiam consultar `comissao_parcela` por API direta. Como o pedido é "não aparecer nas telas para funcionários", esta abordagem atende. Caso queira impedir até via API, em uma etapa seguinte criamos uma view sem essas colunas e revogamos SELECT direto — me avise se quiser que eu inclua isso.

## Testes manuais após implementação

1. Logar como **admin**: tudo continua aparecendo (Dashboard, Acordos, AcordoDetalhe parcelas com badge editável, exportações com colunas, página /comissoes acessível).
2. Logar como **funcionário**: nenhum valor de comissão visível em Dashboard, Acordos, AcordoDetalhe, Editar Acordo, Novo Acordo, AcordoDevedorSection, e item de menu "Minhas Comissões" sumido. Acessar `/comissoes` direto pela URL redireciona.
3. Logar como **gestor**: mesmo comportamento de funcionário (sem comissões).

## Memória

Atualizar `mem://finance/commission-calculation-and-dashboards` para registrar a nova regra: **toda informação de comissão é exclusiva de admin** (gestores e funcionários não veem nada).
