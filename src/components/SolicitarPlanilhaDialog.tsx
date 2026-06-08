import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

const FAIXAS = ['30-60 dias', '60-90 dias', '90-180 dias', '180-360 dias', '360+ dias'];
const CREDORES = ['MONTREAL', 'UME NOVO MUNDO', 'APORTE', 'OUTROS'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SolicitarPlanilhaDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [faixas, setFaixas] = useState<string[]>([]);
  const [credores, setCredores] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(50);
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const toggle = (arr: string[], set: (a: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const enviar = async () => {
    if (!faixas.length && !credores.length) {
      toast.error('Selecione ao menos uma faixa ou credor');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('solicitacoes_planilha' as any).insert({
        user_id: user!.id,
        faixas_atraso: faixas,
        credores: credores,
        qtd_clientes: qtd,
        observacao: obs || null,
      });
      if (error) throw error;

      // Notifica admin via WA
      try {
        await supabase.functions.invoke('notificar-admin', {
          body: {
            mensagem: `📨 *Nova solicitação de planilha*\n\nFuncionário: ${user!.email}\nFaixas: ${faixas.join(', ') || '—'}\nCredores: ${credores.join(', ') || '—'}\nQtd desejada: ${qtd}\n${obs ? `\nObs: ${obs}` : ''}`,
          },
        });
      } catch {}

      toast.success('Solicitação enviada ao admin!');
      onOpenChange(false);
      setFaixas([]); setCredores([]); setQtd(50); setObs('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>📨 Solicitar nova planilha de cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Faixas de atraso</Label>
            <div className="grid grid-cols-2 gap-2">
              {FAIXAS.map(f => (
                <label key={f} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent">
                  <Checkbox checked={faixas.includes(f)} onCheckedChange={() => toggle(faixas, setFaixas, f)} />
                  <span className="text-sm">{f}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Credores</Label>
            <div className="grid grid-cols-2 gap-2">
              {CREDORES.map(c => (
                <label key={c} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent">
                  <Checkbox checked={credores.includes(c)} onCheckedChange={() => toggle(credores, setCredores, c)} />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Quantidade desejada de clientes</Label>
            <Input type="number" min={1} value={qtd} onChange={e => setQtd(Number(e.target.value))} />
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: prefiro CPFs com telefone localizado, evitar UF X..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
