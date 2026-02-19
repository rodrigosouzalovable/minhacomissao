

## Corrigir atualização automática da Selic/INPC na Calculadora de Débito

### Problema identificado
Os contratos deste cliente (e possivelmente de outros) possuem `data_vencimento` como nulo no banco de dados. Sem data de vencimento, o sistema nao consegue calcular os meses de atraso (mostra "0 meses") nem buscar a taxa acumulada correta do BCB (mostra valores proximos de zero).

A funcao backend ja funciona corretamente - testei e ela retornou:
- **Selic acumulada** (jan/2025 a fev/2026): **16,36%**
- **INPC acumulado** (jan/2025 a fev/2026): **4,30%**

### Alteracoes necessarias

**Arquivo: `src/components/devedor/CalculadoraDebitoDialog.tsx`**

1. **Adicionar campo editavel de "Data Base" (data de referencia)**
   - Quando `data_vencimento` existir, usa como padrao
   - Quando nao existir, o usuario pode informar manualmente a data de referencia para o calculo
   - Ao alterar a data, recalcula automaticamente os meses de atraso e busca a nova taxa do BCB

2. **Recalcular juros e correção automaticamente ao mudar a data**
   - O `useEffect` ja busca a taxa quando a data muda, mas precisa reagir ao campo de data manual tambem
   - Meses de atraso recalculados em tempo real com base na data informada

3. **Melhorar o fluxo de busca da taxa**
   - Mostrar feedback visual durante a consulta (loading spinner - ja existe)
   - Exibir o periodo consultado apos retorno ("01/01/2025 a 19/02/2026")
   - Manter o campo editavel para ajuste manual se necessario

### Detalhes tecnicos

- Adicionar state `dataBase` (string) inicializado com `dataVencimento` ou vazio
- Input tipo `date` para o usuario informar/alterar a data base
- `mesesAtraso` e `diasAtraso` calculados com base em `dataBase` ao inves de `dataVencimento`
- `fetchTaxa` usa `dataBase` como `dataInicial`
- `useEffect` dispara `fetchTaxa` quando `dataBase` ou `tipoCorrecao` mudam

### Resultado esperado
- Ao abrir a calculadora, se o contrato tiver data de vencimento, busca a taxa automaticamente
- Se nao tiver, o usuario informa a data e o sistema busca e calcula tudo automaticamente
- Ao trocar entre Selic e INPC, busca a nova taxa automaticamente
- Todos os valores (juros, multa, correção, total, parcelas) atualizam em tempo real
