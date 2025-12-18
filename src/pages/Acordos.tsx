import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { PlusCircle, Search, FileText, Trash2, Phone, User } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Acordo = Tables<'acordos'>;

export default function Acordos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [acordoParaExcluir, setAcordoParaExcluir] = useState<Acordo | null>(null);

  useEffect(() => {
    async function loadAcordos() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('acordos')
          .select('*')
          .eq('user_id', user.id)
          .order('criado_em', { ascending: false });

        if (error) throw error;
        setAcordos(data || []);
      } catch (error) {
        console.error('Erro ao carregar acordos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAcordos();
  }, [user]);

  const handleDelete = async (acordoId: string) => {
    try {
      // Primeiro, deletar os pagamentos associados
      const { error: pagamentosError } = await supabase
        .from('pagamentos')
        .delete()
        .eq('acordo_id', acordoId);

      if (pagamentosError) throw pagamentosError;

      // Depois, deletar o acordo
      const { error: acordoError } = await supabase
        .from('acordos')
        .delete()
        .eq('id', acordoId);

      if (acordoError) throw acordoError;

      // Atualizar lista local
      setAcordos(prev => prev.filter(a => a.id !== acordoId));

      toast({
        title: 'Acordo excluído',
        description: 'O acordo foi removido com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao excluir acordo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o acordo.',
      });
    }
  };

  const filteredAcordos = acordos.filter(acordo => {
    const matchesSearch = acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
      (acordo.cliente_cpf && acordo.cliente_cpf.includes(search));
    const matchesStatus = statusFilter === 'todos' || acordo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'concluido': return 'secondary';
      case 'cancelado': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Meus Acordos</h1>
          <Button asChild>
            <Link to="/acordos/novo">
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Acordo
            </Link>
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de acordos */}
        {filteredAcordos.length > 0 ? (
          <div className="grid gap-4">
            {filteredAcordos.map((acordo) => (
              <Link key={acordo.id} to={`/acordos/${acordo.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{acordo.cliente_nome}</h3>
                          {(acordo.cliente_cpf || acordo.cliente_telefone) && (
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                              {acordo.cliente_cpf && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {acordo.cliente_cpf}
                                </span>
                              )}
                              {acordo.cliente_telefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {acordo.cliente_telefone}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {acordo.parcelas}x de {formatarMoeda(acordo.valor_parcela)} • {acordo.dias_atraso} dias em atraso
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {formatarData(acordo.criado_em)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(acordo.status)}>
                            {getStatusLabel(acordo.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAcordoParaExcluir(acordo);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="font-semibold">{formatarMoeda(acordo.valor_total)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Comissão</p>
                          <p className="font-semibold text-secondary">{formatarMoeda(acordo.comissao_total)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum acordo encontrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                {search || statusFilter !== 'todos'
                  ? 'Tente ajustar os filtros'
                  : 'Comece cadastrando seu primeiro acordo'}
              </p>
              {!search && statusFilter === 'todos' && (
                <Button asChild>
                  <Link to="/acordos/novo">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo Acordo
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!acordoParaExcluir} onOpenChange={(open) => !open && setAcordoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acordo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O acordo com <strong>{acordoParaExcluir?.cliente_nome}</strong> e todas as suas parcelas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAcordoParaExcluir(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (acordoParaExcluir) {
                  handleDelete(acordoParaExcluir.id);
                  setAcordoParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}