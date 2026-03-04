

## Plan: Create a dedicated "Meta" page with personal monthly goals

### Current State
There's already a basic goal system in the Acionamento page using localStorage for daily/monthly goals. The user wants a dedicated sidebar page called "Meta" that is more complete, creative, and persistent.

### What will be built

A new **Meta** page (`/meta`) accessible from the sidebar for all employees. Each user sets their own monthly monetary goal (e.g., R$ 10.000). The system automatically tracks progress when installments are marked as paid, and displays:

- **Monthly goal** with progress bar and percentage
- **Daily target** (remaining amount / remaining business days in the month)
- **Weekly target** (daily target x 5)
- **Amount achieved today / this week / this month** (from paid installments)
- **Visual celebrations** when milestones are hit (25%, 50%, 75%, 100%)
- **Calendar heatmap** showing daily performance throughout the month
- **Motivational stats**: best day, streak of consecutive days meeting target

### Technical changes

**1. Database: `metas_funcionarios` table**
- Columns: `id`, `user_id`, `mes_ano` (text, e.g. "2026-03"), `valor_meta` (numeric), `criado_em`, `atualizado_em`
- Unique constraint on `(user_id, mes_ano)`
- RLS: users can manage their own rows, admins can see all

**2. New page: `src/pages/MetaPessoal.tsx`**
- Month selector (defaults to current month)
- Input to set/edit the monthly goal
- Dashboard cards showing:
  - Meta mensal + progress bar
  - Valor necessário por dia (meta restante / dias úteis restantes)
  - Valor necessário por semana (diário x 5)
  - Total recebido hoje / esta semana / este mês
- Calendar grid showing each day's performance with color coding
- The "recebido" values come from the `pagamentos` table (sum of `valor_parcela` where `status = 'pago'` and `data_paga` is in the relevant period, filtered by the user's `acordos`)

**3. Sidebar update: `src/components/layout/AppLayout.tsx`**
- Add nav item `{ href: '/meta', label: 'Meta', icon: Target }` available to all users

**4. Router update: `src/App.tsx`**
- Add route `/meta` as a ProtectedRoute

**5. Update `src/pages/AcordoDetalhe.tsx`**
- Keep existing localStorage logic for instant feedback, but also ensure the Meta page reads from the database for accurate totals

**6. Update `src/pages/Acionamento.tsx`**
- The existing meta dialog can link to the new Meta page or remain as a quick shortcut

### Database migration SQL
```sql
CREATE TABLE public.metas_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mes_ano text NOT NULL,
  valor_meta numeric NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_ano)
);

ALTER TABLE public.metas_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metas" ON public.metas_funcionarios
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metas" ON public.metas_funcionarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metas" ON public.metas_funcionarios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all metas" ON public.metas_funcionarios
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
```

