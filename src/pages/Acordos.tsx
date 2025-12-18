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
import { formatarMoeda, formatarData } from '@/lib/comissao';
import { PlusCircle, Search, FileText } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type Acordo = Tables<'acordos'>;

export default function Acordos() {
  const { user } = useAuth();
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

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

  const filteredAcordos = acordos.filter(acordo => {
    const matchesSearch = acordo.cliente_nome.toLowerCase().includes(search.toLowerCase());
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
              placeholder="Buscar por cliente..."
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
                          <p className="text-sm text-muted-foreground">
                            {acordo.parcelas}x de {formatarMoeda(acordo.valor_parcela)} • {acordo.dias_atraso} dias em atraso
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em {formatarData(acordo.criado_em)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                        <Badge variant={getStatusVariant(acordo.status)}>
                          {getStatusLabel(acordo.status)}
                        </Badge>
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
    </AppLayout>
  );
}
