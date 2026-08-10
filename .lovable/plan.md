# Coluna de valor sem centavos deve virar R$ 450,00

Na planilha `CSIM_33-2.xlsx` a coluna C vem como número inteiro (`450`, `540`, `787.5`) e sem linha de cabeçalho. A detecção atual de coluna monetária só reconhece números que já tenham separador decimal com 1-2 casas, então essa coluna não é marcada como valor: o seletor de formato nem aparece e o texto vai cru para a variável `{{2}}`.

## O que muda

1. **Detecção de valor mais ampla**
   Uma coluna passa a ser considerada monetária quando a maioria das amostras é numérica e não parece telefone/CPF/CNPJ (documento de 11/14 dígitos, telefone de 10-13 dígitos, ano de 4 dígitos). Inteiros como `450` e `780` entram nessa regra, assim como `787.5` e `1142,75`.

2. **Formatação sempre com duas casas**
   `450` → `R$ 450,00`; `787.5` → `R$ 787,50`; `1142.75` → `R$ 1.142,75`. Já era o comportamento do formatador; agora ele passa a ser aplicado a essa coluna.

3. **Papel padrão da coluna**
   Quando a coluna é detectada como monetária e o mapeamento automático não achou papel para ela, ela é sugerida como a variável de valor do template (primeiro placeholder ainda livre, ex. `{{2}}`) — ou como "Saldo (R$)" quando o template não tem placeholders. O usuário continua podendo trocar manualmente.

4. **Pré-visualização e envio**
   A amostra do diálogo mostra `R$ 450,00`, e o mesmo texto formatado é o que segue para o CSV e para as variáveis por telefone do disparo.

## Detalhes técnicos

- `src/lib/valorBR.ts`: `amostrasParecemValor` deixa de exigir separador decimal. Nova regra: ≥60% das amostras convertíveis por `parseNumeroBR`, excluindo valores cujo total de dígitos seja 10-14 (telefone/CPF/CNPJ) e inteiros de 4 dígitos que pareçam ano (1900-2100) sem decimais.
- `src/components/meta/MapearColunasImportDialog.tsx`: no `useEffect` de inicialização, colunas em `colunasMonetarias` que ficaram como `ignore` recebem `tplvar:<primeiro placeholder livre>` (ou `saldo` se não houver placeholders); `formatoPorColuna` permanece `brl` para elas.
- Nenhuma alteração em edge functions, banco ou worker de envio.
