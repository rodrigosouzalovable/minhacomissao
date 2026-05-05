## Objetivo

Ao filtrar/pesquisar em **Meus Acordos** ou **Acordos da Equipe**, abrir um card e voltar (botão Voltar do navegador ou navegação interna) deve restaurar **exatamente** os filtros, busca, aba ativa e seleção de funcionário/membro — e a posição de scroll.

## Estratégia

Persistir o estado de filtragem em `sessionStorage` (chave por página). Hidratar uma única vez no mount (lazy initial state) e gravar a cada mudança. `sessionStorage` mantém os filtros enquanto a aba do navegador estiver aberta e zera ao fechar — exatamente o comportamento esperado.

Sem custos de Lovable Cloud (zero requisições novas).

## Mudanças

### 1) `src/pages/Acordos.tsx`

Chave: `acordos:filters:v1`

Persistir:
- `search` (string)
- `statusFilter` (string)
- `abaAtiva` ('pagos' | 'negociados' | 'proximas' | 'acordos_realizados' | 'vencidos')
- `selectedUserId` (string)
- `filtroDataVencimento` (ISO string ou null)
- `filtroDataCriacao` (ISO string ou null)
- `scrollY` (number) — salvo no `beforeunload` e ao clicar num card; restaurado após `loading=false`.

Implementação:
- Helpers locais `loadState()` / `saveState(partial)` no topo do componente.
- Cada `useState` inicializa via função lazy lendo de `loadState()`. Datas viram `new Date(iso)`.
- Um `useEffect` que observa todos os campos persistidos e chama `saveState({...})` com debounce (200 ms) usando `setTimeout`.
- `useEffect` de scroll: ao montar, se houver `scrollY`, faz `window.scrollTo(0, scrollY)` após o primeiro render com dados. Ao navegar para um card (handler que abre `/acordo/:id`), salva `scrollY` antes do `navigate`.

### 2) `src/pages/EquipeAcordos.tsx`

Chave: `equipe-acordos:filters:v1`

Persistir:
- `search`, `statusFilter`, `memberFilter`, `viewFilter`, `showEmpresaCards`
- `startDate`, `endDate`, `filtroDataVencimento` (ISO ou null)
- `scrollY`

Mesma técnica (lazy init + effect de save + restauração de scroll).

### 3) Detalhes técnicos

- Usar try/catch em volta de `JSON.parse` para tolerar storage corrompido.
- Versionar a chave (`:v1`) para permitir invalidar no futuro.
- Não persistir nada sensível — são apenas strings/datas de UI.

## Fora de escopo

- Não persistir filtros de outras páginas (Clientes, Acionamento etc.) — mesma técnica pode ser aplicada depois sob demanda.
- Não usar `localStorage` (manteria filtros entre sessões, o que pode confundir o usuário).