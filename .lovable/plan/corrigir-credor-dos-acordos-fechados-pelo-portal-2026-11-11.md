# Corrigir credor dos acordos fechados pelo portal

## Causa confirmada
No sistema, "UME" é gravado com o código `mundo_da_moda` e "NOVO MUNDO" com `ume_novo_mundo`. O lançamento automático do portal grava acordos UME com o código de NOVO MUNDO. Hoje há 116 acordos do portal marcados "(UME)" nas observações mas salvos como NOVO MUNDO (incluindo o CPF 738.864.839-91).

## O que será feito
1. Lançamento do portal: UME passa a ser gravado como UME; Odres Cred continua igual. O credor continua vindo da carteira real do cliente (já verificada pelo sistema), não da tela escolhida.
2. Corrigir os 116 acordos já lançados errados para UME (somente os com observação "Acordo fechado pelo cliente no portal (UME)").
3. Pequeno teste garantindo: portal UME -> credor UME; portal Odres -> Odres Cred.

## Observação
A comissão desses acordos usa a regra do credor; após a correção, as telas de recebimentos/comissão passam a mostrá-los em UME.

## Detalhes técnicos
- `supabase/functions/portal-efetivar-acordo/index.ts` linha 109: `empresa: credorReal === 'ume' ? 'mundo_da_moda' : 'odres_cred'`, extraído para helper testável.
- Recalcular `percentual_comissao`/`comissao_parcela` conforme `src/lib/comissao.ts` se a regra de UME diferir.
- UPDATE em `acordos` filtrado por observação do portal (UME) e empresa `ume_novo_mundo`.
