import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Ban, Download, Search, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { exportarParaExcel } from '@/lib/exportExcel';
import { toast } from 'sonner';

interface BlacklistRow {
  telefone_sufixo: string;
  telefone: string | null;
  motivo: string | null;
  criado_em: string;
  instancia_id: string | null;
  contato_nome: string | null;
  credor: string | null;
}

function formatarTelefone(tel: string | null, sufixo: string) {
  const dig = (tel || sufixo || '').replace(/\D/g, '');
  if (dig.length >= 12) {
    const ddd = dig.slice(2, 4);
    const resto = dig.slice(4);
    return `+55 (${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
  }
  if (dig.length >= 10) {
    return `(${dig.slice(0, 2)}) ${dig.slice(2, dig.length - 4)}-${dig.slice(-4)}`;
  }
  return dig;
}

export default function Blacklist() {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [instanciaFiltro, setInstanciaFiltro] = useState('todas');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { data: instancias } = useQuery({
    queryKey: ['blacklist-instancias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_whatsapp_instances')
        .select('id, nome, display_phone')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const nomeInstancia = useMemo(() => {
    const m = new Map<string, string>();
    (instancias ?? []).forEach((i: any) => {
      m.set(i.id, [i.nome, i.display_phone].filter(Boolean).join(' · '));
    });
    return m;
  }, [instancias]);

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['blacklist', instanciaFiltro, de, ate],
    queryFn: async () => {
      let q = supabase
        .from('meta_destinatario_supressao')
        .select('telefone_sufixo, telefone, motivo, criado_em, instancia_id, contato_nome, credor')
        .like('motivo', 'blacklist%')
        .order('criado_em', { ascending: false })
        .limit(1000);
      if (instanciaFiltro !== 'todas') q = q.eq('instancia_id', instanciaFiltro);
      if (de) q = q.gte('criado_em', new Date(`${de}T00:00:00`).toISOString());
      if (ate) q = q.lte('criado_em', new Date(`${ate}T23:59:59`).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BlacklistRow[];
    },
    staleTime: 60_000,
  });

  const filtradas = useMemo(() => {
    const termo = busca.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!termo) return linhas ?? [];
    const digitos = termo.replace(/\D/g, '');
    return (linhas ?? []).filter((l) => {
      const nome = (l.contato_nome || '').toLowerCase();
      const tel = (l.telefone || l.telefone_sufixo || '');
      return nome.includes(termo) || (digitos.length >= 3 && tel.includes(digitos));
    });
  }, [linhas, busca]);

  async function remover(sufixo: string) {
    const { error } = await supabase
      .from('meta_destinatario_supressao')
      .delete()
      .eq('telefone_sufixo', sufixo);
    if (error) {
      toast.error('Não foi possível remover da blacklist');
      return;
    }
    toast.success('Número removido da blacklist');
    queryClient.invalidateQueries({ queryKey: ['blacklist'] });
  }

  async function exportar() {
    if (!filtradas.length) {
      toast.error('Nada para exportar');
      return;
    }
    await exportarParaExcel(
      filtradas.map((l) => ({
        telefone: formatarTelefone(l.telefone, l.telefone_sufixo),
        nome: l.contato_nome || '',
        instancia: l.instancia_id ? (nomeInstancia.get(l.instancia_id) || l.instancia_id) : '',
        credor: l.credor || '',
        motivo: l.motivo || '',
        data: new Date(l.criado_em).toLocaleString('pt-BR'),
      })),
      [
        { chave: 'telefone', titulo: 'Telefone' },
        { chave: 'nome', titulo: 'Nome' },
        { chave: 'instancia', titulo: 'Instância de origem' },
        { chave: 'credor', titulo: 'Credor' },
        { chave: 'motivo', titulo: 'Motivo' },
        { chave: 'data', titulo: 'Data do bloqueio' },
      ],
      'blacklist',
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ban className="h-6 w-6 text-destructive" />
              Blacklist
            </h1>
            <p className="text-sm text-muted-foreground">
              Clientes que pediram "Bloquear contato" e não recebem mais campanhas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{filtradas.length} números</Badge>
            <Button variant="outline" size="sm" onClick={exportar}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Telefone ou nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={instanciaFiltro} onValueChange={setInstanciaFiltro}>
              <SelectTrigger><SelectValue placeholder="Instância" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as instâncias</SelectItem>
                {(instancias ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {[i.nome, i.display_phone].filter(Boolean).join(' · ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Instância de origem</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum número na blacklist.
                    </TableCell>
                  </TableRow>
                )}
                {filtradas.map((l) => (
                  <TableRow key={l.telefone_sufixo}>
                    <TableCell className="font-medium">
                      {formatarTelefone(l.telefone, l.telefone_sufixo)}
                    </TableCell>
                    <TableCell>{l.contato_nome || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {l.instancia_id
                        ? (nomeInstancia.get(l.instancia_id) || '—')
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{l.credor || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(l.criado_em).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild title="Abrir conversa">
                          <Link to={`/admin/inbox-meta?telefone=${l.telefone || l.telefone_sufixo}`}>
                            <MessageSquare className="h-4 w-4" />
                          </Link>
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remover da blacklist"
                            onClick={() => remover(l.telefone_sufixo)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
