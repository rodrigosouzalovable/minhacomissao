import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays } from 'date-fns';

interface PaymentReminder {
  id: string;
  acordo_id: string;
  numero_parcela: number;
  data_prevista: string;
  valor_parcela: number;
  cliente_nome: string;
  tipo: 'hoje' | 'tres_dias';
}

export function usePaymentReminders() {
  const { user } = useAuth();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['payment-reminders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const hoje = format(new Date(), 'yyyy-MM-dd');
      const tresDias = format(addDays(new Date(), 3), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('pagamentos')
        .select(`
          id,
          acordo_id,
          numero_parcela,
          data_prevista,
          valor_parcela,
          acordos!inner(cliente_nome, user_id)
        `)
        .eq('status', 'pendente')
        .eq('acordos.user_id', user.id)
        .or(`data_prevista.eq.${hoje},data_prevista.eq.${tresDias}`);

      if (error) {
        console.error('Erro ao buscar lembretes:', error);
        return [];
      }

      return (data || []).map((pagamento: any) => ({
        id: pagamento.id,
        acordo_id: pagamento.acordo_id,
        numero_parcela: pagamento.numero_parcela,
        data_prevista: pagamento.data_prevista,
        valor_parcela: pagamento.valor_parcela,
        cliente_nome: pagamento.acordos.cliente_nome,
        tipo: pagamento.data_prevista === hoje ? 'hoje' : 'tres_dias',
      })) as PaymentReminder[];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  const lembretesHoje = reminders.filter((r) => r.tipo === 'hoje');
  const lembretesTresDias = reminders.filter((r) => r.tipo === 'tres_dias');

  return {
    reminders,
    lembretesHoje,
    lembretesTresDias,
    isLoading,
    temLembretes: reminders.length > 0,
  };
}
