import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

const moeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

function maskCpf(cpf: string) {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

type Row = { cpf_cnpj: string; faixa: string; risco: number; nome: string | null };

export function IntocadosListDialog({ trigger, totalQtd }: { trigger: React.ReactNode; totalQtd: number }) {
  const q = useQuery({
    queryKey: ['comite-nm', 'intocados-list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('comite_carteira_nm_intocados', { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: false,
  });

  return (
    <Dialog onOpenChange={(o) => { if (o) q.refetch(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CPFs intocados há mais de 30 dias ({totalQtd.toLocaleString('pt-BR')})</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Mostrando os 100 CPFs de maior risco da carteira Novo Mundo sem nenhuma mensagem enviada nos últimos 30 dias.
        </p>
        {q.isLoading && <p className="text-sm py-4">Carregando…</p>}
        {q.isError && <p className="text-sm py-4 text-destructive">Erro ao carregar.</p>}
        {q.data && (
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">CPF</th>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Faixa</th>
                  <th className="text-right p-2">Risco</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((r) => (
                  <tr key={r.cpf_cnpj} className="border-b">
                    <td className="p-2 font-mono text-xs">{maskCpf(r.cpf_cnpj)}</td>
                    <td className="p-2">{r.nome ?? '—'}</td>
                    <td className="p-2">{r.faixa}</td>
                    <td className="p-2 text-right">{moeda(Number(r.risco) || 0)}</td>
                  </tr>
                ))}
                {q.data.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum CPF intocado encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
