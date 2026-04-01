

## Adicionar seleção múltipla na aba Números

### Arquivo: `src/pages/Aquecimento.tsx`

**Alterações:**
1. Adicionar estado `selectedInstances` (Set de IDs) para controlar quais instâncias estão selecionadas
2. Adicionar checkbox "Selecionar todos" no cabeçalho da tabela (coluna nova antes de "Nome")
3. Adicionar checkbox individual em cada linha da tabela
4. Adicionar botão "Iniciar Aquecimento" acima da tabela que aparece quando há instâncias selecionadas, permitindo iniciar o aquecimento para todas as selecionadas de uma vez
5. Lógica do "Selecionar todos" marca/desmarca apenas instâncias ativas que estão INATIVAS ou PAUSADAS (elegíveis para iniciar)

**Componente usado:** `Checkbox` de `@/components/ui/checkbox` (já existe no projeto)

**Layout da tabela atualizado:**
```text
[✓] | Nome | Fase | Dias na Fase | Interações Hoje | Taxa Resposta | Status | Ações
```

**Botão de ação em massa:** aparece condicionalmente acima da tabela quando `selectedInstances.size > 0`, com texto "Iniciar Aquecimento (N selecionados)"

