# Modelo Mensagem: "Layout Novo Mundo" + nova aba "Layout Umi"

## 1. Renomear aba
A aba **Colar imagem** passa a se chamar **Layout Novo Mundo**. Nenhuma mudança de comportamento.

## 2. Nova aba "Layout Umi"
Funciona no mesmo estilo: o usuário cola (Ctrl+V), arrasta ou seleciona a imagem da tabela de desconto especial da UME, clica em **Extrair dados**, confere os campos e copia a mensagem pronta.

### O que a IA lê da imagem
- Tabela de parcelas: cada linha `Nx` com seu valor de parcela (1x, 2x, 3x, ... até onde a imagem mostrar).
- **Total - Até 3x** (ex.: R$ 5.514) — base de cálculo para 2x e 3x.
- **Total - 4x ou mais** (ex.: R$ 5.974) — base de cálculo para 4x em diante.
- Valor de 1x (ex.: R$ 5.055) = valor à vista.

Todos os campos ficam editáveis na tela caso a IA erre algo, e o nome do cliente é digitado à mão (a imagem não traz nome).

### Montagem das opções
Opções exibidas na mensagem: **2x, 4x, 6x, 8x, 12x e 18x**.
- Se a quantidade existe na tabela da imagem, usa exatamente o valor lido.
- Se não existe (ex.: 12x e 18x, quando a tabela para em 11x), calcula `total ÷ n`, usando **Total até 3x** para n ≤ 3 e **Total 4x ou mais** para n ≥ 4.
- Opção com parcela abaixo de R$ 100 é omitida.
- À vista aparece com o valor da linha 1x.

### Mensagem gerada (modelo)
```text
Meu nome é {nome_usuario}, falo referente à UME.

Identificamos seu débito e hoje temos condições especiais para você:

✅ À VISTA: R$ 5.055,00

📄 PARCELADO:
• 2x de R$ 2.757,00
• 4x de R$ 1.494,00
• 6x de R$ 996,00
• 8x de R$ 747,00
• 12x de R$ 497,83
• 18x de R$ 331,89

Qual opção é melhor para você? Que dia consegue realizar o pagamento?
```
O texto do modelo fica editável na própria aba e é salvo por usuário, como no layout Novo Mundo.

## Detalhes técnicos
- `src/pages/ModeloMensagem.tsx`: renomeia o label da aba `imagem` para "Layout Novo Mundo" e adiciona a aba `umi` → novo componente `LayoutUmiTab`.
- Novo `src/components/modelo-mensagem/LayoutUmiTab.tsx`: reaproveita a estrutura de colar/arrastar imagem do `ColarImagemTab`, com campos próprios (valor à vista, total até 3x, total 4x+, lista de parcelas lidas) e montagem local do texto (sem depender de `renderMensagem`).
- Nova edge function `extract-modelo-ume`: mesmo padrão do `extract-modelo-mensagem` (Lovable AI, `google/gemini-2.5-flash`, tool calling) com schema `{ valor_avista, total_ate_3x, total_4x_ou_mais, parcelas: [{ n, valor }] }` e tratamento de 429/402.
- Persistência opcional do template/nome do usuário reutilizando `modelo_mensagem_template` com uma coluna nova (`template_ume`) — sem novos crons, polling ou jobs, então sem impacto de custo recorrente; o custo de IA é por extração, igual ao fluxo atual.
