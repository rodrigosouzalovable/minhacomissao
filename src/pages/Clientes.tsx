import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, Users, SearchX, Merge, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

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

const CREDORES = ['MUNDO DA MODA', 'UME | NOVO MUNDO', 'MONTREAL'];
const ESTAGIOS = [
  { value: 'novo', label: 'Novo' },
  { value: 'andamento', label: 'Andamento' },
  { value: 'finalizado', label: 'Finalizado' },
];

const PAGE_SIZE = 20;

function normalizeCpf(cpf: string) {
  return (cpf || '').replace(/\D/g, '');
}

interface MergePreview {
  type: 'cpf' | 'selected';
  groups: { keep: ClienteRow; others: ClienteRow[]; totalOriginal: number; totalAtualizado: number; contratos: string }[];
}

export default function Clientes() {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [credor, setCredor] = useState('todos');
  const [estagio, setEstagio] = useState('todos');
  const [results, setResults] = useState<ClienteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [merging, setMerging] = useState(false);

  const handleSearch = async (pageNum = 0) => {
    if (!nome.trim() && !cpf.trim() && !telefone.trim() && credor === 'todos' && estagio === 'todos') {
      toast.error('Preencha ao menos um filtro para pesquisar.');
      return;
    }
    setLoading(true);
    setPage(pageNum);
    setSelectedIds(new Set());

    let query = supabase
      .from('devedores')
      .select('id, nome, cpf, credor, contrato, valor_original, valor_atualizado, estagio', { count: 'exact' })
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (nome.trim()) query = query.ilike('nome', `%${nome.trim()}%`);
    if (cpf.trim()) query = query.ilike('cpf', `%${cpf.trim().replace(/\D/g, '')}%`);
    if (telefone.trim()) query = query.ilike('telefone', `%${telefone.trim().replace(/\D/g, '')}%`);
    if (credor !== 'todos') query = query.eq('credor', credor);
    if (estagio !== 'todos') query = query.eq('estagio', estagio);

    const { data, count, error } = await query;

    if (!error && data) {
      setResults(data as ClienteRow[]);
      setTotal(count ?? 0);
    }
    setSearched(true);
    setLoading(false);
  };

  const handleClear = () => {
    setNome('');
    setCpf('');
    setTelefone('');
    setCredor('todos');
    setEstagio('todos');
    setResults([]);
    setTotal(0);
    setPage(0);
    setSearched(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const buildMergeGroups = (records: ClienteRow[]) => {
    const keep = records[0];
    const others = records.slice(1);
    const totalOriginal = records.reduce((s, r) => s + r.valor_original, 0);
    const totalAtualizado = records.reduce((s, r) => s + r.valor_atualizado, 0);
    const contratos = records.map(r => r.contrato).filter(Boolean).join(', ');
    return { keep, others, totalOriginal, totalAtualizado, contratos };
  };

  const handleMergeByCpf = () => {
    const cpfMap = new Map<string, ClienteRow[]>();
    for (const r of results) {
      const key = normalizeCpf(r.cpf);
      if (!key) continue;
      if (!cpfMap.has(key)) cpfMap.set(key, []);
      cpfMap.get(key)!.push(r);
    }
    const groups = Array.from(cpfMap.values())
      .filter(g => g.length >= 2)
      .map(g => buildMergeGroups(g));

    if (groups.length === 0) {
      toast.info('Nenhum CPF/CNPJ duplicado encontrado nos resultados atuais.');
      return;
    }
    setMergePreview({ type: 'cpf', groups });
  };

  const handleMergeSelected = () => {
    const records = results.filter(r => selectedIds.has(r.id));
    if (records.length < 2) return;
    setMergePreview({ type: 'selected', groups: [buildMergeGroups(records)] });
  };

  const executeMerge = async () => {
    if (!mergePreview) return;
    setMerging(true);

    try {
      for (const group of mergePreview.groups) {
        const { error: updateError } = await supabase
          .from('devedores')
          .update({
            valor_original: group.totalOriginal,
            valor_atualizado: group.totalAtualizado,
            contrato: group.contratos || null,
          })
          .eq('id', group.keep.id);

        if (updateError) throw updateError;

        const otherIds = group.others.map(r => r.id);
        if (otherIds.length > 0) {
          const { error: deactivateError } = await supabase
            .from('devedores')
            .update({ ativo: false })
            .in('id', otherIds);

          if (deactivateError) throw deactivateError;
        }
      }

      const totalMerged = mergePreview.groups.reduce((s, g) => s + g.others.length, 0);
      toast.success(`${totalMerged} contrato(s) juntado(s) com sucesso!`);
      setMergePreview(null);
      setSelectedIds(new Set());
      handleSearch(page);
    } catch (err: any) {
      toast.error('Erro ao juntar contratos: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setMerging(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
                <label className="text-sm font-medium mb-1 block">Nome</label>
                <Input placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">CPF/CNPJ</label>
                <Input placeholder="CPF ou CNPJ" value={cpf} onChange={(e) => setCpf(e.target.value)} />
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
                    {CREDORES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
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
                    {ESTAGIOS.map((e) => (<SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 lg:col-span-3">
                <Button onClick={() => handleSearch(0)} disabled={loading}>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle>{total} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</CardTitle>
                {results.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleMergeByCpf}>
                      <Merge className="h-4 w-4 mr-1" />
                      Juntar CPFs Iguais
                    </Button>
                    {selectedIds.size >= 2 && (
                      <Button variant="secondary" size="sm" onClick={handleMergeSelected}>
                        <CheckSquare className="h-4 w-4 mr-1" />
                        Juntar Selecionados ({selectedIds.size})
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
                      <TableHead className="w-10">
                        <Checkbox
                          checked={results.length > 0 && selectedIds.size === results.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Credor</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Valor (R$)</TableHead>
                      <TableHead>Estágio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <SearchX className="h-10 w-10" />
                            <p className="text-lg font-semibold">Cliente não encontrado</p>
                            <p className="text-sm">Tente ajustar os filtros da pesquisa.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.map((row) => (
                        <TableRow key={row.id} className={selectedIds.has(row.id) ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleSelect(row.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{row.nome}</TableCell>
                          <TableCell className="font-mono text-xs">{row.cpf}</TableCell>
                          <TableCell>{row.credor || '-'}</TableCell>
                          <TableCell>{row.contrato || '-'}</TableCell>
                          <TableCell>{row.valor_atualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell>
                            <Badge variant={estagioVariant(row.estagio)}>
                              {ESTAGIOS.find(e => e.value === row.estagio)?.label || row.estagio}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => handleSearch(page - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => handleSearch(page + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de confirmação de merge */}
      <AlertDialog open={!!mergePreview} onOpenChange={(open) => { if (!open) setMergePreview(null); }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar junção de contratos</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {mergePreview?.type === 'cpf' && (
                  <p>{mergePreview.groups.length} grupo(s) de CPF duplicado encontrado(s).</p>
                )}
                {mergePreview?.groups.map((g, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1 text-sm">
                    <p className="font-medium">Manter: {g.keep.nome} ({g.keep.cpf})</p>
                    <p>Contratos a desativar: {g.others.length}</p>
                    <p>Valor original total: {g.totalOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p>Valor atualizado total: {g.totalAtualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    {g.contratos && <p>Contratos: {g.contratos}</p>}
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeMerge} disabled={merging}>
              {merging ? 'Juntando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
