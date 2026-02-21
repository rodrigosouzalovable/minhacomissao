
## Negociar todos os debitos de uma vez no portal

### Problema atual

Cada parcela/debito aparece como um card separado com seu proprio botao "Negociar este debito". O cliente precisa negociar parcela por parcela, o que e impraticavel quando tem muitas parcelas em aberto (como no exemplo da imagem: 3 parcelas de R$ 87,44).

### Solucao

Substituir a negociacao individual por uma negociacao unificada. Todos os debitos do cliente serao listados em um resumo, e um unico formulario de negociacao permitira montar a proposta sobre o valor total de todos os debitos somados.

### O que muda na interface

**Antes:**
- Card por debito, cada um com botao "Negociar este debito"
- Formulario de proposta dentro de cada card individual

**Depois:**
- Cards de debito continuam listados (mostrando contrato, valor), mas sem botao individual
- Acima ou abaixo dos cards, um resumo com o valor total de todos os debitos
- Um unico botao "Negociar todos os debitos"
- Um unico formulario de proposta baseado no valor total
- A mensagem do WhatsApp lista todos os contratos em aberto

### Arquivo: `src/pages/ConsultaResultado.tsx`

**Mudancas:**

1. **Remover estado `negociacoes` por debito** (Record por ID) e substituir por um unico estado de negociacao global (`negociacao: NegociacaoState | null`)

2. **Calcular `valorTotal`** somando `valor_original` de todos os debitos

3. **Simplificar os cards de debito**: remover o botao "Negociar este debito" e o formulario embutido. Cada card mostra apenas contrato + valor

4. **Adicionar secao de resumo total** abaixo dos cards com:
   - Valor total de todos os debitos somado
   - Botao "Negociar todos os debitos"

5. **Formulario de negociacao unico** que aparece ao clicar o botao:
   - Entrada (opcional), parcelas (ate 24x), data do primeiro pagamento
   - Calcula com base no valor total

6. **Mensagem WhatsApp unificada** incluindo:
   - Nome e CPF do cliente
   - Lista de todos os contratos em aberto (ex: "contratos 618010, 618011, 618013")
   - Valor total
   - Condicoes da proposta (entrada + parcelas)

### Exemplo da mensagem gerada

```
Ola! Meu nome e ABICELI SILVEIRA DIAS FILHO, meu CPF e 83714707115 e quero negociar os contratos em aberto 618010, 618011, 618013, no valor total de R$ 262,32, da seguinte forma: 3x de R$ 87,44. Quero pagar a primeira parcela no dia 25/02/2026. Me envie o boleto por gentileza.
```
