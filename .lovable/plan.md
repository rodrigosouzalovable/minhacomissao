# Liberar edição de valor e número de parcelas no Novo Acordo

## Causa (confirmada no código)
Quando o acordo é importado de um PDF/print, o sistema preenche "Parcelas do documento" e trava os campos **Valor Total do Acordo**, **Número de Parcelas** e **Data do 1º Pagamento** (ficam somente leitura). Por isso não dá para editar.

## O que muda
1. **Número de Parcelas editável**: ao mudar, a lista "Parcelas do documento" se ajusta sozinha:
   - aumentar: cria novas parcelas com o mesmo valor da última e vencimento um mês depois da anterior;
   - diminuir: remove as últimas parcelas.
2. **Valor Total editável**: ao digitar um novo total, a lista importada é deixada de lado e o formulário volta ao modo normal (Valor da 1ª parcela + Valor das demais), mantendo a quantidade e a data do 1º pagamento. Assim o cálculo de comissão segue as regras atuais.
3. **Data do 1º Pagamento editável**: ao mudar, atualiza o vencimento da 1ª parcela da lista.
4. Botão **"Descartar parcelas importadas"** acima da lista, para voltar ao preenchimento manual a qualquer momento.
5. A conferência "Valores não conferem" e as validações de envio continuam iguais.

Aplicado em Novo Acordo e Novo Acordo (Admin), se o mesmo bloqueio existir lá.

## Detalhes técnicos
- `src/pages/NovoAcordo.tsx` (e `NovoAcordoAdmin.tsx` se aplicável): remover `readOnly` dos três campos; `handleParcelasChange` redimensiona `parcelasDocumento`; `onChange` de valorTotal limpa `parcelasDocumento` e preenche valorPrimeiraParcela/valorDemaisParcelas a partir das parcelas atuais; data atualiza `rows[0].data_vencimento`.
- Sem mudanças no banco.
