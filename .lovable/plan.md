

## Reorganizar layout da ficha do cliente

### Problema atual
- O cabecalho mostra Nome, CPF/CNPJ e Telefone de forma simples, mas o usuario quer essas informacoes mais destacadas no quadrante principal
- A aba "Dados" repete informacoes que ja estao no cabecalho
- Contratos e Eventos ocupam um layout 2/3 + 1/3 que pode ser melhorado

### Alteracoes propostas

**Arquivo: `src/pages/DevedorDetalhe.tsx`**

**1. Cabecalho expandido com dados estruturados**
- Manter o card do cabecalho com o nome em destaque
- Abaixo do nome, exibir CPF/CNPJ, Telefone, Credor e Estagio em campos separados e organizados (grid de 2 ou 3 colunas), com labels claros
- Remover a aba "Dados" (que era redundante) e mover as informacoes relevantes (credor, descricao, estagio) para o cabecalho

**2. Abas reorganizadas**
- Remover a aba "Dados" (informacoes agora no cabecalho)
- A aba "Telefone" continua como esta, mas sem precisar de abas (vira secao direta ja que eh a unica)
- Ou manter abas adicionando funcionalidades futuras

**3. Layout de Contratos e Eventos**
- Manter o grid 2/3 + 1/3 mas com visual mais limpo:
  - **Contratos (esquerda):** adicionar a data de vencimento visivel diretamente no card resumido (sem precisar expandir), junto com o numero do contrato e valor
  - **Eventos (direita):** manter como esta (ja foi otimizado anteriormente)

### Detalhes tecnicos

**Cabecalho - de:**
```text
[Avatar] D DECORACOES LTDA
         CPF/CNPJ: 53566245000147 . Tel: 62981408877
```

**Cabecalho - para:**
```text
[Avatar] D DECORACOES LTDA                    [Voltar]
         ┌──────────────────┬──────────────────┬──────────────┐
         │ CPF/CNPJ         │ Telefone         │ Credor       │
         │ 53566245000147   │ 62981408877      │ MAISON DECOR │
         └──────────────────┴──────────────────┴──────────────┘
         Estagio: [novo]   Descricao: ...
```

**Contratos - cada card mostrara:**
```text
[1001118452]  MAISON DECOR       Venc: 27/04/2025   [298 dias atraso]   R$ 3.051,89  >
```

- Adicionar data de vencimento formatada diretamente na linha do card (sem precisar expandir)
- Secao de telefones fica logo abaixo do cabecalho, sem abas

**Resumo das mudancas no componente:**
1. Expandir o card header (linhas 239-258) com grid de campos estruturados (CPF, telefone, credor, estagio, descricao)
2. Remover TabsList e a aba "Dados" - colocar TelefoneTab diretamente
3. Nos cards de contrato (linhas 324-341), adicionar a data de vencimento formatada na linha resumida
4. Manter eventos como estao
