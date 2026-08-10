# Valores em reais na importação de planilha (Envio Meta)

Hoje a coluna C da planilha entra como número cru (`4607.58`) e é isso que vai para a variável `{{2}}` do template. O objetivo é enviar `R$ 4.607,58`.

## O que muda

1. **Detecção automática de coluna de valor**
   Ao abrir "Mapear colunas da planilha", colunas cujos valores são numéricos com centavos (ou cujo cabeçalho fale de valor/saldo/dívida/total) passam a ser reconhecidas como monetárias.

2. **Formatação em reais**
   Para essas colunas, o valor é convertido para o padrão brasileiro: separador de milhar `.`, decimais `,`, duas casas, com prefixo `R$` — `4607.58` → `R$ 4.607,58`. Também aceita entrada já formatada (`4.607,58`, `R$ 4607,58`) sem duplicar formatação.

3. **Controle por coluna**
   Abaixo de cada seletor de coluna aparece um pequeno seletor de formato quando a coluna é numérica:
   - `R$ 4.607,58` (padrão quando detectado valor)
   - `4.607,58` (sem o prefixo — para templates cujo texto já traz "R$")
   - `Texto original` (sem formatação)

4. **Pré-visualização**
   A tabela de amostra do diálogo passa a mostrar o valor já formatado, exatamente como sairá na mensagem.

5. **Envio**
   O valor formatado é o que vai para o CSV importado e para as variáveis por telefone, então a mensagem enviada pela Meta já sai com `R$ 4.607,58`. O campo padrão "Saldo (R$)" segue a mesma regra.

## Detalhes técnicos

- Alterações restritas a `src/components/meta/MapearColunasImportDialog.tsx`.
- Novo helper local `formatarValorBR(raw, modo)`: normaliza (remove `R$`, decide se `.`/`,` é decimal pela posição do último separador), retorna string formatada ou o original quando não for número.
- Novo estado `formatoPorColuna: Record<number, 'brl' | 'numero' | 'raw'>`, inicializado por heurística (cabeçalho de valor ou ≥60% das amostras numéricas com decimais).
- `cols[].get` e a construção de `varsByTel` aplicam `formatarValorBR` conforme o formato da coluna; a `<td>` da amostra usa a mesma função.
- Nenhuma mudança em edge functions, banco ou no worker de envio — o valor já chega pronto.
