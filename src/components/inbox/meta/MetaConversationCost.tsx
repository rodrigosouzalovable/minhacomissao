import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock3, Loader2, ReceiptText } from 'lucide-react';

type Resumo = {
  valor_brl: number;
  entregues: number;
  cobradas: number;
  gratuitas: number;
  custo_iago: number;
  custo_humano: number;
  custo_outros: number;
  confirmado: boolean;
};

type Detalhe = {
  id: string;
  entregue_em: string | null;
  origem: string;
  categoria: string;
  status: string;
  valor_brl: number;
};

const ZERO: Resumo = {
  valor_brl: 0, entregues: 0, cobradas: 0, gratuitas: 0,
  custo_iago: 0, custo_humano: 0, custo_outros: 0, confirmado: true,
};

const dinheiro = (valor: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
}).format(Number(valor || 0));

const origemLabel = (origem: string) => origem === 'iago'
  ? 'IAGO'
  : origem === 'humano' ? 'Equipe' : origem === 'template' ? 'Template' : 'Automação';

export function MetaConversationCost({ contatoId, refreshKey }: { contatoId: string; refreshKey: string }) {
  const [resumo, setResumo] = useState<Resumo>(ZERO);
  const [detalhes, setDetalhes] = useState<Detalhe[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const carregarResumo = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('meta_conversa_custo_resumo', { p_contato_id: contatoId });
    const row = (data as Resumo[] | null)?.[0];
    setResumo(row ? {
      ...row,
      valor_brl: Number(row.valor_brl || 0),
      custo_iago: Number(row.custo_iago || 0),
      custo_humano: Number(row.custo_humano || 0),
      custo_outros: Number(row.custo_outros || 0),
    } : ZERO);
    setLoading(false);
  }, [contatoId]);

  useEffect(() => { void carregarResumo(); }, [carregarResumo, refreshKey]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.rpc('meta_conversa_custo_detalhes', { p_contato_id: contatoId });
      setDetalhes(((data || []) as Detalhe[]).map((d) => ({ ...d, valor_brl: Number(d.valor_brl || 0) })));
    })();
  }, [open, contatoId, refreshKey]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() => setOpen(true)}
        title="Ver custo desta conversa no mês"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}
        <span>Custo no mês: {dinheiro(resumo.valor_brl)}</span>
        {resumo.confirmado ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock3 className="h-3.5 w-3.5 text-amber-500" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Custo da conversa neste mês</DialogTitle>
            <DialogDescription>
              {resumo.entregues === 0
                ? 'Sem mensagens cobradas ou gratuitas confirmadas neste mês.'
                : `${resumo.entregues} entregues · ${resumo.cobradas} cobradas · ${resumo.gratuitas} gratuitas`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">IAGO</p><p className="font-semibold">{dinheiro(resumo.custo_iago)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Equipe</p><p className="font-semibold">{dinheiro(resumo.custo_humano)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Outros</p><p className="font-semibold">{dinheiro(resumo.custo_outros)}</p></div>
          </div>

          <div className="flex items-center justify-between border-y py-2 text-sm">
            <span className="font-medium">Total {dinheiro(resumo.valor_brl)}</span>
            <Badge variant={resumo.confirmado ? 'secondary' : 'outline'}>
              {resumo.confirmado ? 'Confirmado' : 'Estimado'}
            </Badge>
          </div>

          <ScrollArea className="max-h-[45vh]">
            <div className="space-y-1 pr-3">
              {detalhes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento nesta conversa.</p>
              ) : detalhes.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-b py-2 text-sm">
                  <div>
                    <p className="font-medium">{origemLabel(item.origem)} · {item.categoria}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.entregue_em ? new Date(item.entregue_em).toLocaleString('pt-BR') : 'Aguardando confirmação'} · {item.status}
                    </p>
                  </div>
                  <span className="font-medium">{dinheiro(item.valor_brl)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}