# Mensagem pronta + parcelamento com piso de R$100

## O que muda na página `Modelo Mensagem`

### 1. Regra de "parcela mínima R$100"
Hoje, ao clicar **Aplicar a todos**, o sistema simplesmente copia "Nº de parcelas" para todos. Vou adicionar uma regra:

- Calcula o valor parcelado com desconto: `total × (1 − %desconto_parcelado/100)`
- Calcula quantas parcelas cabem mantendo cada parcela ≥ R$100: `floor(valorParcelado / 100)`
- Usa o menor entre o Nº global digitado e esse máximo
- Mínimo absoluto = 1 (se o débito for menor que R$100, vira 1x à vista mesmo)

Exemplo do usuário: total R$500, 12x global, 30% desconto parcelado → valor com desconto = R$350 → máximo 3 parcelas de ≈R$116 (não 5x100, porque o desconto reduz o total). Se o usuário quiser 5x100 sem desconto, basta deixar o desconto parcelado em 0 → 5x100.

Essa mesma regra é reaplicada automaticamente quando o usuário edita a linha (muda % parcelado ou Nx) — o campo Nx fica "limitado" pelo piso de R$100.

### 2. Nova coluna "Mensagem"
Na tabela "Clientes & Propostas", adiciono uma coluna **Mensagem** entre `% Nx` e `Ações`, com:
- Preview truncado (2–3 linhas, `line-clamp`) da mensagem renderizada
- Tooltip/hover mostra a mensagem completa
- Botão **Copiar** já existente fica do lado, na coluna Ações

Assim o usuário enxerga as 3 colunas que pediu lado a lado: **Cliente | Telefone | Mensagem** (CPF/Contrato/Total continuam visíveis para contexto, mas a mensagem agora aparece direto na linha).

### 3. Indicação visual quando o Nx foi reduzido
Se o Nx aplicado for menor que o Nx global digitado (porque bateu no piso de R$100), o campo Nx ganha um pequeno aviso (badge "ajustado" ou cor âmbar) para o usuário entender que o sistema reduziu por causa da regra dos R$100.

## Arquivos envolvidos

- `src/pages/ModeloMensagem.tsx` — função `aplicarGlobaisATodos`, função `setLinhaCfg`, render da tabela (nova coluna), helper `calcMaxParcelas(total, descPct)`
- `src/lib/parseCobmaisPlanilha.ts` — `renderMensagem` já usa `parceladoQtd` recebido; nenhuma mudança necessária, só passamos o Nx já ajustado

## Fora do escopo
- Não mudo o template de mensagem nem o parser da planilha
- Não altero o backend / RLS
- Não mudo o fluxo de "1 SIM por cliente" já decidido
