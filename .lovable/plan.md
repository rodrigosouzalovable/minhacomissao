
## Corrigir sobreposicao do botao "Sair" na sidebar

### Problema

O botao "Sair" esta posicionado com `absolute bottom-0`, o que faz com que ele se sobreponha aos itens de navegacao quando a tela esta com zoom em 90% ou quando ha muitos itens no menu.

### Solucao

Reestruturar o layout da sidebar para usar flexbox vertical com scroll:

**Arquivo:** `src/components/layout/AppLayout.tsx`

1. Transformar o conteudo da sidebar em um layout flex column com `h-full`
2. O header (logo + email) fica no topo sem scroll
3. A area de navegacao (`nav`) fica em um container com `flex-1 overflow-y-auto` para ter scroll quando necessario
4. O botao "Sair" fica abaixo da navegacao como ultimo item do fluxo normal (removendo `absolute bottom-0`)
5. Adicionar um separador visual (borda ou espacamento) entre o ultimo item de nav e o botao Sair

### Estrutura resultante

```text
+------------------+
| Logo + Email     |  (fixo no topo)
+------------------+
| Minha Conta      |
| Dashboard        |
| Meus Acordos     |  (scrollable se necessario)
| ...              |
| Importar Dev.    |
+------------------+
| Sair             |  (fixo no fundo, sem absolute)
+------------------+
```

### Detalhes tecnicos

- A tag `<aside>` ja tem `h-full`. Adicionar uma div interna com `flex flex-col h-full`
- O header com logo fica como `shrink-0`
- A `<nav>` fica dentro de um `<div className="flex-1 overflow-y-auto">`
- O botao "Sair" fica em um `<div className="shrink-0 p-4 border-t border-sidebar-border">` sem posicionamento absoluto
