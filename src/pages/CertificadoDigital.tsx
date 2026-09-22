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
import { Activity, Download, FileKey2, KeyRound, Loader2, MapPin, Phone, Play, RefreshCw, Search, Settings2, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { exportarParaExcel } from "@/lib/exportExcel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CertificadoTemplatesCard, type CertificadoTemplate } from "@/components/certificado/CertificadoTemplatesCard";

const UFS = ["GO", "SP", "RS", "RJ", "SC", "DF"];
const CNAES_PADRAO = ["6911701", "7020400", "8630504", "7490104", "4712100", "6319400", "7319002", "8630503", "8112500", "4120400", "6201501", "9602501", "4772500", "4751201", "4781400", "4530703", "6204000"];

type Lead = {
  id: string; cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  telefones: string[]; telefone_principal: string | null; email: string | null;
  cnae: string | null; cnae_descricao: string | null; uf: string | null; municipio: string | null;
  porte: string | null; mei: boolean | null; data_abertura: string | null; dias_desde_abertura: number | null;
  situacao: string; whatsapp_status: string; created_at: string;
};

type Config = { id: string; motor_ativo: boolean; ufs: string[]; cnaes: string[]; janelas_dias: number[]; somente_mei: boolean; somente_celular: boolean; ultima_execucao: string | null; ultimo_status: string | null; total_coletado: number; prospeccao_ativa: boolean; meta_bm_id: string | null; template_nome: string | null; template_idioma: string; limite_diario: number; prospeccao_pausada_motivo: string | null };

type Log = { id: string; janela: number | null; data_referencia: string | null; encontrados: number; novos: number; duplicados: number; sem_telefone: number; erro: string | null; manual: boolean; created_at: string };
type ChaveStatus = { configurada: boolean; origem: "painel" | "ambiente" | null; sufixo: string | null; updated_at: string | null };

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
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [chaveCasaDados, setChaveCasaDados] = useState("");
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

  const { data: chaveStatus, isLoading: carregandoChave } = useQuery({
    queryKey: ["certificado-casa-dados-chave"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("certificado-casa-dados-chave", { body: { action: "status" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ChaveStatus;
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

  const { data: templates = [] } = useQuery({ queryKey: ["certificado-templates-mestre"], queryFn: async () => {
    const [mestres, configuracoes] = await Promise.all([
      supabase.from("meta_templates_mestre").select("id,nome,idioma,categoria,corpo").order("nome"),
      supabase.from("certificado_prospeccao_templates").select("template_mestre_id,ativo"),
    ]);
    if (mestres.error) throw mestres.error;
    if (configuracoes.error) throw configuracoes.error;
    const estados = new Map((configuracoes.data ?? []).map((item) => [item.template_mestre_id, item.ativo]));
    return (mestres.data ?? []).map((item) => ({ ...item, ativoCertificado: estados.get(item.id) ?? true })) as CertificadoTemplate[];
  }, staleTime: 60_000 });
  const templateSelecionado = templates.find((item) => item.nome === config?.template_nome && item.idioma === config?.template_idioma);
  const templatesHabilitados = templates.filter((item) => item.ativoCertificado);
  const { data: bmsCompativeis = [], isFetching: verificandoBms } = useQuery({
    queryKey: ["certificado-bms-compativeis", templateSelecionado?.nome, templateSelecionado?.idioma],
    enabled: !!templateSelecionado?.ativoCertificado,
    queryFn: async () => {
      if (!templateSelecionado) return [];
      const { data: aprovacoes, error: aprovacoesError } = await supabase.from("meta_whatsapp_templates")
        .select("instancia_id,sincronizado_em")
        .eq("nome_template", templateSelecionado.nome)
        .eq("idioma", templateSelecionado.idioma)
        .eq("status", "approved");
      if (aprovacoesError) throw aprovacoesError;
      const ids = [...new Set((aprovacoes ?? []).map((item) => item.instancia_id))];
      if (ids.length === 0) return [];
      const [{ data: instancias, error: instanciasError }, { data: bms, error: bmsError }] = await Promise.all([
        supabase.from("meta_whatsapp_instances").select("id,meta_bm_id").in("id", ids).eq("provider", "meta").eq("ativo", true).not("meta_bm_id", "is", null),
        supabase.from("meta_business_managers").select("id,nome,business_id").eq("ativo", true).order("nome"),
      ]);
      if (instanciasError) throw instanciasError;
      if (bmsError) throw bmsError;
      const aprovacaoPorInstancia = new Map((aprovacoes ?? []).map((item) => [item.instancia_id, item.sincronizado_em]));
      const resumo = new Map<string, { quantidade: number; ultimaSincronizacao: string | null }>();
      for (const instancia of instancias ?? []) {
        if (!instancia.meta_bm_id) continue;
        const atual = resumo.get(instancia.meta_bm_id) ?? { quantidade: 0, ultimaSincronizacao: null };
        const sincronizadoEm = aprovacaoPorInstancia.get(instancia.id) ?? null;
        resumo.set(instancia.meta_bm_id, {
          quantidade: atual.quantidade + 1,
          ultimaSincronizacao: !atual.ultimaSincronizacao || (sincronizadoEm && sincronizadoEm > atual.ultimaSincronizacao) ? sincronizadoEm : atual.ultimaSincronizacao,
        });
      }
      return (bms ?? []).filter((bm) => resumo.has(bm.id)).map((bm) => ({ ...bm, ...resumo.get(bm.id) }));
    },
    staleTime: 30_000,
  });
  const { data: metaInstancias = [] } = useQuery({ queryKey: ["certificado-meta-instancias", config?.meta_bm_id], enabled: !!config?.meta_bm_id, queryFn: async () => {
    const { data, error } = await supabase.from("meta_whatsapp_instances").select("id,nome,display_phone,estado_pool,pool_fora_manual,saude_status,saude_quality,ativo").eq("meta_bm_id", config?.meta_bm_id ?? "").eq("provider", "meta").eq("ativo", true).order("nome");
    if (error) throw error; return data ?? [];
  }, staleTime: 30_000 });
  const { data: templateStatus = [] } = useQuery({ queryKey: ["certificado-template-status", config?.meta_bm_id, config?.template_nome, config?.template_idioma, metaInstancias.map((i) => i.id).join(",")], enabled: !!config?.template_nome && metaInstancias.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("meta_whatsapp_templates").select("instancia_id,status,sincronizado_em").in("instancia_id", metaInstancias.map((i) => i.id)).eq("nome_template", config?.template_nome ?? "").eq("idioma", config?.template_idioma ?? "pt_BR");
    if (error) throw error; return data ?? [];
  }, staleTime: 30_000 });
  const { data: enviosHoje = 0 } = useQuery({ queryKey: ["certificado-envios-hoje", config?.meta_bm_id], enabled: !!config?.meta_bm_id, queryFn: async () => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const { count, error } = await supabase.from("certificado_prospeccao_envios").select("id", { count: "exact", head: true }).eq("bm_id", config?.meta_bm_id ?? "").gte("reservado_em", hoje.toISOString()).in("status", ["reservado","enviado","entregue","lido","respondido"]);
    if (error) throw error; return count ?? 0;
  }, staleTime: 30_000 });

  const salvarConfig = useMutation({
    mutationFn: async (patch: Partial<Config>) => {
      if (!config?.id) throw new Error("Configuração não encontrada");
      const { error } = await supabase.from("certificado_config" as any).update(patch).eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certificado-config"] }); toast.success("Configuração salva"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  const gerenciarChave = useMutation({
    mutationFn: async ({ action, chave }: { action: "salvar" | "remover"; chave?: string }) => {
      const { data, error } = await supabase.functions.invoke("certificado-casa-dados-chave", { body: { action, chave } });
      if (error) {
        const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
        const payload = context?.json ? await context.json().catch(() => null) : null;
        throw new Error(payload?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      setChaveCasaDados("");
      qc.invalidateQueries({ queryKey: ["certificado-casa-dados-chave"] });
      toast.success(variables.action === "salvar" ? "Chave validada e salva com segurança" : data?.fallback ? "Chave removida; a configuração anterior continuará sendo usada" : "Chave removida");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível configurar a chave"),
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

  const verificarWhatsApp = useMutation({ mutationFn: async () => {
    const { data, error } = await supabase.functions.invoke("certificado-verificar-whatsapp", { body: { limite: 2000 } });
    if (error) throw error; if (data?.error) throw new Error(data.error); return data;
  }, onSuccess: (data) => { toast.success(`${data.com_whatsapp} com WhatsApp; ${data.sem_whatsapp} sem WhatsApp`); qc.invalidateQueries({ queryKey: ["certificado-leads"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na verificação") });
  const processar = useMutation({ mutationFn: async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("certificado-prospeccao-processar", { body });
    if (error) {
      const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const payload = context?.json ? await context.json().catch(() => null) : null;
      throw new Error(payload?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error); return data;
  }, onSuccess: (data) => {
    const coleta = data.coleta as { novos?: number; janelas_falha?: number; janelas_pendentes?: number } | undefined;
    const verificacao = data.verificacao as { com_whatsapp?: number } | undefined;
    const detalhes = coleta
      ? `${coleta.novos ?? 0} lead(s) novo(s), ${verificacao?.com_whatsapp ?? 0} WhatsApp(s) confirmado(s)${(coleta.janelas_pendentes ?? 0) > 0 ? `, ${coleta.janelas_pendentes} janela(s) ficam para o próximo ciclo` : ""}`
      : null;
    const mensagem = data.simulacao
      ? `${data.elegiveis} contato(s) apto(s) nesta simulação`
      : data.resultado
        ? "Mensagem de teste processada"
        : data.job_id
          ? `Campanha iniciada com ${data.total ?? 0} contato(s)${detalhes ? ` — ${detalhes}` : ""}`
          : `${data.motivo ?? "Processamento concluído"}${detalhes ? ` — ${detalhes}` : ""}`;
    if (data.parcial || (coleta?.janelas_falha ?? 0) > 0) toast.warning(mensagem);
    else toast.success(mensagem);
    qc.invalidateQueries({ queryKey: ["certificado-envios-hoje"] });
    qc.invalidateQueries({ queryKey: ["certificado-leads"] });
    qc.invalidateQueries({ queryKey: ["certificado-logs"] });
    qc.invalidateQueries({ queryKey: ["envio-meta-jobs"] });
  }, onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao processar") });
  const alterarPool = async (instancia: typeof metaInstancias[number], ativar: boolean) => {
    if (!confirm(`${ativar ? "Ativar" : "Desativar"} o pool geral de ${instancia.nome}? Isso também afeta campanhas e aquecimento.`)) return;
    const nome = ativar ? "ativar_meta_instancia_pool" : "retirar_meta_instancia_pool_manual";
    const { error } = await supabase.rpc(nome, { p_instancia_id: instancia.id });
    if (error) toast.error(error.message); else { toast.success(`Pool ${ativar ? "ativado" : "desativado"}`); qc.invalidateQueries({ queryKey: ["certificado-meta-instancias"] }); }
  };
  const alterarTemplateCertificado = async (template: CertificadoTemplate, ativo: boolean) => {
    setSavingTemplateId(template.id);
    try {
      const { error } = await supabase.from("certificado_prospeccao_templates").upsert({ template_mestre_id: template.id, ativo, updated_at: new Date().toISOString() }, { onConflict: "template_mestre_id" });
      if (error) throw error;
      if (!ativo && config?.template_nome === template.nome && config?.template_idioma === template.idioma) {
        await salvarConfig.mutateAsync({ template_nome: null, meta_bm_id: null, prospeccao_ativa: false });
      }
      await qc.invalidateQueries({ queryKey: ["certificado-templates-mestre"] });
      toast.success(`Template ${ativo ? "habilitado" : "inabilitado"} no Certificado Digital`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o template");
    } finally {
      setSavingTemplateId(null);
    }
  };

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

        <Tabs defaultValue="coleta" className="space-y-6">
          <TabsList><TabsTrigger value="coleta">Coleta</TabsTrigger><TabsTrigger value="prospeccao">Prospecção</TabsTrigger></TabsList>
          <TabsContent value="coleta" className="space-y-6">
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Chave API da Casa dos Dados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {carregandoChave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Badge variant={chaveStatus?.configurada ? "default" : "destructive"}>{chaveStatus?.configurada ? "CONFIGURADA" : "NÃO CONFIGURADA"}</Badge>}
              {chaveStatus?.origem === "painel" && <span className="text-sm text-muted-foreground">Final •••• {chaveStatus.sufixo}{chaveStatus.updated_at ? ` · atualizada em ${new Date(chaveStatus.updated_at).toLocaleString("pt-BR")}` : ""}</span>}
              {chaveStatus?.origem === "ambiente" && <span className="text-sm text-muted-foreground">Configuração anterior ativa</span>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="password" autoComplete="new-password" maxLength={200} value={chaveCasaDados} onChange={(event) => setChaveCasaDados(event.target.value)} placeholder={chaveStatus?.configurada ? "Digite uma nova chave para substituir" : "Cole a chave API"} aria-label="Chave API da Casa dos Dados" />
              <Button onClick={() => gerenciarChave.mutate({ action: "salvar", chave: chaveCasaDados.trim() })} disabled={gerenciarChave.isPending || chaveCasaDados.trim().length < 20}>{gerenciarChave.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Testar e salvar</Button>
              {chaveStatus?.origem === "painel" && <Button variant="outline" size="icon" title="Remover chave cadastrada" aria-label="Remover chave cadastrada" onClick={() => { if (confirm("Remover a chave cadastrada da Casa dos Dados?")) gerenciarChave.mutate({ action: "remover" }); }} disabled={gerenciarChave.isPending}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <p className="text-xs text-muted-foreground">A chave é validada antes de ser salva e permanece oculta após o cadastro.</p>
          </CardContent>
        </Card>
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
          </TabsContent>
          <TabsContent value="prospeccao" className="space-y-6">
             <Card className="border-primary/30"><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">Piloto de prospecção</p><p className="text-sm text-muted-foreground">Até 50 mensagens por dia, de segunda a sexta, com início automático às 09h.</p></div><div className="flex items-center gap-3"><Badge variant={config?.prospeccao_ativa ? "default" : "outline"}>{config?.prospeccao_ativa ? "ATIVO" : "PAUSADO"}</Badge><Switch checked={config?.prospeccao_ativa ?? false} onCheckedChange={(checked) => salvarConfig.mutate({ prospeccao_ativa: checked })} disabled={!config?.meta_bm_id || !config?.template_nome || salvarConfig.isPending} /></div></CardContent></Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader><CardTitle>Template e BM piloto</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Template para envio</Label><Select value={templateSelecionado?.id ?? ""} onValueChange={(value) => { const template = templatesHabilitados.find((item) => item.id === value); if (template) salvarConfig.mutate({ template_nome: template.nome, template_idioma: template.idioma, meta_bm_id: null, prospeccao_ativa: false }); }}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um template habilitado" /></SelectTrigger><SelectContent>{templatesHabilitados.map((template) => <SelectItem key={template.id} value={template.id}>{template.nome} · {template.categoria}</SelectItem>)}</SelectContent></Select></div><div><div className="flex items-center justify-between"><Label>BM aprovada</Label>{verificandoBms && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div><Select value={config?.meta_bm_id ?? ""} onValueChange={(value) => salvarConfig.mutate({ meta_bm_id: value, prospeccao_ativa: false })} disabled={!templateSelecionado || bmsCompativeis.length === 0}><SelectTrigger className="mt-1"><SelectValue placeholder={!templateSelecionado ? "Selecione primeiro o template" : bmsCompativeis.length === 0 ? "Nenhuma BM com aprovação" : "Escolha uma BM aprovada"} /></SelectTrigger><SelectContent>{bmsCompativeis.map((bm) => <SelectItem key={bm.id} value={bm.id}>{bm.nome} · {bm.quantidade} instância(s)</SelectItem>)}</SelectContent></Select>{templateSelecionado && !verificandoBms && bmsCompativeis.length === 0 && <p className="mt-2 text-xs text-destructive">Este template não está aprovado em nenhuma BM ativa.</p>}{config?.meta_bm_id && (() => { const bm = bmsCompativeis.find((item) => item.id === config.meta_bm_id); return bm ? <p className="mt-2 text-xs text-muted-foreground">{bm.quantidade} instância(s) aprovada(s) · sincronizado {bm.ultimaSincronizacao ? new Date(bm.ultimaSincronizacao).toLocaleString("pt-BR") : "sem data"}</p> : null; })()}</div><div className="rounded-md border p-3 text-sm"><div className="flex justify-between"><span>Enviados hoje</span><strong>{enviosHoje} / {config?.limite_diario ?? 50}</strong></div><div className="mt-2 flex justify-between"><span>Contatos com WhatsApp</span><strong>{leads.filter((l) => l.whatsapp_status === "com_whatsapp" && l.situacao === "novo").length}</strong></div></div></CardContent></Card>
               <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Preparação</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" className="w-full justify-start" onClick={() => verificarWhatsApp.mutate()} disabled={verificarWhatsApp.isPending}>{verificarWhatsApp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Verificar números agora</Button><Button variant="outline" className="w-full justify-start" onClick={() => processar.mutate({ simulacao: true })} disabled={processar.isPending}><Activity className="mr-2 h-4 w-4" />Simular próximo envio</Button><div className="flex gap-2"><Input value={telefoneTeste} onChange={(e) => setTelefoneTeste(e.target.value)} placeholder="Telefone para teste" /><Button variant="outline" onClick={() => processar.mutate({ modo_teste: true, telefone_teste: telefoneTeste })} disabled={processar.isPending || telefoneTeste.replace(/\D/g, "").length < 10}><Send className="mr-2 h-4 w-4" />Testar</Button></div><Button className="w-full" onClick={() => processar.mutate({ iniciar_completo: true })} disabled={processar.isPending || !config?.prospeccao_ativa}>{processar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Iniciar processamento e envios</Button></CardContent></Card>
            </div>
            <CertificadoTemplatesCard templates={templates} savingId={savingTemplateId} onToggle={alterarTemplateCertificado} />
            <Card><CardHeader><CardTitle>Instâncias da BM e aprovação do template</CardTitle></CardHeader><CardContent><p className="mb-4 text-xs text-muted-foreground">Este controle altera o pool geral da BM e pode impactar campanhas e aquecimento.</p><div className="space-y-2">{metaInstancias.length === 0 ? <p className="text-sm text-muted-foreground">Selecione uma BM para visualizar as instâncias.</p> : metaInstancias.map((inst) => { const status = templateStatus.find((t) => t.instancia_id === inst.id)?.status ?? "ausente"; const noPool = inst.estado_pool === "ativo" && !inst.pool_fora_manual; return <div key={inst.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{inst.nome}</p><p className="text-xs text-muted-foreground">{inst.display_phone || "Sem telefone"} · {inst.saude_status || "Sem status"} · {inst.saude_quality || "Qualidade desconhecida"}</p></div><div className="flex items-center gap-2"><Badge variant={status === "approved" ? "default" : status === "ausente" ? "outline" : "destructive"}>{status === "approved" ? "Template aprovado" : status === "ausente" ? "Template ausente" : status}</Badge><Label className="text-xs">Pool geral</Label><Switch checked={noPool} onCheckedChange={(checked) => alterarPool(inst, checked)} /></div></div>; })}</div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
