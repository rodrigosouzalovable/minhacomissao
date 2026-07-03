## Objetivo

1. Reverter tudo o que foi adicionado à aba **Templates HSM** dentro de **API Oficial Meta** (seleção de quais templates aparecem no Envio Meta Massa).
2. Na aba **Envio Meta Massa**, mostrar todos os templates novamente e, ao selecionar instâncias, listar quais instâncias estão vinculadas a cada template.

## 1. Reverter `src/pages/ConfigurarMeta.tsx`

- Remover o componente `MassaSelectAllCheckbox` (linhas ~47-113).
- Remover o estado `filtroInstancias` e seu setter.
- Remover o card "Filtrar por instâncias" (linhas ~528-579) na aba Templates HSM.
- Na tabela de templates HSM:
  - Remover a coluna de checkbox `Massa` (cabeçalho e células).
  - Remover a função `toggleGrupo` e o filtro por instâncias visíveis.
  - Manter apenas as colunas: Nome, Categoria, Idioma, Cobertura, Corpo.
- Ajustar o texto acima da tabela: remover a frase sobre "Marque os templates que devem aparecer na aba Envio Meta Massa" e deixar apenas a descrição da coluna Cobertura.
- Remover a propriedade `habilitado_envio_massa` do type `Template` local (a coluna do banco permanece, apenas deixa de ser usada — sem migration).

## 2. Ajustar `src/pages/EnvioMeta.tsx`

- Query em `carregar()`: remover `.eq("habilitado_envio_massa", true)` — carregar todos os templates das instâncias ativas.
- No dropdown de templates (usando `templateGroups`), para cada template mostrar:
  - Nome + idioma + categoria (já existe).
  - Badge "X/Y instâncias" existente (aprovadas nas selecionadas).
  - Nova linha logo abaixo com badges pequenas listando o nome de **cada instância selecionada em que o template existe**, com estilo diferenciado para `approved` (verde) vs. não aprovado (âmbar). Isso deixa visível "quais instâncias estão vinculadas àquele template".
- Atualizar a descrição do card "1. Template HSM": trocar o texto atual ("Apenas templates marcados como Disponível em Envio em Massa...") por algo como "Selecione as instâncias ao lado — os templates disponíveis em cada instância selecionada aparecerão aqui, com badges indicando em quais instâncias existem."
- Manter intacto o aviso amarelo de instâncias incompatíveis, o bloqueio do botão Iniciar envio, e o mapeamento `templateIdByInstance`.

## Fora de escopo

- Nenhuma alteração de banco/migration (coluna `habilitado_envio_massa` continua existindo, apenas sem uso na UI).
- Nenhuma alteração em edge functions.
- Nenhuma alteração em outras páginas.
