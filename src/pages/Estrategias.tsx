import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { exportarParaExcel } from '@/lib/exportExcel';
import { Loader2, Upload, Download, Target, Phone, Wallet, RotateCcw, History, Trash2, Flame } from 'lucide-react';

type ResumoData = {
  importacao_id?: string;
  total?: number;
  disponiveis?: number;
  localizados?: number;
  uma_parcela_loc?: number;
  ticket_alto_loc?: number;
  quebrados_loc?: number;
  aporte_loc?: number;
  janela_quente_loc?: number;
};

const FAIXAS = ['<100', '100-199', '200-299', '300-399', '400-499', '500+'];

async function downloadFiltro(filtro: any, qtd: number, nome: string) {
  const { data, error } = await supabase.rpc('estrategia_reservar', { p_filtro: filtro, p_qtd: qtd });
  if (error) throw error;
  if (!data || data.length === 0) {
    toast.warning('Nenhum CPF disponível para esse filtro no momento.');
    return 0;
  }
  await exportarParaExcel(
    data as any[],
    [
      { chave: 'cpf', titulo: 'CPF' },
      { chave: 'nome', titulo: 'Nome' },
      { chave: 'telefone', titulo: 'Telefone' },
      { chave: 'proxima_parcela_num', titulo: 'Próx. Parcela' },
      { chave: 'proxima_parcela_vencimento', titulo: 'Vencimento' },
      { chave: 'proxima_parcela_valor', titulo: 'Valor Parcela' },
      { chave: 'faixa_valor_parcela', titulo: 'Faixa' },
      { chave: 'parcelas_abertas_qtd', titulo: 'Parcelas Abertas' },
      { chave: 'atraso_dias', titulo: 'Atraso (dias)' },
      { chave: 'credor', titulo: 'Credor' },
      { chave: 'tipo_credor', titulo: 'Tipo' },
      { chave: 'contrato', titulo: 'Contrato' },
      { chave: 'acordo_quebrado', titulo: 'Acordo Quebrado' },
      { chave: 'score', titulo: 'Score' },
    ],
    `estrategia_${nome}_${qtd}_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}`
  );
  toast.success(`${data.length} CPFs reservados por 48h e baixados.`);
  return data.length;
}

export default function Estrategias() {
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Filtros manuais
  const [faixasSel, setFaixasSel] = useState<string[]>([]);
  const [parcMin, setParcMin] = useState<string>('');
  const [parcMax, setParcMax] = useState<string>('');
  const [localizado, setLocalizado] = useState('sim');
  const [quebrado, setQuebrado] = useState('');
  const [tipo, setTipo] = useState('');
  const [atrasoMin, setAtrasoMin] = useState('');
  const [atrasoMax, setAtrasoMax] = useState('');
  const [qtd, setQtd] = useState(50);
  const [ordem, setOrdem] = useState('score');

  const { data: resumo, refetch: refetchResumo } = useQuery<ResumoData>({
    queryKey: ['estrategia-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estrategia_resumo');
      if (error) throw error;
      return (data as any) || {};
    },
  });

  const { data: importacao } = useQuery({
    queryKey: ['estrategia-importacao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('estrategia_importacao')
        .select('*')
        .eq('ativo', true)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: historico, refetch: refetchHist } = useQuery({
    queryKey: ['estrategia-historico', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('estrategia_reserva_log')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke('estrategia-importar', {
        body: { fileBase64, fileName: file.name },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Importação concluída: ${(data as any).total} CPFs.`);
      qc.invalidateQueries({ queryKey: ['estrategia-resumo'] });
      qc.invalidateQueries({ queryKey: ['estrategia-importacao'] });
    } catch (err: any) {
      console.error(err);
      toast.error('Falha na importação: ' + (err?.message ?? err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function baixarPreset(preset: any, q: number, nome: string) {
    try {
      await downloadFiltro(preset, q, nome);
      refetchResumo();
      refetchHist();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro');
    }
  }

  async function baixarManual() {
    const filtro: any = {
      faixas: faixasSel.length ? faixasSel : undefined,
      parcelas_min: parcMin || undefined,
      parcelas_max: parcMax || undefined,
      localizado: localizado || undefined,
      acordo_quebrado: quebrado || undefined,
      tipo_credor: tipo || undefined,
      atraso_min: atrasoMin || undefined,
      atraso_max: atrasoMax || undefined,
      ordem,
    };
    try {
      await downloadFiltro(filtro, qtd, 'manual');
      refetchResumo();
      refetchHist();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro');
    }
  }

  async function liberarTudo() {
    if (!confirm('Liberar TODAS as reservas? Os CPFs voltam ao pool.')) return;
    const { data, error } = await supabase.rpc('estrategia_liberar_reservas');
    if (error) return toast.error(error.message);
    toast.success(`${data} reservas liberadas.`);
    refetchResumo();
    refetchHist();
  }

  async function liberarMinhas() {
    if (!user?.id) return;
    const { data, error } = await supabase.rpc('estrategia_liberar_reservas', { p_user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(`${data} reservas suas liberadas.`);
    refetchResumo();
    refetchHist();
  }

  const presets = [
    { nome: 'top_score', label: 'Top Score', icon: Target, count: resumo?.disponiveis, desc: 'Maior pontuação geral', filtro: { ordem: 'score' } },
    { nome: 'localizado_1parc', label: 'Localizados + 1 parcela', icon: Phone, count: resumo?.uma_parcela_loc, desc: 'Mais fáceis de fechar', filtro: { localizado: 'sim', parcelas_min: '1', parcelas_max: '1' } },
    { nome: 'ticket_alto', label: 'Ticket alto (R$ 500+)', icon: Wallet, count: resumo?.ticket_alto_loc, desc: 'Localizados, parcela ≥ R$ 500', filtro: { localizado: 'sim', faixas: ['500+'] } },
    { nome: 'quebrados', label: 'Acordos quebrados', icon: RotateCcw, count: resumo?.quebrados_loc, desc: 'Já negociaram, renegociam', filtro: { localizado: 'sim', acordo_quebrado: 'sim' } },
    { nome: 'aporte', label: 'Aporte localizado', icon: Flame, count: resumo?.aporte_loc, desc: 'Credor APORTE com telefone', filtro: { localizado: 'sim', tipo_credor: 'APORTE' } },
    { nome: 'janela_quente', label: 'Janela quente 60-180d', icon: Target, count: resumo?.janela_quente_loc, desc: 'Atraso ideal de negociação', filtro: { localizado: 'sim', atraso_min: '60', atraso_max: '180' } },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto p-4 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estratégias</h1>
          <p className="text-muted-foreground">Liste e baixe os melhores CPFs para acionar via WhatsApp.</p>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Importar planilha</CardTitle>
              <CardDescription>
                {importacao
                  ? `Última: ${importacao.nome_arquivo} — ${importacao.total_cpfs} CPFs (${new Date(importacao.criado_em).toLocaleString('pt-BR')})`
                  : 'Nenhuma importação ainda. Envie o arquivo CLIENTES SOUZA E RIBEIRO.xlsx'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 items-center flex-wrap">
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : <><Upload className="h-4 w-4 mr-2" />Enviar planilha</>}
              </Button>
              <Button variant="outline" onClick={liberarTudo}><Trash2 className="h-4 w-4 mr-2" />Resetar todas as reservas</Button>
            </CardContent>
          </Card>
        )}

        {/* Resumo */}
        {resumo?.importacao_id && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total CPFs</div><div className="text-2xl font-bold">{resumo.total}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Disponíveis</div><div className="text-2xl font-bold text-primary">{resumo.disponiveis}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Localizados</div><div className="text-2xl font-bold">{resumo.localizados}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Reservados</div><div className="text-2xl font-bold">{(resumo.total ?? 0) - (resumo.disponiveis ?? 0)}</div></CardContent></Card>
          </div>
        )}

        {/* Presets */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Listas prontas</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((p) => {
              const Icon = p.icon;
              return (
                <Card key={p.nome}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4" />{p.label}</CardTitle>
                    <CardDescription>{p.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="secondary">{p.count ?? 0} disponíveis</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => baixarPreset(p.filtro, 50, p.nome)} disabled={!p.count}>50</Button>
                      <Button size="sm" onClick={() => baixarPreset(p.filtro, 100, p.nome)} disabled={!p.count}><Download className="h-4 w-4 mr-1" />100</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Filtros manuais */}
        <Card>
          <CardHeader><CardTitle>Filtros personalizados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Faixa de valor de parcela</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {FAIXAS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={faixasSel.includes(f)} onCheckedChange={(c) => setFaixasSel((prev) => c ? [...prev, f] : prev.filter((x) => x !== f))} />
                    {f === '<100' ? '< R$ 100' : f === '500+' ? 'R$ 500+' : `R$ ${f}`}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Parcelas abertas (mín)</Label><Input type="number" value={parcMin} onChange={(e) => setParcMin(e.target.value)} placeholder="ex: 1" /></div>
              <div><Label>Parcelas abertas (máx)</Label><Input type="number" value={parcMax} onChange={(e) => setParcMax(e.target.value)} placeholder="ex: 3" /></div>
              <div>
                <Label>Localizado</Label>
                <Select value={localizado} onValueChange={setLocalizado}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Apenas localizados</SelectItem>
                    <SelectItem value="nao">Apenas não localizados</SelectItem>
                    <SelectItem value=" ">Qualquer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Acordo quebrado</Label>
                <Select value={quebrado} onValueChange={setQuebrado}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Qualquer</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de credor</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Qualquer</SelectItem>
                    <SelectItem value="APORTE">Aporte</SelectItem>
                    <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordenar por</Label>
                <Select value={ordem} onValueChange={setOrdem}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score</SelectItem>
                    <SelectItem value="valor">Maior valor</SelectItem>
                    <SelectItem value="atraso">Menor atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Atraso mín (dias)</Label><Input type="number" value={atrasoMin} onChange={(e) => setAtrasoMin(e.target.value)} /></div>
              <div><Label>Atraso máx (dias)</Label><Input type="number" value={atrasoMax} onChange={(e) => setAtrasoMax(e.target.value)} /></div>
              <div>
                <Label>Quantidade</Label>
                <Select value={String(qtd)} onValueChange={(v) => setQtd(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={baixarManual}><Download className="h-4 w-4 mr-2" />Baixar planilha</Button>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Histórico de reservas</CardTitle>
            <CardDescription>Suas últimas 20 reservas. Reservas duram 48h.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={liberarMinhas} className="mb-3">Liberar minhas reservas</Button>
            <div className="space-y-1 text-sm">
              {(historico ?? []).map((h: any) => (
                <div key={h.id} className="flex justify-between border-b py-1">
                  <span>{new Date(h.criado_em).toLocaleString('pt-BR')}</span>
                  <span className="font-medium">{h.qtd} CPFs</span>
                </div>
              ))}
              {(!historico || historico.length === 0) && <div className="text-muted-foreground">Sem reservas ainda.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
