

## Correção do server.js - Seletores Exatos dos Screenshots

### Problema
O robô abre a ficha do cliente mas **não clica em Cálculo**. Analisando os screenshots com DevTools, identifiquei os problemas e os seletores corretos.

### Problemas Identificados

1. **Passo 6 (Selecionar parcelas)**: Os seletores `#chkAll`, `#chkTodos` não existem no CobMais. As parcelas são checkboxes dentro da tabela de contratos - mas ao analisar os screenshots, **não é necessário selecionar parcelas manualmente** antes de clicar em Cálculo. O Cálculo já seleciona todas automaticamente.

2. **Passo 7 (Cálculo)**: O botão é um `<a>` (link), não `<button>`. O seletor `#btnCalcular` pode funcionar, mas o elemento pode estar fora da viewport (precisa scroll). O seletor completo é: `a#btnCalcular` dentro de `div#divCalculo`.

3. **Passo 13 (Imprimir)**: O botão final é `button#btnConfirmarBoleto` (não genérico `button:has-text("Imprimir")`).

### Seletores Corretos (dos screenshots com DevTools)

| Passo | Elemento | Seletor |
|-------|----------|---------|
| Cálculo | Link "Cálculo" | `#btnCalcular` (dentro de `#divCalculo`) - é um `<a>` |
| Valor Final | Input valor | `input#txtValorFinal` |
| Atualizar | Botão verde | `button#btnAtualizarCalculo` (classe `btn-success`) |
| Salvar | Botão azul | `button#btnSalvarCalc` (classe `btn-primary`) |
| Dropdown amarelo | Seta ▼ do Acordo | `span.ev-btn.ev-btn-amarelo` |
| Emitir Boletos | Link no dropdown | `a.gerar-boleto` |
| Selecionar Todos | Checkbox boletos | `label:has-text("Selecionar Todos")` ou checkbox adjacente |
| Imprimir (final) | Botão confirmar | `button#btnConfirmarBoleto` |

### Correções no Fluxo

1. **Remover Passo 6** (selecionar parcelas) - desnecessário, o Cálculo seleciona tudo
2. **Passo 7 (Cálculo)**: Adicionar scroll até o elemento e usar `scrollIntoViewIfNeeded()` antes do click. Aumentar timeout.
3. **Passo 13**: Usar `button#btnConfirmarBoleto` como seletor do botão Imprimir final

### Alterações

1. **`server.js`**: Reescrever fluxo removendo passo desnecessário, corrigindo seletor do Cálculo (scroll + click) e adicionando `#btnConfirmarBoleto`
2. **`src/components/RoboCodeViewer.tsx`**: Atualizar código exibido na aba "Código do Robô" com a versão corrigida

