import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUserRole } from '@/hooks/useUserRole';

export interface OverdueInstallment {
  id: string;
  acordo_id: string;
  numero_parcela: number;
  data_prevista: string;
  valor_parcela: number;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone?: string;
  user_id: string;
  tipo: 'vencido';
  categoria: 'pagamento';
}

export function useOverdueInstallments() {
  const { user } = useAuth();
  const { acordosCompartilhados, concedidoPor } = useUserPermissions();
  const { isAdmin } = useUserRole();
  const adminId = acordosCompartilhados && concedidoPor ? concedidoPor : null;
  const userIds = adminId ? [user?.id, adminId].filter(Boolean) as string[] : user ? [user.id] : [];

  return useQuery({
    queryKey: ['overdue-reminders', user?.id, adminId, isAdmin],
    queryFn: async () => {
      if (!user || (!isAdmin && userIds.length === 0)) return [];

      const hoje = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('pagamentos')
        .select(`
          id,
          acordo_id,
          numero_parcela,
          data_prevista,
          valor_parcela,
          acordos!inner(cliente_nome, cliente_cpf, cliente_telefone, user_id, status)
        `)
        .eq('status', 'pendente')
        .eq('acordos.status', 'ativo')
        .lt('data_prevista', hoje)
        .order('data_prevista', { ascending: true });

      if (!isAdmin) query = query.in('acordos.user_id', userIds);

      const { data, error } = await query;
      if (error) throw error;

      const installments = (data || []).map((pagamento: any) => ({
        id: pagamento.id,
        acordo_id: pagamento.acordo_id,
        numero_parcela: pagamento.numero_parcela,
        data_prevista: pagamento.data_prevista,
        valor_parcela: pagamento.valor_parcela,
        cliente_nome: pagamento.acordos.cliente_nome,
        cliente_cpf: pagamento.acordos.cliente_cpf,
        cliente_telefone: pagamento.acordos.cliente_telefone,
        user_id: pagamento.acordos.user_id,
        tipo: 'vencido',
        categoria: 'pagamento',
      })) as OverdueInstallment[];

      const acordoIds = [...new Set(installments.map(item => item.acordo_id))];
      if (acordoIds.length === 0) return installments;

      const { data: paidInstallments, error: paidError } = await supabase
        .from('pagamentos')
        .select('acordo_id, numero_parcela')
        .in('acordo_id', acordoIds)
        .eq('status', 'pago');
      if (paidError) throw paidError;

      const highestPaidByAgreement = new Map<string, number>();
      for (const paid of paidInstallments || []) {
        const current = highestPaidByAgreement.get(paid.acordo_id) ?? 0;
        highestPaidByAgreement.set(paid.acordo_id, Math.max(current, paid.numero_parcela));
      }

      return installments.filter(item => (highestPaidByAgreement.get(item.acordo_id) ?? 0) < item.numero_parcela);
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 10 * 60 * 1000 : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}