import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  clienteTelefone: string;
  clienteCpf?: string | null;
}

function hojeISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function AgendarRetornoDialog({ open, onOpenChange, clienteNome, clienteTelefone, clienteCpf }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState(clienteNome);
  const [data, setData] = useState(hojeISO());
  const [hora, setHora] = useState('09:00');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(clienteNome);
      setData(hojeISO());
      setHora('09:00');
      setObs('');
    }
  }, [open, clienteNome]);

  const salvar = async () => {
    if (!user) return;
    if (!nome.trim()) { toast.error('Informe o nome do cliente'); return; }
    if (!data || !hora) { toast.error('Informe data e hora do retorno'); return; }
    const quando = new Date(`${data}T${hora}:00`);
    if (isNaN(quando.getTime())) { toast.error('Data/hora inválida'); return; }

    setSaving(true);
    const { error } = await supabase.from('retornos').insert({
      user_id: user.id,
      cliente_nome: nome.trim(),
      cliente_cpf: String(clienteCpf || '').replace(/\D/g, ''),
      cliente_telefone: clienteTelefone || '',
      observacao: obs.trim() || null,
      data_retorno: quando.toISOString(),
      status: 'pendente',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Retorno agendado para ${quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Agendar retorno
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={clienteTelefone || '—'} readOnly className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: cliente pediu para retornar após o pagamento do salário"
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            No dia e horário definidos aparecerá um pop-up na tela com esse lembrete.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Agendar retorno'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
