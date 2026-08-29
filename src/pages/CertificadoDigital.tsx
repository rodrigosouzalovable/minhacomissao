import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Activity, Download, FileKey2, Loader2, MapPin, Phone, Play, RefreshCw, Search, Settings2, Users } from "lucide-react";
import { exportarParaExcel } from "@/lib/exportExcel";

const UFS = ["GO", "SP", "RS", "RJ", "SC", "DF"];
const CNAES_PADRAO = ["6911701", "7020400", "8630504", "7490104", "4712100", "6319400", "7319002", "8630503", "8112500", "4120400", "6201501", "9602501", "4772500", "4751201", "4781400", "4530703", "6204000"];

type Lead = {
  id: string; cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  telefones: string[]; telefone_principal: string | null; email: string | null;
  cnae: string | null; cnae_descricao: string | null; uf: string | null; municipio: string | null;
  porte: string | null; mei: boolean | null; data_abertura: string | null; dias_desde_abertura: number | null;
  situacao: string; created_at: string;
};

type Config = { id: string; motor_ativo: boolean; ufs: string[]; cnaes: string[]; janelas_dias: number[]; somente_mei: boolean; somente_celular: boolean; ultima_execucao: string | null; ultimo_status: string | null; total_coletado: number };

type Log = { id: string; janela: number | null; data_referencia: string | null; encontrados: number; novos: number; duplicados: number; sem_telefone: number; erro: string | null; manual: boolean; created_at: string };

function telefoneExibicao(tel: string | null) {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  return d.length === 13 ? `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}` : tel;
}

function cnpjExibicao(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

function dataExibicao(data: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${data.slice(0, 10)}T12:00:00Z`));
}

export default function CertificadoDigital() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [ufFiltro, setUfFiltro] = useState("todas");
  const [janelaFiltro, setJanelaFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [janelaManual, setJanelaManual] = useState("0");
  const [novoCnae, setNovoCnae] = useState("");
  const [novaUf, setNovaUf] = useState("GO");
  const [pagina, setPagina] = useState(0);
  const porPagina = 25;

  const { data: config } = useQuery({
    queryKey: ["certificado-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificado_config" as any).select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as Config | null;
    },
    staleTime: 60_000,
  });

  const { data: leads = [], isLoading: carregandoLeads } = useQuery({
    queryKey: ["certificado-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificado_leads" as any).select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
    staleTime: 60_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["certificado-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificado_coleta_log" as any).select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Log[];
    },
    staleTime: 60_000,
  });

  const salvarConfig = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      if (!config?.id) throw new Error("Configuração não encontrada");
      const { error } = await supabase.from("certificado_config" as any).update(patch).eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certificado-config"] }); toast.success("Configuração salva"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  const buscarManual = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("certificado-casa-dados-buscar", { body: { janela: Number(janelaManual) } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => { toast.success(`${data?.resultado?.novos ?? 0} novo(s) lead(s) encontrado(s)`); qc.invalidateQueries({ queryKey: ["certificado-leads"] }); qc.invalidateQueries({ queryKey: ["certificado-logs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na busca"),
  });

  const leadsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((lead) => {
      const bateBusca = !termo || [lead.cnpj, lead.razao_social, lead.nome_fantasia, lead.telefone_principal, lead.municipio].some((v) => String(v ?? "").toLowerCase().includes(termo));
      return bateBusca && (ufFiltro === "todas" || lead.uf === ufFiltro) && (janelaFiltro === "todas" || String(lead.dias_desde_abertura) === janelaFiltro) && (statusFiltro === "todos" || lead.situacao === statusFiltro);
    });
  }, [busca, leads, ufFiltro, janelaFiltro, statusFiltro]);

  const paginaLeads = leadsFiltrados.slice(pagina * porPagina, (pagina + 1) * porPagina);
  const totalPaginas = Math.max(1, Math.ceil(leadsFiltrados.length / porPagina));
  const porJanela = useMemo(() => Array.from({ length: 31 }, (_, dias) => {
    const grupo = leads.filter((lead) => lead.dias_desde_abertura === dias);
    return { dias, total: grupo.length, telefones: grupo.filter((l) => !!l.telefone_principal).length };
  }).filter((item) => item.total > 0 || (config?.janelas_dias ?? []).includes(item.dias)), [config?.janelas_dias, leads]);

  const ligarMotor = (ativo: boolean) => salvarConfig.mutate({ motor_ativo: ativo });
  const adicionarUf = () => { if (config && !config.ufs.includes(novaUf)) salvarConfig.mutate({ ufs: [...config.ufs, novaUf] }); };
  const removerUf = (uf: string) => config && salvarConfig.mutate({ ufs: config.ufs.filter((item) => item !== uf) });
  const adicionarCnae = () => { const cnae = novoCnae.replace(/\D/g, ""); if (config && cnae.length >= 7 && !config.cnaes.includes(cnae)) { salvarConfig.mutate({ cnaes: [...config.cnaes, cnae] }); setNovoCnae(""); } };
  const removerCnae = (cnae: string) => config && salvarConfig.mutate({ cnaes: config.cnaes.filter((item) => item !== cnae) });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><div className="flex items-center gap-2"><FileKey2 className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Certificado Digital</h1></div><p className="text-sm text-muted-foreground mt-1">Leads de empresas recém-abertas para prospecção.</p></div>
          <Button variant="outline" onClick={() => { qc.invalidateQueries({ queryKey: ["certificado-leads"] }); qc.invalidateQueries({ queryKey: ["certificado-config"] }); }}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>

        <Card className="border-primary/30">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4"><div className="rounded-full bg-primary/10 p-3"><Activity className="h-6 w-6 text-primary" /></div><div><p className="font-semibold">Motor de coleta diária</p><p className="text-sm text-muted-foreground">{config?.motor_ativo ? "Ativo — a próxima coleta automática seguirá as janelas configuradas." : "Desligado — nenhuma consulta automática será realizada."}</p></div></div>
            <div className="flex items-center gap-3"><Badge variant={config?.motor_ativo ? "default" : "outline"}>{config?.motor_ativo ? "ATIVO" : "DESLIGADO"}</Badge><Switch checked={config?.motor_ativo ?? false} onCheckedChange={ligarMotor} disabled={salvarConfig.isPending} aria-label="Ligar motor de coleta" /></div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Leads armazenados</p><p className="mt-1 text-2xl font-bold">{leads.length.toLocaleString("pt-BR")}</p><Users className="mt-3 h-5 w-5 text-primary" /></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Com telefone</p><p className="mt-1 text-2xl font-bold">{leads.filter((l) => !!l.telefone_principal).length.toLocaleString("pt-BR")}</p><Phone className="mt-3 h-5 w-5 text-secondary" /></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Última execução</p><p className="mt-1 text-base font-semibold">{config?.ultima_execucao ? new Date(config.ultima_execucao).toLocaleString("pt-BR") : "Ainda não executado"}</p><p className="mt-2 text-xs text-muted-foreground">{config?.ultimo_status ?? "Motor aguardando ativação"}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Janelas ativas</p><p className="mt-1 text-2xl font-bold">{config?.janelas_dias?.length ?? 0}</p><p className="mt-2 text-xs text-muted-foreground">D+0 até D+30</p></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />Configuração da coleta</CardTitle></CardHeader><CardContent className="space-y-5">
          <div><Label>Estados selecionados</Label><div className="mt-2 flex flex-wrap gap-2">{(config?.ufs ?? UFS).map((uf) => <Badge key={uf} variant="secondary" className="cursor-pointer" onClick={() => removerUf(uf)}>{uf} ×</Badge>)}<div className="flex gap-2"><Select value={novaUf} onValueChange={setNovaUf}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent>{UFS.filter((uf) => !(config?.ufs ?? []).includes(uf)).map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={adicionarUf}>Adicionar UF</Button></div></div></div>
          <div><Label>CNAEs monitorados</Label><div className="mt-2 flex flex-wrap gap-2">{(config?.cnaes ?? CNAES_PADRAO).map((cnae) => <Badge key={cnae} variant="outline" className="cursor-pointer" onClick={() => removerCnae(cnae)}>{cnae} ×</Badge>)}</div><div className="mt-3 flex max-w-sm gap-2"><Input value={novoCnae} onChange={(e) => setNovoCnae(e.target.value)} placeholder="Adicionar CNAE" inputMode="numeric" /><Button variant="outline" onClick={adicionarCnae}>Adicionar</Button></div></div>
          <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm"><Switch checked={config?.somente_celular ?? true} onCheckedChange={(checked) => salvarConfig.mutate({ somente_celular: checked })} />Somente celulares</label><label className="flex items-center gap-2 text-sm"><Switch checked={config?.somente_mei ?? false} onCheckedChange={(checked) => salvarConfig.mutate({ somente_mei: checked })} />Somente MEI</label></div>
          <div><Label>Janelas de abertura (dias atrás)</Label><div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: 31 }, (_, i) => i).map((dia) => <Button key={dia} size="sm" variant={(config?.janelas_dias ?? []).includes(dia) ? "default" : "outline"} onClick={() => { const atual = config?.janelas_dias ?? []; salvarConfig.mutate({ janelas_dias: atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort((a, b) => a - b) }); }}>D+{dia}</Button>)}</div></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Testar uma janela agora</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 md:flex-row md:items-end"><div className="w-full md:w-48"><Label>Data de abertura</Label><Select value={janelaManual} onValueChange={setJanelaManual}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 31 }, (_, i) => <SelectItem key={i} value={String(i)}>D+{i} — {dataExibicao(new Date(Date.now() - i * 86400000).toISOString())}</SelectItem>)}</SelectContent></Select></div><Button onClick={() => buscarManual.mutate()} disabled={buscarManual.isPending || !config?.motor_ativo}>{buscarManual.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Buscar agora</Button><p className="text-xs text-muted-foreground">Ligue o motor para habilitar a busca manual.</p></CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Comparativo por dia de abertura</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{porJanela.map((item) => <div key={item.dias} className="rounded-lg border p-3"><div className="flex justify-between text-sm"><span className="font-medium">D+{item.dias}</span><Badge variant="outline">{item.total}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{item.telefones} com telefone válido</p></div>)}</div></CardContent></Card>

        <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><CardTitle>Leads coletados</CardTitle><Button variant="outline" onClick={() => exportarParaExcel(leadsFiltrados, [{ chave: "cnpj", titulo: "CNPJ" }, { chave: "razao_social", titulo: "Razão social" }, { chave: "nome_fantasia", titulo: "Nome fantasia" }, { chave: "telefone_principal", titulo: "Telefone" }, { chave: "email", titulo: "E-mail" }, { chave: "cnae", titulo: "CNAE" }, { chave: "uf", titulo: "UF" }, { chave: "municipio", titulo: "Município" }, { chave: "data_abertura", titulo: "Abertura" }, { chave: "dias_desde_abertura", titulo: "Dias" }, { chave: "situacao", titulo: "Situação" }], "leads-certificado-digital")}><Download className="mr-2 h-4 w-4" />Exportar Excel</Button></div></CardHeader><CardContent>
          <div className="mb-4 grid gap-2 md:grid-cols-4"><div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar CNPJ, empresa, cidade ou telefone" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} /></div><Select value={ufFiltro} onValueChange={setUfFiltro}><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as UFs</SelectItem>{UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select><Select value={janelaFiltro} onValueChange={setJanelaFiltro}><SelectTrigger><SelectValue placeholder="Janela" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as janelas</SelectItem>{Array.from({ length: 31 }, (_, i) => <SelectItem key={i} value={String(i)}>D+{i}</SelectItem>)}</SelectContent></Select></div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Local</TableHead><TableHead>Abertura</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{carregandoLeads ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow> : paginaLeads.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow> : paginaLeads.map((lead) => <TableRow key={lead.id}><TableCell><div className="font-medium">{lead.nome_fantasia || lead.razao_social || "Sem nome"}</div><div className="text-xs text-muted-foreground">{lead.cnae || "CNAE não informado"}</div></TableCell><TableCell className="font-mono text-xs">{cnpjExibicao(lead.cnpj)}</TableCell><TableCell>{lead.telefone_principal ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-secondary" />{telefoneExibicao(lead.telefone_principal)}</span> : "—"}</TableCell><TableCell><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{[lead.municipio, lead.uf].filter(Boolean).join(" / ") || "—"}</span></TableCell><TableCell><div>D+{lead.dias_desde_abertura ?? "—"}</div><div className="text-xs text-muted-foreground">{dataExibicao(lead.data_abertura)}</div></TableCell><TableCell><Badge variant={lead.situacao === "novo" ? "default" : "outline"}>{lead.situacao}</Badge></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>{leadsFiltrados.length.toLocaleString("pt-BR")} lead(s)</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><span>Página {pagina + 1} de {totalPaginas}</span><Button size="sm" variant="outline" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button></div></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Histórico de coletas</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Janela</TableHead><TableHead>Encontrados</TableHead><TableHead>Novos</TableHead><TableHead>Duplicados</TableHead><TableHead>Resultado</TableHead></TableRow></TableHeader><TableBody>{logs.slice(0, 20).map((log) => <TableRow key={log.id}><TableCell>{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell><TableCell>D+{log.janela ?? "—"}</TableCell><TableCell>{log.encontrados}</TableCell><TableCell>{log.novos}</TableCell><TableCell>{log.duplicados}</TableCell><TableCell>{log.erro ? <Badge variant="destructive">Erro</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
      </div>
    </AppLayout>
  );
}
