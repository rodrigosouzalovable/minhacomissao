import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, PhoneIncoming, PhoneOutgoing } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  telefone: string;
  nome?: string | null;
}

type Row = {
  id: string;
  tipo_chamada: string;
  status: string;
  duracao_segundos: number;
  data_inicio: string;
  custo_estimado: number | null;
  erro: string | null;
};

const rotuloStatus: Record<string, string> = {
  iniciada: 'Iniciada', ringing: 'Chamando', em_andamento: 'Em andamento',
  concluida: 'Concluída', perdida: 'Não atendida', rejeitada: 'Recusada', erro: 'Erro',
};

const corStatus: Record<string, string> = {
  concluida: 'border-emerald-500/40 text-emerald-500',
  perdida: 'border-amber-500/40 text-amber-500',
  rejeitada: 'border-red-500/40 text-red-500',
  erro: 'border-red-500/40 text-red-500',
};

const dur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

export function HistoricoChamadasDialog({ open, onOpenChange, telefone, nome }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      const { data } = await supabase.from('whatsapp_chamadas')
        .select('id, tipo_chamada, status, duracao_segundos, data_inicio, custo_estimado, erro')
        .eq('telefone', String(telefone || '').replace(/\D/g, ''))
        .order('data_inicio', { ascending: false })
        .limit(50);
      if (!ativo) return;
      setRows((data as Row[]) ?? []);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [open, telefone]);

  const totalUsd = rows.reduce((a, r) => a + Number(r.custo_estimado || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de chamadas</DialogTitle>
          <DialogDescription>
            {nome ? `${nome} · ` : ''}{telefone}
            {totalUsd > 0 && ` · custo estimado US$ ${totalUsd.toFixed(3)}`}
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma chamada registrada com este número.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded border p-2">
                {r.tipo_chamada === 'entrada'
                  ? <PhoneIncoming className="h-4 w-4 text-sky-500 shrink-0" />
                  : <PhoneOutgoing className="h-4 w-4 text-primary shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {new Date(r.data_inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.tipo_chamada === 'entrada' ? 'Recebida' : 'Efetuada'}
                    {r.duracao_segundos > 0 && ` · ${dur(r.duracao_segundos)}`}
                    {r.erro && ` · ${r.erro}`}
                  </p>
                </div>
                <Badge variant="outline" className={corStatus[r.status] ?? ''}>
                  {rotuloStatus[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
