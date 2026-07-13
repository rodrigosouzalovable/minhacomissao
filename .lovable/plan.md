## Objetivo

Reformular a apresentação das aulas da Consultoria WhatsApp API para que o conteúdo pareça premium, organizado e fácil de ler — transmitindo valor real ao cliente (Daniel).

Hoje o conteúdo está sendo renderizado como markdown "cru" dentro de um Card, sem hierarquia visual: títulos viram texto normal, tabelas quebram, listas ficam coladas, blocos importantes se perdem no meio do parágrafo.

## Escopo

Somente a experiência de leitura de aula em `/consultoria/aula/:modulo/:aula`:

1. **Renderização (frontend)** — `src/pages/consultoria/ConsultoriaAula.tsx`
2. **Conteúdo das 28 aulas** — reescrever `conteudo_md` no banco via migration (UPDATE por `modulo_id + numero`)

Sem mexer em auth, RLS, admin, materiais, dúvidas, progresso ou rotas.

## 1. Layout da página de aula

Reestruturar o topo e o corpo para ficarem editoriais, não "wiki":

- **Hero da aula**: eyebrow "MÓDULO X · AULA Y", título grande em display font, subtítulo curto (1 linha resumindo a aula), e uma linha de metadados em chips: duração estimada, nível (Fundamento / Prático / Avançado), e ícone do tema (Zap, DollarSign, MessageSquare, Shield, Wrench).
- **Grid 2 colunas** em desktop (`lg:grid-cols-[1fr_280px]`):
  - Coluna principal: vídeo + conteúdo.
  - Coluna lateral (sticky): "Nesta aula" (índice dos H2 gerado a partir do markdown), badge de status, botão "Marcar como concluída" fixo, e "Materiais desta aula" compacto.
- Rodapé com Anterior / Próxima em cards maiores mostrando o título da aula vizinha, não só "Anterior/Próxima".

## 2. Sistema de estilos para o markdown

Substituir o `prose` genérico por componentes customizados via `components` do `react-markdown`, mapeando cada elemento para um design consistente com o resto do MEUS ACORDOS (tokens semânticos, sem cor hardcoded):

- `h1` → escondido (já mostrado no hero).
- `h2` → título de seção com barra vertical colorida à esquerda + espaçamento generoso acima.
- `h3` → subtítulo com ícone opcional.
- `p` → line-height confortável, largura máxima de leitura.
- `ul` / `ol` → bullets customizados (check verde para vantagens, ponto neutro para listas comuns).
- `strong` → destaque com cor `primary`.
- `code` inline → chip com background `muted`.
- `pre` → bloco de código com header (linguagem + botão copiar).
- `blockquote` → card "Dica do consultor" com ícone Lightbulb e fundo `accent/10`.
- `table` → wrapper com scroll horizontal, header em `muted`, zebra nas linhas, bordas arredondadas, tipografia tabular. Resolve o problema principal da tabela quebrada do print.
- `a` → sublinhado sutil + hover em `primary`.
- `hr` → separador decorativo (não linha crua).

## 3. Blocos especiais via convenção de markdown

Interpretar padrões dentro do `conteudo_md` para virarem componentes visuais:

- Linha começando com `> 💡` → Callout "Dica".
- Linha começando com `> ⚠️` → Callout "Atenção".
- Linha começando com `> ✅` → Callout "Boas práticas".
- `## Checklist` → renderizar lista seguinte como checklist visual.
- `## Passo a passo` → renderizar lista como stepper numerado.

Isso é feito no `components.blockquote` e num pequeno pré-processamento do markdown antes de passar ao `ReactMarkdown` (regex simples, sem lib nova).

## 4. Reescrita do conteúdo das 28 aulas

Migration `UPDATE consultoria_aulas SET conteudo_md = ...` para cada aula. Cada aula terá a mesma estrutura visual previsível:

```
## Visão geral
1 parágrafo curto explicando o "porquê" da aula.

## Conceitos-chave
Lista com 3–6 itens (bullets com strong no termo).

## Como funciona na prática
Passo a passo numerado OU tabela comparativa (quando fizer sentido).

> 💡 Dica do consultor: ...

## Boas práticas
Checklist de 4–8 itens acionáveis.

> ⚠️ Atenção: ... (quando houver risco/pegadinha)

## Resumo
2–3 bullets fechando a aula.
```

Conteúdo tecnicamente igual/melhor ao rascunho atual, apenas reorganizado nessa estrutura + linguagem mais direta.

## 5. Detalhes técnicos

- Continuar usando `react-markdown` + `remark-gfm` (já instalados).
- Índice lateral gerado com um walker simples no AST (`remark-slug`-like manual) — extrair H2 do markdown com regex antes de renderizar, gerar `id` slugificado e passar via `components.h2`.
- Sticky sidebar com `position: sticky; top: 5rem` só em `lg+`. Em mobile, esconder o índice (ou colapsar num `<details>` no topo).
- Zero classes de cor cruas: tudo via tokens (`bg-card`, `text-foreground`, `text-primary`, `bg-muted`, `border-border`, `bg-accent/10`).
- Manter dark mode funcional (o `prose dark:prose-invert` sai; validar contraste dos callouts e da tabela nos dois temas).
- Sem novas libs. Sem mudanças em rotas, providers ou banco além do UPDATE de conteúdo.

## Entregáveis

1. `src/pages/consultoria/ConsultoriaAula.tsx` reescrito (layout + renderer customizado + índice lateral + rodapé rico).
2. Componente auxiliar `src/pages/consultoria/aulaRenderer.tsx` com o mapa de `components` e utilitários (extrair H2, pré-processar callouts).
3. Migration `supabase/migrations/<timestamp>_consultoria_aulas_conteudo_v2.sql` com os 28 UPDATEs.

## Fora do escopo

- Editor rico no admin (o admin continua editando markdown).
- Player de vídeo customizado.
- Comentários por aula, quiz, certificado — nada disso foi pedido.
