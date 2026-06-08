import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ConfigMotivacaoDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [configId, setConfigId] = useState<string | null>(null);
  const [muralVisivel, setMuralVisivel] = useState(true);
  const [fraseData, setFraseData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fraseCustom, setFraseCustom] = useState('');
  const [fraseAutor, setFraseAutor] = useState('Gestão');
  const [saving, setSaving] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['config-motivacao-admin', open],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes_motivacao' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: open,
  });

  useEffect(() => {
    if (config) {
      setConfigId(config.id);
      setMuralVisivel(config.mural_top3_visivel ?? true);
      if (config.frase_data) setFraseData(config.frase_data);
      setFraseCustom(config.frase_custom ?? '');
      setFraseAutor(config.frase_autor ?? 'Gestão');
    }
  }, [config]);

  const { data: premios, refetch: refetchPremios } = useQuery({
    queryKey: ['premios-admin', open],
    queryFn: async () => {
      const { data } = await supabase
        .from('premios_semanais' as any)
        .select('*, profiles:user_id(nome)')
        .order('status', { ascending: true })
        .order('atingido_em', { ascending: false });
      return (data as any[]) || [];
    },
    enabled: open,
  });

  async function salvarConfig() {
    if (!configId) return;
    setSaving(true);
    const { error } = await supabase
      .from('configuracoes_motivacao' as any)
      .update({
        mural_top3_visivel: muralVisivel,
        frase_custom: fraseCustom || null,
        frase_data: fraseCustom ? fraseData : null,
        frase_autor: fraseAutor || null,
        atualizado_por: user?.id,
      })
      .eq('id', configId);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Configuração salva' });
    qc.invalidateQueries({ queryKey: ['mural-visivel'] });
    qc.invalidateQueries({ queryKey: ['frase-custom'] });
  }

  async function marcarPago(id: string) {
    const { error } = await supabase
      .from('premios_semanais' as any)
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Prêmio marcado como pago' });
    refetchPremios();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Motivação da equipe</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="frase" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="frase">Frase do dia</TabsTrigger>
            <TabsTrigger value="mural">Mural Top 3</TabsTrigger>
            <TabsTrigger value="premios">Prêmios</TabsTrigger>
          </TabsList>

          <TabsContent value="frase" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Escreva uma frase personalizada para uma data específica. Se vazio, será usada a frase fixa do dia.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={fraseData} onChange={e => setFraseData(e.target.value)} />
              </div>
              <div>
                <Label>Autor</Label>
                <Input value={fraseAutor} onChange={e => setFraseAutor(e.target.value)} placeholder="Gestão" />
              </div>
            </div>
            <div>
              <Label>Frase</Label>
              <Textarea
                rows={3}
                value={fraseCustom}
                onChange={e => setFraseCustom(e.target.value)}
                placeholder="Ex: Bora pra cima, time! Hoje é dia de virar o jogo."
                maxLength={240}
              />
              <p className="text-xs text-muted-foreground mt-1">{fraseCustom.length}/240</p>
            </div>
            <Button onClick={salvarConfig} disabled={saving}>Salvar frase</Button>
          </TabsContent>

          <TabsContent value="mural" className="space-y-3 pt-4">
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <p className="font-semibold">Mostrar Mural Top 3</p>
                <p className="text-sm text-muted-foreground">Aparece no dashboard dos funcionários.</p>
              </div>
              <Switch checked={muralVisivel} onCheckedChange={setMuralVisivel} />
            </div>
            <Button onClick={salvarConfig} disabled={saving}>Salvar visibilidade</Button>
          </TabsContent>

          <TabsContent value="premios" className="space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Prêmios de R$ 50 conquistados ao bater cada meta semanal.
            </p>
            {!premios?.length && (
              <p className="text-sm text-muted-foreground italic py-6 text-center">Nenhum prêmio registrado ainda.</p>
            )}
            {premios?.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium text-sm">
                    {p.profiles?.nome || 'Usuário'} — Semana {p.semana}/{p.mes_ano}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bateu em {format(new Date(p.atingido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {p.pago_em && ` · pago em ${format(new Date(p.pago_em), 'dd/MM/yyyy', { locale: ptBR })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === 'pago' ? 'secondary' : 'default'}>
                    {p.status === 'pago' ? 'Pago' : `${fmt(Number(p.valor))} pendente`}
                  </Badge>
                  {p.status !== 'pago' && (
                    <Button size="sm" onClick={() => marcarPago(p.id)}>Marcar pago</Button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
