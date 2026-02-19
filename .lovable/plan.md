

## Reorganizar Contratos no formato de tabela

### O que sera feito

Transformar a secao de Contratos para seguir o layout da imagem de referencia, onde cada contrato expandido mostra seus dados em formato de tabela com colunas.

### Layout proposto

**Cabecalho do card (mantido):**
```text
v Contratos          Total em Atraso R$ XX.XXX,XX    [Calculo]
```

**Cada contrato (linha resumida - CollapsibleTrigger):**
```text
v 1001118452 *    MAISON DECOR - Atraso: 298    Venc: 27/04/2025
```

**Contrato expandido (CollapsibleContent) - formato tabela:**

| Numero | Vencimento | Valor | Atraso | Estagio | Descricao |
|--------|------------|-------|--------|---------|-----------|
| 1001118452 | 27/04/2025 | 3.051,89 | 298 | novo | ... |

### Detalhes tecnicos

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

1. **Linha resumida do contrato (linhas 324-346):** Reorganizar para mostrar numero do contrato com indicador (bolinha verde/vermelha baseada no estagio), credor, dias de atraso e data de vencimento no formato da imagem: `1001118452 * MAISON DECOR - Atraso: 298 Venc: 27/04/2025`

2. **Conteudo expandido (linhas 348-356):** Substituir o layout atual de pares chave-valor por uma mini-tabela (usando elementos `table` ou grid) com colunas:
   - Numero (contrato)
   - Vencimento (data formatada)
   - Valor (valor_atualizado formatado)
   - Atraso (dias)
   - Estagio (badge)
   - Descricao (observacao)

3. **Estilo:** Usar `<table>` com classes Tailwind para bordas sutis e alinhamento, similar ao componente Table do shadcn/ui ja disponivel no projeto (`src/components/ui/table.tsx`). Headers em negrito com fundo muted.

4. **Informacoes adicionais na expansao:** Adicionar tambem Valor Original como linha extra ou campo visivel na tabela.

### Resultado esperado

- Contratos em formato tabular quando expandidos, similar a imagem de referencia
- Linha resumida mais informativa com numero, credor, atraso e vencimento
- Visual mais organizado e profissional para triagem rapida dos contratos

