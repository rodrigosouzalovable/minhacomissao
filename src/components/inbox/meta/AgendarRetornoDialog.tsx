import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Check, Clock, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  clienteTelefone: string;
  clienteCpf?: string | null;
}

interface RetornoRow {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  observacao: string | null;
  data_retorno: string;
  status: string;
}

function hojeISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

const suffix8 = (v?: string | null) => String(v || '').replace(/\D/g, '').slice(-8);

export function AgendarRetornoDialog({ open, onOpenChange, clienteNome, clienteTelefone, clienteCpf }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState(clienteNome);
  const [data, setData] = useState(hojeISO());
  const [hora, setHora] = useState('09:00');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('agendar');
  const [historico, setHistorico] = useState<RetornoRow[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const carregarHistorico = useCallback(async () => {
    if (!user) return;
    setLoadingHist(true);
    const { data: rows, error } = await supabase
      .from('retornos')
      .select('id, cliente_nome, cliente_telefone, observacao, data_retorno, status')
      .eq('user_id', user.id)
      .order('data_retorno', { ascending: false })
      .limit(200);
    setLoadingHist(false);
    if (error) { toast.error(error.message); return; }
    setHistorico((rows || []) as RetornoRow[]);
  }, [user]);

  useEffect(() => {
    if (open) {
      setNome(clienteNome);
      setData(hojeISO());
      setHora('09:00');
      setObs('');
      setTab('agendar');
      carregarHistorico();
    }
  }, [open, clienteNome, carregarHistorico]);

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

  const concluir = async (id: string) => {
    const { error } = await supabase.from('retornos').update({ status: 'concluido' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setHistorico((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'concluido' } : r)));
    toast.success('Retorno marcado como concluído');
  };

  const agora = Date.now();
  const alvo = suffix8(clienteTelefone);
  const proximos = historico
    .filter((r) => new Date(r.data_retorno).getTime() >= agora && r.status !== 'concluido')
    .sort((a, b) => new Date(a.data_retorno).getTime() - new Date(b.data_retorno).getTime());
  const passados = historico.filter(
    (r) => new Date(r.data_retorno).getTime() < agora || r.status === 'concluido',
  );

  const Item = ({ r }: { r: RetornoRow }) => {
    const dt = new Date(r.data_retorno);
    const atrasado = r.status !== 'concluido' && dt.getTime() < agora;
    const desteContato = !!alvo && suffix8(r.cliente_telefone) === alvo;
    return (
      <div className={`rounded-md border p-2.5 ${desteContato ? 'border-primary/60 bg-primary/5' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">
              {dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              {r.cliente_telefone ? ` · ${r.cliente_telefone}` : ''}
            </p>
            {r.observacao && <p className="mt-1 text-xs text-muted-foreground">{r.observacao}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={r.status === 'concluido' ? 'secondary' : atrasado ? 'destructive' : 'outline'}>
              {r.status === 'concluido' ? 'Concluído' : atrasado ? 'Atrasado' : 'Pendente'}
            </Badge>
            {r.status !== 'concluido' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Marcar como concluído"
                onClick={() => concluir(r.id)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Retornos
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agendar">Agendar</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="agendar" className="space-y-3 pt-3">
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

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Agendar retorno'}</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="historico" className="pt-3">
            {loadingHist ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : historico.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum retorno agendado ainda.</p>
            ) : (
              <ScrollArea className="h-[380px] pr-3">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Próximos ({proximos.length})
                    </p>
                    {proximos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum retorno futuro.</p>
                    ) : (
                      proximos.map((r) => <Item key={r.id} r={r} />)
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Passados ({passados.length})
                    </p>
                    {passados.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum retorno anterior.</p>
                    ) : (
                      passados.map((r) => <Item key={r.id} r={r} />)
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
