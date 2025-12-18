import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  // Buscar IDs de lembretes já lidos
  const { data: lembretesLidos = [] } = useQuery({
    queryKey: ['lembretes-lidos', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('lembretes_lidos')
        .select('pagamento_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao buscar lembretes lidos:', error);
        return [];
      }

      return data.map((l) => l.pagamento_id);
    },
    enabled: !!user,
  });

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
    refetchInterval: 5 * 60 * 1000,
  });

  // Filtrar lembretes não lidos e lidos
  const lembretesNaoLidos = reminders.filter(
    (r) => !lembretesLidos.includes(r.id)
  );
  const lembretesJaLidos = reminders.filter(
    (r) => lembretesLidos.includes(r.id)
  );

  // Mutation para marcar como lido
  const marcarComoLido = useMutation({
    mutationFn: async (pagamentoId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('lembretes_lidos')
        .insert({ user_id: user.id, pagamento_id: pagamentoId });

      if (error) throw error;
    },
    onSuccess: () => {
      // Recarrega os IDs lidos e, por consequência, a lista filtrada na UI
      queryClient.invalidateQueries({ queryKey: ['lembretes-lidos', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['payment-reminders', user?.id] });
    },
    onError: (error) => {
      console.error('Erro ao marcar lembrete como visto:', error);
    },
  });

  // Mutation para desmarcar (mostrar novamente)
  const desmarcarLido = useMutation({
    mutationFn: async (pagamentoId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('lembretes_lidos')
        .delete()
        .eq('user_id', user.id)
        .eq('pagamento_id', pagamentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lembretes-lidos', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['payment-reminders', user?.id] });
    },
    onError: (error) => {
      console.error('Erro ao desmarcar lembrete como visto:', error);
    },
  });

  const lembretesHoje = lembretesNaoLidos.filter((r) => r.tipo === 'hoje');
  const lembretesTresDias = lembretesNaoLidos.filter((r) => r.tipo === 'tres_dias');

  return {
    reminders: lembretesNaoLidos,
    lembretesHoje,
    lembretesTresDias,
    lembretesJaLidos,
    isLoading,
    temLembretes: lembretesNaoLidos.length > 0,
    marcarComoLido: marcarComoLido.mutate,
    desmarcarLido: desmarcarLido.mutate,
  };
}
