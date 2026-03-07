

## Atualização do server.js com Seletores Exatos do CobMais

Os screenshots com DevTools revelam os seletores exatos para cada etapa após abrir a ficha do cliente. O robô atual está falhando porque os passos 6-10 usam seletores genéricos. Vou corrigir com os IDs reais.

### Mapeamento de Seletores (dos screenshots)

| Passo | Elemento | Seletor Real |
|-------|----------|-------------|
| Abrir Cálculo | Botão "Cálculo" | `#btnCalcular` (dentro de `#divCalculo`) |
| Valor Final | Input do valor | `input#txtValorFinal` (já correto) |
| Atualizar | Botão verde | `button#btnAtualizarCalculo` |
| Salvar Acordo | Botão azul | `button#btnSalvarCalc` (já correto) |
| Dropdown Acordo | Botão amarelo ▼ | `span.ev-btn.ev-btn-amarelo` |
| Emitir Boletos | Link no dropdown | `a.gerar-boleto` |
| Selecionar Todos | Checkbox | `#ckbTodosBoletos` |
| Imprimir | Botão imprimir | Botão "Imprimir" no modal |

### Fluxo Correto (Passos 6-10 reescritos)

1. **Passo 6**: Clicar em `#btnCalcular` para abrir o modal de cálculo
2. **Passo 7**: Preencher `input#txtValorFinal` com o valor negociado
3. **Passo 8**: Clicar em `button#btnAtualizarCalculo` (botão verde "Atualizar")
4. **Passo 9**: Clicar em `button#btnSalvarCalc` (botão "Salvar Acordo")
5. **Passo 10**: Aguardar voltar à ficha, clicar no dropdown amarelo `span.ev-btn.ev-btn-amarelo`
6. **Passo 11**: Clicar em `a.gerar-boleto` ("Emitir Boletos")
7. **Passo 12**: Marcar `#ckbTodosBoletos` ("Selecionar Todos")
8. **Passo 13**: Clicar em "Imprimir" e capturar URL do PDF

### Alterações

1. **`server.js`**: Reescrever passos 6-10 com o fluxo correto de 8 sub-passos usando seletores exatos
2. **`src/components/RoboCodeViewer.tsx`**: Atualizar o código exibido na aba "Código do Robô" para refletir a versão corrigida

