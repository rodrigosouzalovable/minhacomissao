import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, Users, SearchX, Eye, Link2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface ClienteRow {
  id: string;
  nome: string;
  cpf: string;
  credor: string | null;
  contrato: string | null;
  valor_original: number;
  valor_atualizado: number;
  estagio: string;
}

interface ClienteAgrupado {
  id: string;
  nome: string;
  cpf: string;
  credor: string | null;
  qtdContratos: number;
  valorTotal: number;
  estagios: string[];
  isGrupo?: boolean;
  grupoId?: string;
  cpfsGrupo?: string[];
}

interface GrupoMembro {
  id: string;
  grupo_id: string;
  nome_grupo: string;
  cpf_cnpj: string;
}

const CREDORES = ['MUNDO DA MODA', 'UME | NOVO MUNDO', 'MONTREAL'];
const ESTAGIOS = [
  { value: 'novo', label: 'Novo' },
  { value: 'andamento', label: 'Andamento' },
  { value: 'finalizado', label: 'Finalizado' },
];

const PAGE_SIZE = 20;

export default function Clientes() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [telefone, setTelefone] = useState('');
  const [credor, setCredor] = useState('todos');
  const [estagio, setEstagio] = useState('todos');
  const [rawResults, setRawResults] = useState<ClienteRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Grupo empresarial state
  const [grupos, setGrupos] = useState<GrupoMembro[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  // Fetch groups on mount
  useEffect(() => {
    const fetchGrupos = async () => {
      const { data } = await supabase.from('grupo_empresarial_membros' as any).select('*');
      if (data) setGrupos(data as unknown as GrupoMembro[]);
    };
    fetchGrupos();
  }, []);

  const grouped = useMemo<ClienteAgrupado[]>(() => {
    // Step 1: Group by CPF (existing logic)
    const map: Record<string, ClienteAgrupado> = {};
    for (const row of rawResults) {
      const cpfNorm = row.cpf.replace(/\D/g, '');
      if (!map[cpfNorm]) {
        map[cpfNorm] = { id: row.id, nome: row.nome, cpf: row.cpf, credor: row.credor, qtdContratos: 0, valorTotal: 0, estagios: [] };
      }
      map[cpfNorm].qtdContratos += 1;
      map[cpfNorm].valorTotal += Number(row.valor_atualizado);
      if (!map[cpfNorm].estagios.includes(row.estagio)) map[cpfNorm].estagios.push(row.estagio);
    }

    // Step 2: Merge by grupo_empresarial
    const cpfToGrupo: Record<string, string> = {};
    const grupoInfo: Record<string, { nome: string; cpfs: string[] }> = {};
    for (const g of grupos) {
      cpfToGrupo[g.cpf_cnpj] = g.grupo_id;
      if (!grupoInfo[g.grupo_id]) grupoInfo[g.grupo_id] = { nome: g.nome_grupo, cpfs: [] };
      if (!grupoInfo[g.grupo_id].cpfs.includes(g.cpf_cnpj)) grupoInfo[g.grupo_id].cpfs.push(g.cpf_cnpj);
    }

    const result: ClienteAgrupado[] = [];
    const processedGrupos = new Set<string>();
    const processedCpfs = new Set<string>();

    for (const cpfNorm of Object.keys(map)) {
      const grupoId = cpfToGrupo[cpfNorm];
      if (grupoId) {
        if (processedGrupos.has(grupoId)) continue;
        processedGrupos.add(grupoId);

        const info = grupoInfo[grupoId];
        let totalContratos = 0;
        let totalValor = 0;
        const allEstagios: string[] = [];
        const allCredores: string[] = [];
        let firstId = '';

        for (const memberCpf of info.cpfs) {
          if (map[memberCpf]) {
            if (!firstId) firstId = map[memberCpf].id;
            totalContratos += map[memberCpf].qtdContratos;
            totalValor += map[memberCpf].valorTotal;
            for (const e of map[memberCpf].estagios) {
              if (!allEstagios.includes(e)) allEstagios.push(e);
            }
            const memberCredor = map[memberCpf].credor;
            if (memberCredor && !allCredores.includes(memberCredor)) {
              allCredores.push(memberCredor);
            }
            processedCpfs.add(memberCpf);
          }
        }

        if (totalContratos > 0) {
          result.push({
            id: firstId,
            nome: info.nome,
            cpf: info.cpfs.join(', '),
            credor: allCredores.length > 0 ? allCredores.join(', ') : null,
            qtdContratos: totalContratos,
            valorTotal: totalValor,
            estagios: allEstagios,
            isGrupo: true,
            grupoId,
            cpfsGrupo: info.cpfs,
          });
        }
      }
    }

    // Add non-grouped entries
    for (const [cpfNorm, entry] of Object.entries(map)) {
      if (!processedCpfs.has(cpfNorm) && !cpfToGrupo[cpfNorm]) {
        result.push(entry);
      }
    }

    return result;
  }, [rawResults, grupos]);

  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);
  const paginatedResults = grouped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSearch = async () => {
    if (!busca.trim() && !telefone.trim() && credor === 'todos' && estagio === 'todos') {
      toast.error('Preencha ao menos um filtro para pesquisar.');
      return;
    }
    setLoading(true);
    setPage(0);
    setSelectionMode(false);
    setSelectedCpfs(new Set());

    let query = supabase
      .from('devedores')
      .select('id, nome, cpf, credor, contrato, valor_original, valor_atualizado, estagio')
      .eq('ativo', true)
      .order('criado_em', { ascending: false });

    if (busca.trim()) {
      const termLimpo = busca.trim().replace(/\D/g, '');
      if (termLimpo.length > 0) {
        query = query.or(`nome.ilike.%${busca.trim()}%,cpf.ilike.%${termLimpo}%`);
      } else {
        query = query.ilike('nome', `%${busca.trim()}%`);
      }
    }
    if (telefone.trim()) query = query.ilike('telefone', `%${telefone.trim().replace(/\D/g, '')}%`);
    if (credor !== 'todos') query = query.eq('credor', credor);
    if (estagio !== 'todos') query = query.eq('estagio', estagio);

    const { data, error } = await query;

    if (!error && data) {
      setRawResults(data as ClienteRow[]);
    }

    // Refresh groups
    const { data: grpData } = await supabase.from('grupo_empresarial_membros' as any).select('*');
    if (grpData) setGrupos(grpData as unknown as GrupoMembro[]);

    setSearched(true);
    setLoading(false);
  };

  const handleClear = () => {
    setBusca('');
    setTelefone('');
    setCredor('todos');
    setEstagio('todos');
    setRawResults([]);
    setPage(0);
    setSearched(false);
    setSelectionMode(false);
    setSelectedCpfs(new Set());
  };

  const toggleCpfSelection = (cpfNorm: string) => {
    setSelectedCpfs(prev => {
      const next = new Set(prev);
      if (next.has(cpfNorm)) next.delete(cpfNorm);
      else next.add(cpfNorm);
      return next;
    });
  };

  const handleConfirmGroup = async () => {
    if (!nomeGrupo.trim()) { toast.error('Informe o nome do grupo.'); return; }
    if (!user) return;
    setSavingGroup(true);

    const grupoId = crypto.randomUUID();
    const inserts = Array.from(selectedCpfs).map(cpfNorm => ({
      grupo_id: grupoId,
      nome_grupo: nomeGrupo.trim(),
      cpf_cnpj: cpfNorm,
      criado_por: user.id,
    }));

    const { error } = await supabase.from('grupo_empresarial_membros' as any).insert(inserts as any);
    if (error) { toast.error('Erro ao criar grupo: ' + error.message); }
    else {
      toast.success('Grupo empresarial criado!');
      setGroupDialogOpen(false);
      setNomeGrupo('');
      setSelectionMode(false);
      setSelectedCpfs(new Set());
      // Refresh groups
      const { data: grpData } = await supabase.from('grupo_empresarial_membros' as any).select('*');
      if (grpData) setGrupos(grpData as unknown as GrupoMembro[]);
    }
    setSavingGroup(false);
  };

  const handleUngroup = async (grupoId: string) => {
    const { error } = await supabase.from('grupo_empresarial_membros' as any).delete().eq('grupo_id', grupoId);
    if (error) { toast.error('Erro ao desagrupar: ' + error.message); }
    else {
      toast.success('Grupo desfeito!');
      const { data: grpData } = await supabase.from('grupo_empresarial_membros' as any).select('*');
      if (grpData) setGrupos(grpData as unknown as GrupoMembro[]);
    }
  };

  const estagioVariant = (e: string) => {
    switch (e) {
      case 'novo': return 'default';
      case 'andamento': return 'secondary';
      case 'finalizado': return 'outline';
      default: return 'default';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Clientes
        </h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pesquisar Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome ou CPF/CNPJ</label>
                <Input placeholder="Nome ou CPF/CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Telefone</label>
                <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Credor</label>
                <Select value={credor} onValueChange={setCredor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {CREDORES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Estágio</label>
                <Select value={estagio} onValueChange={setEstagio}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTAGIOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 lg:col-span-3">
                <Button onClick={() => handleSearch()} disabled={loading}>
                  <Search className="h-4 w-4 mr-1" />
                  {loading ? 'Pesquisando...' : 'Pesquisar'}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {searched && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{grouped.length} cliente{grouped.length !== 1 ? 's' : ''} encontrado{grouped.length !== 1 ? 's' : ''}</CardTitle>
                {isAdmin && grouped.length >= 2 && (
                  <div className="flex gap-2">
                    {selectionMode ? (
                      <>
                        <Button
                          size="sm"
                          disabled={selectedCpfs.size < 2}
                          onClick={() => setGroupDialogOpen(true)}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Confirmar Agrupamento ({selectedCpfs.size})
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectionMode(false); setSelectedCpfs(new Set()); }}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                        <Link2 className="h-4 w-4 mr-1" />
                        Agrupar CNPJs
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectionMode && <TableHead className="w-10"></TableHead>}
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Credor</TableHead>
                      <TableHead>Contratos</TableHead>
                      <TableHead>Valor Total (R$)</TableHead>
                      <TableHead>Estágio</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={selectionMode ? 8 : 7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <SearchX className="h-10 w-10" />
                            <p className="text-lg font-semibold">Cliente não encontrado</p>
                            <p className="text-sm">Tente ajustar os filtros da pesquisa.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedResults.map((row) => {
                        const cpfNorm = row.cpf.replace(/\D/g, '');
                        return (
                          <TableRow key={row.isGrupo ? row.grupoId : row.cpf}>
                            {selectionMode && (
                              <TableCell>
                                {!row.isGrupo && (
                                  <Checkbox
                                    checked={selectedCpfs.has(cpfNorm)}
                                    onCheckedChange={() => toggleCpfSelection(cpfNorm)}
                                  />
                                )}
                              </TableCell>
                            )}
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {row.nome}
                                {row.isGrupo && <Badge variant="secondary">Grupo</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px]">
                              {row.isGrupo ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.cpfsGrupo?.map(c => (
                                    <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                                  ))}
                                </div>
                              ) : row.cpf}
                            </TableCell>
                            <TableCell>{row.credor || '-'}</TableCell>
                            <TableCell>{row.qtdContratos} contrato{row.qtdContratos !== 1 ? 's' : ''}</TableCell>
                            <TableCell>{row.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {row.estagios.map((e) => (
                                  <Badge key={e} variant={estagioVariant(e)}>
                                    {ESTAGIOS.find(es => es.value === e)?.label || e}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => navigate(`/clientes/${row.id}`)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Ficha
                                </Button>
                                {isAdmin && row.isGrupo && row.grupoId && (
                                  <Button variant="outline" size="sm" onClick={() => handleUngroup(row.grupoId!)}>
                                    <Unlink className="h-4 w-4 mr-1" />
                                    Desagrupar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dialog para nome do grupo */}
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Grupo Empresarial</DialogTitle>
              <DialogDescription>
                Agrupe {selectedCpfs.size} CNPJs em um único grupo empresarial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome do Grupo</Label>
                <Input
                  placeholder="Ex: POLLYANE DANTAS ALVES"
                  value={nomeGrupo}
                  onChange={(e) => setNomeGrupo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">CPFs/CNPJs selecionados:</Label>
                <div className="flex flex-wrap gap-1">
                  {Array.from(selectedCpfs).map(c => (
                    <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmGroup} disabled={savingGroup}>
                {savingGroup ? 'Salvando...' : 'Criar Grupo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
