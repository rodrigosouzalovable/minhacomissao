import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Check, X, Handshake } from 'lucide-react';
import { addMonths, format } from 'date-fns';

interface AcordoDevedor {
  id: string;
  devedor_cpf: string;
  valor_total: number;
  num_parcelas: number;
  data_primeiro_vencimento: string;
  criado_por: string;
  criado_em: string;
  status: string;
}

interface ParcelaDevedor {
  id: string;
  acordo_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  pago: boolean;
  data_pagamento: string | null;
}

interface Props {
  cpf: string;
  userId: string;
  contratosIds: string[];
  onContratosArquivados: () => void;
}

export function AcordoDevedorSection({ cpf, userId, contratosIds, onContratosArquivados }: Props) {
  const [acordos, setAcordos] = useState<AcordoDevedor[]>([]);
  const [parcelas, setParcelas] = useState<Record<string, ParcelaDevedor[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [valorTotal, setValorTotal] = useState('');
  const [numParcelas, setNumParcelas] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');

  const cpfNorm = cpf.replace(/\D/g, '');

  const fetchAcordos = useCallback(async () => {
    setLoading(true);
    const { data: acordosData } = await supabase
      .from('acordos_devedor' as any)
      .select('*')
      .eq('devedor_cpf', cpfNorm)
      .order('criado_em', { ascending: false });

    if (acordosData && (acordosData as any[]).length > 0) {
      const typedAcordos = acordosData as unknown as AcordoDevedor[];
      setAcordos(typedAcordos);

      const parcelasMap: Record<string, ParcelaDevedor[]> = {};
      for (const acordo of typedAcordos) {
        const { data: parcelasData } = await supabase
          .from('parcelas_devedor' as any)
          .select('*')
          .eq('acordo_id', acordo.id)
          .order('numero_parcela', { ascending: true });
        if (parcelasData) {
          parcelasMap[acordo.id] = parcelasData as unknown as ParcelaDevedor[];
        }
      }
      setParcelas(parcelasMap);
    } else {
      setAcordos([]);
      setParcelas({});
    }
    setLoading(false);
  }, [cpfNorm]);

  useEffect(() => { fetchAcordos(); }, [fetchAcordos]);

  const handleCriarAcordo = async () => {
    const valor = parseFloat(valorTotal);
    const parcCount = parseInt(numParcelas);
    if (!valor || valor <= 0 || !parcCount || parcCount < 1 || !dataVencimento) {
      toast.error('Preencha todos os campos corretamente.');
      return;
    }

    setSaving(true);
    try {
      // 1. Create agreement
      const { data: acordo, error: acordoErr } = await supabase
        .from('acordos_devedor' as any)
        .insert({
          devedor_cpf: cpfNorm,
          valor_total: valor,
          num_parcelas: parcCount,
          data_primeiro_vencimento: dataVencimento,
          criado_por: userId,
        } as any)
        .select()
        .single();

      if (acordoErr) throw acordoErr;

      const acordoId = (acordo as any).id;
      const valorParcela = Math.round((valor / parcCount) * 100) / 100;

      // 2. Generate installments
      const parcelasToInsert = [];
      for (let i = 0; i < parcCount; i++) {
        const dataVenc = addMonths(new Date(dataVencimento + 'T00:00:00'), i);
        parcelasToInsert.push({
          acordo_id: acordoId,
          numero_parcela: i + 1,
          valor: i === parcCount - 1
            ? Math.round((valor - valorParcela * (parcCount - 1)) * 100) / 100
            : valorParcela,
          data_vencimento: format(dataVenc, 'yyyy-MM-dd'),
        });
      }

      const { error: parcErr } = await supabase
        .from('parcelas_devedor' as any)
        .insert(parcelasToInsert as any);

      if (parcErr) throw parcErr;

      // 3. Archive existing contracts (set ativo = false)
      if (contratosIds.length > 0) {
        await supabase
          .from('devedores')
          .update({ ativo: false })
          .in('id', contratosIds);
      }

      toast.success('Acordo criado com sucesso!');
      setDialogOpen(false);
      setValorTotal('');
      setNumParcelas('');
      setDataVencimento('');
      onContratosArquivados();
      fetchAcordos();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao criar acordo: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePago = async (parcela: ParcelaDevedor) => {
    const novoPago = !parcela.pago;
    const { error } = await supabase
      .from('parcelas_devedor' as any)
      .update({
        pago: novoPago,
        data_pagamento: novoPago ? format(new Date(), 'yyyy-MM-dd') : null,
      } as any)
      .eq('id', parcela.id);

    if (error) {
      toast.error('Erro ao atualizar parcela.');
    } else {
      toast.success(novoPago ? 'Parcela marcada como paga!' : 'Pagamento desmarcado.');
      fetchAcordos();
    }
  };

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4" /> Acordos do Cliente
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Acordo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Lançar Acordo</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Valor Total Negociado (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="1"
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data do 1º Vencimento</Label>
                  <Input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                  />
                </div>
                {valorTotal && numParcelas && parseInt(numParcelas) > 0 && (
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    <p>Valor por parcela: <strong>{fmtBRL(parseFloat(valorTotal) / parseInt(numParcelas))}</strong></p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCriarAcordo} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar Acordo'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : acordos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum acordo registrado.</p>
        ) : (
          <div className="space-y-4">
            {acordos.map((acordo) => {
              const acordoParcelas = parcelas[acordo.id] || [];
              const pagas = acordoParcelas.filter(p => p.pago).length;
              return (
                <div key={acordo.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={acordo.status === 'ativo' ? 'default' : 'secondary'}>{acordo.status}</Badge>
                      <span className="font-semibold">{fmtBRL(acordo.valor_total)}</span>
                      <span className="text-xs text-muted-foreground">
                        {acordo.num_parcelas}x • {pagas}/{acordo.num_parcelas} pagas
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(acordo.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Nº</TableHead>
                        <TableHead className="text-xs">Vencimento</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acordoParcelas.map((parcela) => (
                        <TableRow key={parcela.id} className={parcela.pago ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                          <TableCell className="text-xs font-medium">{parcela.numero_parcela}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-xs">{fmtBRL(parcela.valor)}</TableCell>
                          <TableCell>
                            <Badge variant={parcela.pago ? 'default' : 'secondary'} className="text-xs">
                              {parcela.pago ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={parcela.pago ? 'outline' : 'default'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => togglePago(parcela)}
                            >
                              {parcela.pago ? (
                                <><X className="h-3 w-3 mr-1" /> Desmarcar</>
                              ) : (
                                <><Check className="h-3 w-3 mr-1" /> Marcar Pago</>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
