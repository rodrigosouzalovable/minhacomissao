

## Atualização do server.js com Seletores Corretos do CobMais

Com base nos screenshots, identifiquei todos os seletores CSS para o fluxo completo de geração de boleto. Aqui está o mapeamento:

### Seletores Identificados

| Passo | Elemento | Seletor CSS |
|-------|----------|-------------|
| 1 | Campo Usuário (login) | `input#Username` |
| 2 | Campo Senha (login) | `input#Password` |
| 3 | Botão Entrar | `button` com texto "Entrar" |
| 4 | Menu Cobrança (sidebar) | `a.dropdown-toggle` com ícone Cobrança |
| 5 | Navegar para Pesquisa | Link "Cobrança" no dropdown → `/cob/pesquisa` |
| 6 | Campo CPF/CNPJ | `input#txtCPFCNPJ` |
| 7 | Botão Pesquisar | `button#btnPesquisar` |
| 8 | Resultado (cliente na tabela) | Linha na tabela de resultados |
| 9 | Selecionar parcelas + Cálculo | Checkboxes das parcelas + botão "Cálculo" |
| 10 | Campo Valor Final | `input#txtValorFinal` |
| 11 | Botão Salvar Acordo | `button#btnSalvarCalc` |
| 12 | Imprimir Boleto | Capturar URL `gerapdf.aspx` |

### Plano de Implementação

Vou gerar o código completo atualizado do `server.js` com todos esses seletores corretos. As principais mudanças são:

1. **Login**: Usar `#Username` e `#Password` em vez dos seletores genéricos que estavam falhando
2. **Navegação**: Após login, navegar diretamente para `app.cobmais.com.br/cob/pesquisa` em vez de tentar clicar no menu
3. **Busca CPF**: Usar `#txtCPFCNPJ` para o campo e `#btnPesquisar` para o botão
4. **Cálculo**: Na tela de telecobrança, selecionar as parcelas, clicar em "Cálculo", preencher `#txtValorFinal` com o valor negociado e clicar `#btnSalvarCalc`
5. **Boleto**: Interceptar a URL contendo `gerapdf.aspx` após salvar o acordo

O código será entregue como o `server.js` completo para você substituir no seu computador local.

