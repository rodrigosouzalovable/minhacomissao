import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Botões USA B2B / USUÁRIO TESTE (3 dias) na lista de usuários do admin.
export function ClienteUsaToggles({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: todos } = useQuery({
    queryKey: ['cliente-usa-todos'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('cliente_usa_config').select('user_id, usa_b2b, teste_ate');
      if (error) throw error;
      return data;
    },
  });
  const cfg = todos?.find(c => c.user_id === userId);
  const usa = !!cfg?.usa_b2b;
  const teste = !!cfg?.teste_ate;
  const expira = cfg?.teste_ate ? new Date(cfg.teste_ate) : null;

  const salvar = async (u: boolean, t: boolean, dias = 0) => {
    const { error } = await supabase.rpc('admin_definir_cliente_usa', { _user_id: userId, _usa_b2b: u, _teste: t, _dias_extra: dias });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Cliente USA atualizado', description: u ? 'O usuário passa a ver só a área "AI Assistant (USA)" e o Inbox dele.' : undefined });
    qc.invalidateQueries({ queryKey: ['cliente-usa-todos'] });
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" className="h-8" variant={usa ? 'default' : 'outline'} onClick={() => salvar(!usa, usa ? false : teste)}>USA B2B</Button>
      {usa && (
        <Button size="sm" className="h-8" variant={teste ? 'default' : 'outline'} onClick={() => salvar(true, !teste)}
          title={expira ? `Expira em ${expira.toLocaleString('pt-BR')}` : 'Libera 3 dias de teste'}>
          USUÁRIO TESTE{expira ? (expira.getTime() < Date.now() ? ' (expirado)' : ` até ${expira.toLocaleDateString('pt-BR')}`) : ''}
        </Button>
      )}
      {usa && teste && <Button size="sm" variant="ghost" className="h-8" onClick={() => salvar(true, true, 1)}>+1 dia</Button>}
    </div>
  );
}
