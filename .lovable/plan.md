
## Plano: Botão Editar Meta e Cálculo de Dias Úteis

### Objetivo
1. Adicionar um botão para editar a meta do mês diretamente no Dashboard
2. Calcular o "Necessário/Dia" apenas para dias úteis (segunda a sexta-feira)

---

### Visão Geral

Atualmente, a meta está **hardcoded** no Dashboard (`metaValor={227000}`). Precisamos:
1. Criar uma tabela no banco para armazenar as metas mensais
2. Adicionar um botão de edição ao lado do título "Meta do Mês"
3. Criar um diálogo (modal) para definir/editar o valor da meta
4. Modificar o cálculo de "Necessário/Dia" para considerar apenas dias úteis

---

### Alterações Necessárias

#### 1. Banco de Dados
Criar tabela `metas_mensais` para armazenar as metas:
```sql
CREATE TABLE metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ano TEXT NOT NULL UNIQUE,  -- formato "2026-01"
  valor NUMERIC NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS: Apenas admins podem gerenciar
ALTER TABLE metas_mensais ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos autenticados
CREATE POLICY "Usuários autenticados podem ver metas"
  ON metas_mensais FOR SELECT TO authenticated USING (true);

-- Política de escrita apenas para admins
CREATE POLICY "Admins podem gerenciar metas"
  ON metas_mensais FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
```

#### 2. Componente MetasMensal (`src/components/MetasMensal.tsx`)

**Modificações:**
- Buscar a meta do banco de dados ao invés de receber como prop
- Adicionar botão de edição (ícone de lápis) ao lado do título
- Implementar modal de edição com campo de valor monetário
- Calcular dias úteis restantes (segunda a sexta) ao invés de dias corridos

**Função para calcular dias úteis:**
```typescript
function calcularDiasUteisRestantes(dataFim: Date, dataInicio: Date): number {
  let diasUteis = 0;
  const dataAtual = new Date(dataInicio);
  
  while (dataAtual <= dataFim) {
    const diaSemana = dataAtual.getDay();
    // 0 = Domingo, 6 = Sábado - ignorar finais de semana
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteis++;
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  return diasUteis;
}
```

**UI do botão de edição:**
```tsx
<CardTitle className="flex items-center gap-2 text-xl">
  <Target className="h-6 w-6 text-primary" />
  Meta do Mês - {mesNome}
  <Button 
    variant="ghost" 
    size="icon" 
    className="h-6 w-6 ml-1"
    onClick={() => setEditDialogOpen(true)}
  >
    <Pencil className="h-4 w-4" />
  </Button>
</CardTitle>
```

**Modal de edição:**
- Campo de input numérico com máscara de moeda (R$)
- Botões "Cancelar" e "Salvar"
- Ao salvar, fazer upsert na tabela `metas_mensais`
- Exibir toast de sucesso/erro

#### 3. Dashboard (`src/pages/Dashboard.tsx`)

**Modificações:**
- Remover prop `metaValor` hardcoded
- Passar apenas o `mesAno` para o componente (ou deixar o componente definir internamente)

---

### Fluxo de Alterações

```text
1. Criar tabela metas_mensais no banco
2. Atualizar MetasMensal.tsx:
   ├── Adicionar estado para edição (editDialogOpen, newMetaValue)
   ├── Buscar meta do banco (SELECT)
   ├── Adicionar botão de edição
   ├── Implementar modal de edição
   ├── Função salvar meta (UPSERT)
   └── Calcular dias úteis restantes
3. Atualizar Dashboard.tsx:
   └── Ajustar chamada do componente
```

---

### Cálculo de Dias Úteis - Antes vs Depois

| Item | Antes | Depois |
|------|-------|--------|
| Dias Restantes | Todos os dias (corridos) | Apenas segunda a sexta |
| Necessário/Dia | valorFaltante / diasRestantes | valorFaltante / diasUteisRestantes |
| Meta por dia individual | Mesma lógica | Atualizada para dias úteis |

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Banco de dados** | Criar tabela `metas_mensais` com RLS |
| `src/components/MetasMensal.tsx` | Adicionar edição de meta + cálculo dias úteis |
| `src/pages/Dashboard.tsx` | Remover metaValor hardcoded |

---

### Comportamento Esperado

1. **Visualização:** O card "Meta do Mês" exibirá um ícone de lápis ao lado do título
2. **Edição:** Ao clicar no lápis, abre um modal para digitar o novo valor
3. **Salvamento:** O valor é salvo no banco e atualizado em tempo real
4. **Dias Úteis:** O card "Necessário/Dia" calculará com base apenas em dias de segunda a sexta
5. **Persistência:** A meta fica salva para o mês específico e pode ser consultada/editada posteriormente

---

### Detalhes Técnicos

**Estrutura do modal de edição:**
- Input com formatação de moeda brasileira
- Validação: valor deve ser maior que zero
- Feedback visual ao salvar (loading state no botão)
- Toast de confirmação após sucesso
