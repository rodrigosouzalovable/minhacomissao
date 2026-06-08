# Meta do Mês no Dashboard

## 1. Banner "Meta do Mês" no Dashboard do funcionário

Adicionar no topo de `src/pages/Dashboard.tsx` (acima do `ComparativoMensal`, visível para todos exceto admin) um card replicando o layout do anexo:

- **Título**: `🎯 Meta do Mês - {Mês Ano}` com lápis de edição (mantém comportamento da página `MetaPessoal` — clicar leva para `/meta-pessoal` ou abre edição inline).
- **Linha sub**: `R$ recebido de R$ meta`.
- **Badge à direita**: "↓ Abaixo da meta" / "↑ Acima da meta" / "✓ Meta batida" conforme projeção.
- **Barra de progresso** colorida (vermelho até 50%, amarelo 50–90%, verde ≥90%) com `%` ao centro.
- **Rodapé**: `Projeção de fechamento: R$ X` à esquerda; `N de M dias` à direita (dias úteis decorridos/total).
- **4 cards abaixo**:
  - 💲 Já Recebido — soma de pagamentos pagos no mês do user.
  - 📈 Falta Receber — `meta − recebido` (mín 0).
  - 📅 Dias Úteis Restantes.
  - 🎯 Necessário/Dia Útil — `falta / diasUteisRestantes`.

Reaproveita queries de `MetaPessoal.tsx` (tabela `metas_funcionarios` + `pagamentos` do user no mês). Se meta = 0, mostra CTA "Definir minha meta" linkando para `/meta-pessoal`.

Projeção = `recebido / diasUteisDecorridos × diasUteisTotal`.

Se admin: não mostra esse banner (admin já tem `MetasMensal`).

## 2. Botão "Definir Meta" no Dashboard do admin

Em `src/pages/Dashboard.tsx`, ao lado do botão "Novo Acordo" (renderizado só se `isAdmin`), botão `Definir Meta` que abre `DefinirMetasDialog`.

**Novo componente** `src/components/DefinirMetasDialog.tsx`:
- Seletor de mês (`<Input type="month">`, default mês atual).
- Lista de funcionários (query em `profiles` join `user_roles` onde role ∈ {`funcionario`, `gestor`}).
- Para cada um: nome + input de valor (R$), pré-preenchido com a meta atual do mês selecionado (se existir).
- Botão "Salvar todas" → `upsert` em `metas_funcionarios` por `(user_id, mes_ano)` com os valores não-zero.
- Botão "Replicar mês anterior" (opcional, copia do mês ant. para o selecionado).

## 3. Migration RLS — permitir admin gravar metas de qualquer funcionário

Hoje as policies de INSERT/UPDATE em `metas_funcionarios` só permitem o próprio user. Adicionar:

```sql
CREATE POLICY "Admins can insert any meta" ON public.metas_funcionarios
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update any meta" ON public.metas_funcionarios
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
```

`GRANT`s já existem (tabela já é usada).

## Arquivos
- editar `src/pages/Dashboard.tsx` (banner funcionário + botão admin)
- criar `src/components/MetaMesBanner.tsx`
- criar `src/components/DefinirMetasDialog.tsx`
- migration RLS

## Fora de escopo
- Página `/meta-pessoal` (já existe e continua funcional).
- Mudar componente `MetasMensal` do admin.
