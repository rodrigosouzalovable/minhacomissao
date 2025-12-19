import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatarMoeda } from '@/lib/comissao';
import { DollarSign, CheckCircle, Clock, Percent } from 'lucide-react';

interface ComissaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

interface ComissaoData {
  comissaoTotal: number;
  comissaoPaga: number;
  comissaoPendente: number;
  percentualRecebido: number;
}

export function ComissaoDialog({ open, onOpenChange, userId, userName }: ComissaoDialogProps) {
  const { data: comissaoData, isLoading } = useQuery({
    queryKey: ['user-comissao', userId],
    queryFn: async (): Promise<ComissaoData> => {
      // Buscar acordos do usuário
      const { data: acordos, error: acordosError } = await supabase
        .from('acordos')
        .select('id, comissao_total')
        .eq('user_id', userId);

      if (acordosError) throw acordosError;

      if (!acordos || acordos.length === 0) {
        return {
          comissaoTotal: 0,
          comissaoPaga: 0,
          comissaoPendente: 0,
          percentualRecebido: 0,
        };
      }

      const acordoIds = acordos.map(a => a.id);

      // Buscar todos os pagamentos dos acordos
      const { data: pagamentos, error: pagamentosError } = await supabase
        .from('pagamentos')
        .select('comissao_parcela, status')
        .in('acordo_id', acordoIds);

      if (pagamentosError) throw pagamentosError;

      // Calcular comissões
      const comissaoTotal = pagamentos?.reduce((sum, p) => sum + Number(p.comissao_parcela), 0) ?? 0;
      const comissaoPaga = pagamentos?.filter(p => p.status === 'pago')
        .reduce((sum, p) => sum + Number(p.comissao_parcela), 0) ?? 0;
      const comissaoPendente = comissaoTotal - comissaoPaga;
      const percentualRecebido = comissaoTotal > 0 ? (comissaoPaga / comissaoTotal) * 100 : 0;

      return {
        comissaoTotal,
        comissaoPaga,
        comissaoPendente,
        percentualRecebido,
      };
    },
    enabled: open && !!userId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comissões - {userName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando comissões...
          </div>
        ) : comissaoData ? (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {formatarMoeda(comissaoData.comissaoTotal)}
                </div>
                <p className="text-xs text-muted-foreground">Todas as parcelas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Comissão Paga</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">
                  {formatarMoeda(comissaoData.comissaoPaga)}
                </div>
                <p className="text-xs text-muted-foreground">Parcelas pagas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Comissão Pendente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600">
                  {formatarMoeda(comissaoData.comissaoPendente)}
                </div>
                <p className="text-xs text-muted-foreground">A receber</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Percentual Recebido</CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-primary">
                  {comissaoData.percentualRecebido.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Do total</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado de comissão encontrado.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
