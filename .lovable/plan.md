
## Plano: Reformular pagina de resultado da consulta de debitos

### Resumo das mudancas

Transformar a pagina de resultados de debitos em um portal interativo de negociacao, onde o cliente pode montar sua proposta de pagamento e enviar via WhatsApp com mensagem pre-formatada.

### Alteracoes no arquivo `src/pages/ConsultaResultado.tsx`

#### 1. Exibir dados pessoais abaixo do nome do cliente
- Mostrar CPF do cliente (formatado: 071.439.601-01)
- Mostrar data de nascimento (campo `data_vencimento` que na verdade armazena a data de nascimento)
- Formato: "CPF: XXX.XXX.XXX-XX | Nascimento: DD/MM/YYYY"

#### 2. Remover "Valor Atualizado" e "Vencimento"
- Manter apenas "Valor Original" como o valor do debito
- Renomear para simplesmente "Valor do Debito" com destaque visual

#### 3. Adicionar formulario de negociacao em cada card de debito
Ao clicar em "Negociar este debito", expandir um formulario interativo com:

- **Valor de entrada** (opcional): campo numerico, default R$ 0,00
- **Numero de parcelas**: select de 1x ate 24x (ou ate 23x se houver entrada)
- **Data do primeiro pagamento**: seletor de data (date picker)
- **Calculo automatico**: ao definir entrada e parcelas, exibir o valor de cada parcela calculado como `(valor_original - entrada) / parcelas`
- **Resumo da negociacao**: exibir de forma clara antes de confirmar

#### 4. Mensagem WhatsApp personalizada
Ao confirmar a negociacao, o botao do WhatsApp gera a mensagem no formato:

```
Ola! Meu nome e [NOME], meu CPF e [CPF] e quero negociar o contrato em aberto de numero [CONTRATO], da seguinte forma: Entrada de R$ [X] e mais [N]x de R$ [X]. Quero pagar a primeira parcela no dia [DD/MM/YYYY]. Me envie o boleto por gentileza.
```

Se nao houver entrada:
```
Ola! Meu nome e [NOME], meu CPF e [CPF] e quero negociar o contrato em aberto de numero [CONTRATO], da seguinte forma: [N]x de R$ [X]. Quero pagar a primeira parcela no dia [DD/MM/YYYY]. Me envie o boleto por gentileza.
```

### Detalhes tecnicos

**Estado por debito**: Cada card de debito tera seu proprio estado de negociacao (`entrada`, `parcelas`, `dataPrimeiroPagamento`, `negociando`), gerenciado via um objeto de estado indexado pelo ID do debito.

**Fluxo de interacao**:
1. Usuario ve os debitos com valor e botao "Negociar"
2. Clica em "Negociar" → expande formulario com campos de entrada, parcelas e data
3. Sistema calcula valor das parcelas em tempo real
4. Usuario confirma → botao WhatsApp aparece com mensagem pre-formatada
5. Clica no botao → abre WhatsApp com a mensagem

**Validacoes**:
- Entrada nao pode ser maior que o valor do debito
- Parcelas minimo 1, maximo 24 (ou 23 se tiver entrada)
- Data do primeiro pagamento obrigatoria
- Valor minimo por parcela: R$ 1,00

**Formatacao do CPF completo**: funcao para exibir "071.439.601-01" (com pontos e traco)

**Componentes utilizados**: Input, Select, Button, Calendar/date input (todos ja disponiveis no projeto via shadcn/ui)
