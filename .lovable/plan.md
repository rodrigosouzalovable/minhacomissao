## Objetivo

Reorganizar o layout de cada card da aba "API Oficial Meta" (`src/pages/ConfigurarMeta.tsx`) para que as informações fiquem bem alinhadas, sem elementos sobrepostos ou "colados" (ex.: "Phone ID:" grudando no rótulo "editar" do telefone) e sem quebras visuais estranhas em telas menores.

## Problemas atuais (visíveis no screenshot)

- Grid de 4 colunas força "Phone ID" e "WABA" a ficarem colados quando o campo Telefone entra em modo de exibição com botão "editar" inline.
- O botão "editar" fica pequeno e visualmente grudado ao valor do telefone.
- Linha do Business Manager fica logo abaixo do grid sem separação clara.
- Botões de ação à direita (WhatsApp Manager / Testar / Templates / Power / Trash) disputam espaço horizontal com o bloco de infos e podem sobrepor quando o nome da instância + badges é longo.

## Mudanças (só CSS/estrutura JSX, sem mudança de lógica)

Em `src/pages/ConfigurarMeta.tsx`, dentro do `map((inst) => ...)` (linhas ~481–630):

1. **Header do card em linha própria (full-width)**
   - Trocar o wrapper externo `flex items-start justify-between` por um `flex flex-col gap-3`.
   - Primeira linha: `flex flex-wrap items-center justify-between gap-2` contendo:
     - Esquerda: nome + badges (Ativa/Inativa + BM vinculada/Sem BM).
     - Direita: bloco de botões de ação (WhatsApp Manager, Testar, Templates, Power, Trash) em `flex flex-wrap gap-1 shrink-0`.
   - Isso garante que os botões nunca "colem" nas informações e quebram para baixo em telas estreitas.

2. **Bloco de identificação em grid estável**
   - Substituir o grid `grid-cols-2 md:grid-cols-4` por `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2`.
   - Cada célula fica em `flex flex-col` (rótulo em cima em `text-[10px] uppercase text-muted-foreground`, valor embaixo em `text-xs font-medium`) → elimina o efeito de "Phone ID" grudando no valor anterior.
   - Campo Telefone continua editável inline, mas o botão "editar" vira um `IconButton` (ícone de lápis, `h-5 w-5`) à direita do valor, com `ml-1`.

3. **Separação visual entre seções**
   - Business Manager e Limite de mensagens continuam como estão, mas cada um envolvido por `div` com `pt-3 mt-3 border-t border-border/60` (hoje só o Limite tem border-t; padronizar ambos).
   - Dentro de cada seção, `flex flex-wrap items-center gap-2` e o `<Select>` com `w-full sm:w-[240px]` (evita estourar em mobile).

4. **Larguras dos Selects e Inputs**
   - Todos os `SelectTrigger` passam a usar `w-full sm:w-[240px]` (BM) e `w-full sm:w-[220px]` (Limite) para não estourarem em telas pequenas.
   - Input de edição de telefone `w-full sm:w-40`.

5. **Sem mudanças em**: nomes de campos, handlers (`vincularBM`, `salvarDisplayPhone`, `salvarTierManual`, `sincronizarSaude`, `testar`, `sincronizar`, `toggle`, `excluir`), lógica do botão WhatsApp Manager, dados carregados, ou schema.

## Resultado esperado

- Cabeçalho: nome + status + BM na esquerda; botões de ação alinhados à direita, quebrando linha só quando necessário.
- Bloco de identificação: 4 colunas em desktop, 2 em tablet, 1 em mobile, com rótulo em cima e valor embaixo — nada mais fica "grudado".
- Business Manager e Limite de mensagens claramente separados por linha divisória e com selects que não estouram a largura do card.

## Arquivos afetados

- `src/pages/ConfigurarMeta.tsx` — único arquivo alterado.
