

## Correção: "Selecionar Todos" + Tratamento de Erro de Email

### Problema 1: "Selecionar Todos" nao clica
Dos screenshots, o checkbox `#ckbTodosBoletos` esta dentro de um wrapper `span.nice-checkbox`. Playwright pode nao conseguir clicar no input diretamente. A solucao e clicar na **label** `label[for="ckbTodosBoletos"]` que e o elemento clicavel visivel.

### Problema 2: Erro de email acontece DEPOIS do Imprimir
O erro "Email do cliente nao pode ficar em branco" aparece como um **toast amarelo** (`div.toast-message`) APOS clicar em Imprimir no modal de boleto. O codigo atual tenta tratar email no passo de salvar acordo, mas o erro real e no passo de emissao de boleto.

### Fluxo de recuperacao de email (dos screenshots):
1. Detectar toast de erro apos clicar Imprimir
2. Fechar modal de boleto (botao "Cancelar" / `#btnFecharBoleto`)
3. Clicar na aba "E-mail" (`a[href="#tabEmail"]`)
4. Clicar em "+ Novo" (`a#btnNovoItem`)
5. Preencher `input#txtEmail` com "email@email.com"
6. Clicar em "Salvar" (`button#btnSalvarEmail`)
7. Aguardar e refazer o fluxo de emissao (dropdown amarelo > Emitir Boleto > Selecionar Todos > Imprimir)

### Alteracoes

**`server.js`** - Passo 12:
- Mudar seletor de "Selecionar Todos" para `label[for="ckbTodosBoletos"]` como primeira opcao
- Apos clicar em Imprimir, verificar se apareceu toast de erro de email
- Se sim, executar sub-fluxo: fechar modal > aba Email > Novo > preencher > salvar > refazer emissao

**`src/components/RoboCodeViewer.tsx`** - Atualizar codigo exibido na aba "Codigo do Robo"

