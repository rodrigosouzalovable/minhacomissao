import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, Square, RefreshCw, Trash2, RotateCcw, Copy, Download, HelpCircle, Repeat, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { exportarParaExcel } from "@/lib/exportExcel";
import { humanizarErroEnvio } from "@/lib/humanizarErroEnvio";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = { jobId: string | null; open: boolean; onOpenChange: (v: boolean) => void };

function statusColor(s: string) {
  switch (s) {
    case "rodando": return "bg-blue-600 text-white";
    case "pausado": return "bg-amber-500 text-white";
    case "concluido": return "bg-green-600 text-white";
    case "cancelado": return "bg-gray-500 text-white";
    case "erro": return "bg-red-600 text-white";
    default: return "bg-muted";
  }
}
function statusLabel(s: string) {
  return s === "rodando" ? "Rodando" : s === "pausado" ? "Pausada" : s === "concluido" ? "Concluída" : s === "cancelado" ? "Cancelada" : s === "erro" ? "Erro" : s;
}

function parseRateLimitMotivo(motivo?: string | null) {
  const raw = String(motivo || "");
  if (!raw.startsWith("RATE_LIMIT:")) return null;
  const parts = raw.split(":");
  const ms = Math.max(0, Number(parts[2]) || 0);
  const mensagem = parts.slice(3).join(":") || "Meta pausou temporariamente esta instância por rate limit.";
  return { segundos: Math.ceil(ms / 1000), mensagem };
}
function formatDuracao(seg: number): string {
  if (seg < 60) return `${Math.max(1, Math.round(seg))}s`;
  const totalMin = Math.round(seg / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}


export default function CampanhaDetalheDialog({ jobId, open, onOpenChange }: Props) {
  const {
    jobs,
    getProgressoJob,
    getDetalhesJob,
    getDeliveryResumoJob,
    getResultadoJob,
    togglePausaJob,
    cancelarJob,
    reativarJob,
    limparJob,
    ensureItensLoaded,
    recarregarItensJob,
    carregarMaisItensJob,
    getPaginacaoJob,
    refreshCountersJob,
    marcarJobAberto,
    refreshStatus,
    exportarItensJob,
  } = useEnvioMetaSending();


  const job = useMemo(() => jobs.find((j) => j.id === jobId) || null, [jobs, jobId]);

  // Enquanto o diálogo está aberto, o contexto pode reler os itens; fechado, não.
  useEffect(() => {
    if (!open || !jobId) return;
    marcarJobAberto(jobId, true);
    recarregarItensJob(jobId);
    return () => marcarJobAberto(jobId, false);
  }, [open, jobId, marcarJobAberto, recarregarItensJob]);

  // Polling leve enquanto o diálogo está aberto — só refetch quando cache diverge do backend
  // e apenas com a aba visível (economia de CPU do banco).
  useEffect(() => {
    if (!open || !jobId) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const j = jobs.find((x) => x.id === jobId);
      if (!j) return;
      // Não refetch em jobs finalizados.
      if (j.status !== 'rodando' && j.status !== 'pausado') return;
      const backend = (j.enviados || 0) + (j.erros || 0);
      const det = getDetalhesJob(jobId);
      const cached = (det?.enviados?.length || 0) + (det?.erros?.length || 0);
      // Só recarrega a 1ª página enquanto a lista ainda não estourou o limite de 200.
      // Depois disso o usuário controla via "Carregar mais" / "Atualizar".
      if (cached < 200 && backend !== cached) recarregarItensJob(jobId);
    }, 30000);

    return () => clearInterval(t);
  }, [open, jobId, jobs, recarregarItensJob, getDetalhesJob]);



  const [reenviandoErros, setReenviandoErros] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [exportProgresso, setExportProgresso] = useState(0);


  // Estado local dos <details> — controlado pelo usuário, sem re-forçar a cada polling.
  const [openEnviados, setOpenEnviados] = useState<boolean>(false);
  const [openErros, setOpenErros] = useState<boolean>(true);
  const [openFalhas, setOpenFalhas] = useState<boolean>(true);
  useEffect(() => {
    if (open && jobId) {
      setOpenEnviados(false);
      setOpenErros(true);
      setOpenFalhas(true);
    }
  }, [open, jobId]);

  if (!job) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Campanha não encontrada</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const progresso = getProgressoJob(job.id);
  const detalhes = getDetalhesJob(job.id);
  const resumo = getDeliveryResumoJob(job.id);
  const resultado = getResultadoJob(job.id);
  const paginacao = getPaginacaoJob(job.id);

  const ativa = job.status === "rodando" || job.status === "pausado";
  const pausado = job.status === "pausado";
  const totalProcessado = job.enviados + job.erros;
  const percent = Math.round((totalProcessado / Math.max(job.total, 1)) * 100);

  const nome = job.nome_campanha || job.template_nome || "Campanha";
  const rateLimitInfo = parseRateLimitMotivo((job as any).status_motivo || resultado?.statusMotivo);

  // ===== Previsão de término (estimativa) =====
  const eta = (() => {
    const restantes = Math.max(0, job.total - totalProcessado);

    const instTotal = job.instancia_ids?.length || 1;
    const bloqueadas = job.instancias_bloqueadas_run?.length || 0;
    const instAtivas = Math.max(1, instTotal - bloqueadas);

    // Ritmo teórico conforme as configurações da campanha.
    let segPorMsgTeorico: number;
    let config: string;
    if (job.modo_rajada) {
      const mps = job.msgs_por_segundo || 30;
      const taxa = Math.max(0.1, mps * instAtivas);
      segPorMsgTeorico = 1 / taxa;
      config = `Rajada: ${mps} msg/s × ${instAtivas} instância${instAtivas > 1 ? "s" : ""}`;
    } else {
      const lo = Math.max(1, job.min_seg ?? 30);
      const hi = Math.max(lo, job.max_seg ?? 90);
      segPorMsgTeorico = (lo + hi) / 2;
      config = `Delay configurado: ${lo}–${hi}s (aleatório por envio)`;
    }
    const teorico = segPorMsgTeorico < 1
      ? `~${(1 / segPorMsgTeorico).toFixed(1)} msg/s`
      : `~1 msg / ${segPorMsgTeorico.toFixed(1).replace(".", ",").replace(",0", "")}s`;

    // Campanha finalizada: mostra a duração real.
    if (!ativa) {
      if (!job.iniciado_em) return null;
      const fim = job.concluido_em ? new Date(job.concluido_em).getTime() : Date.now();
      const seg = Math.max(0, Math.round((fim - new Date(job.iniciado_em).getTime()) / 1000));
      return { tipo: "final" as const, duracao: formatDuracao(seg), config, teorico };
    }
    if (restantes === 0) return null;

    // Ritmo real observado (mais fiel quando já há histórico suficiente).
    let segPorMsg = segPorMsgTeorico;
    if (job.iniciado_em && totalProcessado >= 5) {
      const decorrido = (Date.now() - new Date(job.iniciado_em).getTime()) / 1000;
      if (decorrido > 0) segPorMsg = decorrido / totalProcessado;
    }

    const segRestantes = Math.round(restantes * segPorMsg);
    const fim = new Date(Date.now() + segRestantes * 1000);
    const hoje = new Date();
    const mesmoDia = fim.toDateString() === hoje.toDateString();
    const hora = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const termino = mesmoDia
      ? `hoje ${hora}`
      : `${hora} (${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})`;

    const ritmo = segPorMsg < 1
      ? `~${(1 / segPorMsg).toFixed(1)} msg/s`
      : `~1 msg / ${Math.round(segPorMsg)}s`;

    return { tipo: "previsao" as const, restantes, ritmo, duracao: formatDuracao(segRestantes), termino, config, teorico };
  })();





  const reenviarErros = async () => {
    if (reenviandoErros) return;
    if (!confirm(`Tentar novamente ${job.erros} números com erro?\n\nEles voltam para a fila de envios e a lista de erros é limpa. O disparo respeita o limite de mensagens por segundo (evita "Rate limit exceeded" da Meta).`)) return;
    setReenviandoErros(true);
    try {
      const { data, error } = await supabase.functions.invoke("envio-meta-massa-retry-erros", {
        body: { job_id: job.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao devolver à fila");
      toast.success(`${data.reenfileirados ?? 0} números devolvidos para a fila`);
      // Atualiza imediatamente para limpar a lista de erros na tela
      await Promise.all([refreshStatus(), recarregarItensJob(job.id)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível devolver à fila — tente novamente em instantes");

    } finally {
      setReenviandoErros(false);
    }
  };

  const copiar = (arr: string[], titulo: string) => {
    if (arr.length === 0) return;
    navigator.clipboard.writeText(arr.join("\n"));
    toast.success(`${titulo}: ${arr.length} copiados`);
  };

  const sanitize = (s: string) => (s || "").replace(/[^\w\-.]+/g, "_").slice(0, 60) || "campanha";
  const stamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  };
  const deliveryLabel = (s?: string) => {
    switch (s) {
      case "read": case "lida": return "Lida";
      case "delivered": case "entregue": return "Entregue";
      case "sent": case "aceito": return "Aceito";
      case "failed": case "falhou": return "Falhou";
      default: return "Aguardando";
    }
  };
  const baixarEnviados = async () => {
    if (exportando) return;
    setExportando("enviados");
    setExportProgresso(0);
    try {
      const todos = await exportarItensJob(job.id, setExportProgresso);
      const rows = todos.filter((e) => e.status === "enviado").map((e) => ({
        telefone: e.telefone,
        instancia: e.instancia || "",
        enviado_em: e.ts ? new Date(e.ts).toLocaleString("pt-BR") : "",
        status_entrega: deliveryLabel(e.deliveryStatus),
        erro_entrega: e.deliveryErro || "",
      }));
      if (rows.length === 0) { toast.error("Nada para exportar"); return; }
      await exportarParaExcel(
        rows,
        [
          { chave: "telefone", titulo: "Telefone" },
          { chave: "instancia", titulo: "Instância" },
          { chave: "enviado_em", titulo: "Enviado em" },
          { chave: "status_entrega", titulo: "Status entrega" },
          { chave: "erro_entrega", titulo: "Erro entrega" },
        ],
        `enviados_${sanitize(nome)}_${stamp()}`,
      );
      toast.success(`${rows.length} envios exportados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExportando(null);
    }
  };
  const baixarErros = async () => {
    if (exportando) return;
    setExportando("erros");
    setExportProgresso(0);
    try {
      const todos = await exportarItensJob(job.id, setExportProgresso);
      const rows = todos.filter((e) => e.status === "erro").map((e) => ({
        telefone: e.telefone,
        instancia: e.instancia || "",
        enviado_em: e.ts ? new Date(e.ts).toLocaleString("pt-BR") : "",
        motivo: humanizarErroEnvio(e.erro),
        erro_tecnico: e.erro || "",
      }));
      if (rows.length === 0) { toast.error("Nada para exportar"); return; }
      await exportarParaExcel(
        rows,
        [
          { chave: "telefone", titulo: "Telefone" },
          { chave: "instancia", titulo: "Instância" },
          { chave: "enviado_em", titulo: "Data/Hora" },
          { chave: "motivo", titulo: "Motivo (amigável)" },
          { chave: "erro_tecnico", titulo: "Erro técnico" },
        ],
        `erros_${sanitize(nome)}_${stamp()}`,
      );
      toast.success(`${rows.length} erros exportados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExportando(null);
    }
  };
  const falhasEntrega = detalhes.enviados.filter(
    (e) => (e.deliveryStatus as string) === "failed" || (e.deliveryStatus as string) === "falhou",
  );
  const baixarFalhasEntrega = async () => {
    if (exportando) return;
    setExportando("falhas");
    setExportProgresso(0);
    try {
      const todos = await exportarItensJob(job.id, setExportProgresso);
      const rows = todos
        .filter((e) => e.status === "enviado" && ((e.deliveryStatus as string) === "failed" || (e.deliveryStatus as string) === "falhou"))
        .map((e) => ({
          telefone: e.telefone,
          instancia: e.instancia || "",
          enviado_em: e.ts ? new Date(e.ts).toLocaleString("pt-BR") : "",
          motivo: humanizarErroEnvio(e.deliveryErro),
          erro_tecnico: e.deliveryErro || "",
        }));
      if (rows.length === 0) { toast.error("Nada para exportar"); return; }
      await exportarParaExcel(
        rows,
        [
          { chave: "telefone", titulo: "Telefone" },
          { chave: "instancia", titulo: "Instância" },
          { chave: "enviado_em", titulo: "Data/Hora" },
          { chave: "motivo", titulo: "Motivo (amigável)" },
          { chave: "erro_tecnico", titulo: "Erro técnico" },
        ],
        `falhas_entrega_${sanitize(nome)}_${stamp()}`,
      );
      toast.success(`${rows.length} falhas exportadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExportando(null);
    }
  };
  const rotuloBaixar = (tipo: string) =>
    exportando === tipo ? `Baixando... ${exportProgresso}` : "Baixar Excel";


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl h-[85vh] overflow-hidden flex flex-col gap-3"
        style={{ overflowAnchor: "none", scrollbarGutter: "stable", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-xl">{nome}</DialogTitle>
            <Badge className={statusColor(job.status)}>{statusLabel(job.status)}</Badge>
          </div>
          <DialogDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {job.nome_campanha && job.template_nome && <span>Template: <code>{job.template_nome}</code></span>}
            {job.instancia_ids && <span>{job.instancia_ids.length} instância(s)</span>}
            {job.iniciado_em && <span>Iniciada em {new Date(job.iniciado_em).toLocaleString("pt-BR")}</span>}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3"
          style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}
        >
          {/* Progresso */}
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {job.enviados + job.erros}/{job.total} processados ({percent}%)
              </span>
              <span className="text-muted-foreground text-xs">
                ✅ {job.enviados} • ❌ {job.erros} • ⏳ {Math.max(0, job.total - totalProcessado)}
              </span>
            </div>
            <Progress value={percent} className="h-4 shrink-0" />
            <div className="text-xs text-muted-foreground h-4 overflow-hidden whitespace-nowrap truncate">
              {progresso?.atualTelefone ? (
                <>
                  Último: <code>{progresso.atualTelefone}</code>
                  {progresso.atualInstancia && <> via <strong>{progresso.atualInstancia}</strong></>}
                </>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground h-4 overflow-hidden whitespace-nowrap truncate">
              {progresso && progresso.proximoEmSeg > 0 && !pausado
                ? `Próximo envio em ${progresso.proximoEmSeg}s`
                : null}
            </div>
            {eta && (
              <div className="text-xs rounded border bg-muted/40 px-2 py-1.5 space-y-0.5">
                {eta.tipo === "final" ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Duração total: <strong>{eta.duracao}</strong></span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Restam <strong>{eta.restantes}</strong> envios • Ritmo: <strong>{eta.ritmo}</strong>
                      </span>
                    </div>
                    <div>
                      Tempo estimado: <strong>~{eta.duracao}</strong> • Previsão de término:{" "}
                      <strong>{eta.termino}</strong>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {pausado
                        ? "Pausada — a contagem recomeça ao continuar. Estimativa aproximada."
                        : "Estimativa aproximada: varia com falhas, rate limit da Meta e instâncias bloqueadas."}
                    </div>
                  </>
                )}
              </div>
            )}
            {(() => {
              const motivo = String((job as any).status_motivo || resultado?.statusMotivo || '');
              const isBALock = /business account|#131031|locked/i.test(motivo);
              if (isBALock) {
                return (
                  <div className="text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/40 rounded px-3 py-2 space-y-1">
                    <div className="font-semibold">⛔ Business Account bloqueada pela Meta (#131031)</div>
                    <div>{motivo}</div>
                    <div className="text-red-600/80 dark:text-red-400/80">
                      Nenhum envio é possível enquanto a conta estiver <b>locked</b>. Acesse <b>business.facebook.com → Central de Contas / Qualidade da conta</b>, verifique o motivo e solicite revisão. Reativar aqui não tem efeito até a Meta liberar.
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {resultado?.statusMotivo && resultado.enviados === 0 && !/business account|#131031|locked/i.test(String((job as any).status_motivo || resultado?.statusMotivo || '')) && (
              <div className="text-xs text-amber-600">Nenhuma mensagem foi enviada: {resultado.statusMotivo}</div>
            )}
            {job.instancias_bloqueadas_run.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                ⚠️ {job.instancias_bloqueadas_run.length} instância(s) ignorada(s) automaticamente após falhas consecutivas. Envios continuam com as demais.
              </div>
            )}
            {rateLimitInfo && job.status === "rodando" && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
                <div className="font-semibold">Rate limit temporário da Meta</div>
                <div>{rateLimitInfo.mensagem}</div>
                {rateLimitInfo.segundos > 0 && <div>Próxima tentativa em até {rateLimitInfo.segundos}s.</div>}
              </div>
            )}
            {Array.isArray((job as any).instancias_bloqueadas) && (job as any).instancias_bloqueadas.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                ⛔ {(job as any).instancias_bloqueadas.length} instância(s) desativada(s) neste envio por template pausado pela Meta. Pendentes redistribuídos para as ativas.
              </div>
            )}
          </div>

          {/* Delivery resumo */}
          <div className="min-h-[24px] flex items-center overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">Aceito: {resumo.aceito}</Badge>
              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">Entregue: {resumo.entregue}</Badge>
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-300">Lida: {resumo.lida}</Badge>
              {resumo.falhou > 0 && <Badge variant="destructive">Falhou: {resumo.falhou}</Badge>}
              {resumo.aguardando > 0 && <Badge variant="outline">Aguardando: {resumo.aguardando}</Badge>}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="O que significam os status">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs leading-relaxed">
                    <div className="space-y-1">
                      <div><strong>Aceito</strong> — o WhatsApp recebeu a mensagem do nosso lado (1 tique). Ainda não chegou no aparelho do destinatário.</div>
                      <div><strong>Entregue</strong> — chegou no aparelho do destinatário (2 tiques cinza).</div>
                      <div><strong>Lida</strong> — o destinatário abriu a conversa (2 tiques azuis).</div>
                      <div><strong>Falhou</strong> — o WhatsApp devolveu falha na entrega (número não existe, bloqueou, conta banida etc.).</div>
                      <div><strong>Aguardando</strong> — ainda não recebemos confirmação de entrega.</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>


          {/* Ações */}
          <div className="min-h-[32px] flex flex-wrap items-center gap-2 shrink-0 overflow-hidden">
            {ativa && (
              <>
                <Button size="sm" variant="secondary" onClick={() => togglePausaJob(job.id)}>
                  {pausado ? <Play className="h-3.5 w-3.5 mr-1.5" /> : <Pause className="h-3.5 w-3.5 mr-1.5" />}
                  {pausado ? "Retomar" : "Pausar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => cancelarJob(job.id)}>
                  <Square className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                </Button>
              </>
            )}
            {!ativa && resultado && job.restantes > 0 && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => reativarJob(job.id)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reativar ({job.restantes})
              </Button>
            )}
            {job.erros > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                disabled={reenviandoErros}
                onClick={reenviarErros}
              >
                <Repeat className="h-3.5 w-3.5 mr-1.5" /> {reenviandoErros ? "Devolvendo…" : `Tentar novamente (${job.erros})`}
              </Button>
            )}
            {!ativa && (
              <Button size="sm" variant="outline" onClick={() => limparJob(job.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { refreshCountersJob(job.id); recarregarItensJob(job.id); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
            </Button>
          </div>

          {/* Enviados */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3" style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
          <details className="rounded-md border bg-card" open={openEnviados} onToggle={(e) => setOpenEnviados((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between min-h-[36px]">
              <span className="text-green-700 dark:text-green-400">
                Enviados <span className="text-muted-foreground font-normal">({job.enviados})</span>
              </span>

              {detalhes.enviados.length > 0 && (
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(detalhes.enviados.map((x) => x.telefone), "Enviados"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!!exportando} onClick={(e) => { e.preventDefault(); baixarEnviados(); }}>
                    <Download className="h-3 w-3 mr-1" /> {rotuloBaixar("enviados")}
                  </Button>
                </div>
              )}
            </summary>
            <div className="h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono" style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
              {detalhes.enviados.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-0.5">
                  <span>{e.telefone}</span>
                  <div className="flex items-center gap-2">
                    {e.ts && <span className="text-muted-foreground text-[10px]">{new Date(e.ts).toLocaleString("pt-BR")}</span>}
                    <span className="text-muted-foreground text-[10px]">{e.instancia}</span>
                  </div>
                </div>
              ))}
              {detalhes.enviados.length === 0 && <div className="text-muted-foreground italic">Nenhum ainda.</div>}
              {detalhes.enviados.length > 0 && detalhes.enviados.length < job.enviados && (
                <div className="pt-2 flex items-center justify-between gap-2 font-sans">
                  <span className="text-[10px] text-muted-foreground">
                    Mostrando os {detalhes.enviados.length} mais recentes de {job.enviados}
                  </span>
                  {paginacao.temMais && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={carregandoMais}
                      onClick={async () => { setCarregandoMais(true); try { await carregarMaisItensJob(job.id); } finally { setCarregandoMais(false); } }}>
                      {carregandoMais ? "Carregando..." : "Carregar mais"}
                    </Button>
                  )}
                </div>
              )}

            </div>
          </details>

          {/* Erros */}
          {detalhes.erros.length > 0 && (
            <details className="rounded-md border bg-card" open={openErros} onToggle={(e) => setOpenErros((e.currentTarget as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between min-h-[36px]">
                <span className="text-red-700 dark:text-red-400">
                  Erros <span className="text-muted-foreground font-normal">({job.erros})</span>
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(detalhes.erros.map((x) => x.telefone), "Erros"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!!exportando} onClick={(e) => { e.preventDefault(); baixarErros(); }}>
                    <Download className="h-3 w-3 mr-1" /> {rotuloBaixar("erros")}
                  </Button>
                </div>
              </summary>
              <div className="h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono" style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
                {detalhes.erros.map((e, i) => (
                  <div key={i} className="border-b border-border/40 py-1">
                    <div className="flex justify-between gap-2">
                      <span>{e.telefone}</span>
                      <div className="flex items-center gap-2">
                        {e.ts && <span className="text-muted-foreground text-[10px]">{new Date(e.ts).toLocaleString("pt-BR")}</span>}
                        <span className="text-muted-foreground text-[10px]">{e.instancia}</span>
                      </div>
                    </div>
                    <div className="text-red-600 text-[11px] break-words mt-0.5 font-sans">{humanizarErroEnvio(e.erro)}</div>
                    {e.erro && <div className="text-muted-foreground text-[10px] break-words mt-0.5">Detalhe técnico: {e.erro}</div>}
                  </div>
                ))}
                {detalhes.erros.length < job.erros && (
                  <div className="pt-2 flex items-center justify-between gap-2 font-sans">
                    <span className="text-[10px] text-muted-foreground">
                      Mostrando os {detalhes.erros.length} mais recentes de {job.erros}
                    </span>
                    {paginacao.temMais && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={carregandoMais}
                        onClick={async () => { setCarregandoMais(true); try { await carregarMaisItensJob(job.id); } finally { setCarregandoMais(false); } }}>
                        {carregandoMais ? "Carregando..." : "Carregar mais"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

            </details>
          )}

          {/* Falharam na entrega */}
          {falhasEntrega.length > 0 && (
            <details className="rounded-md border bg-card" open={openFalhas} onToggle={(e) => setOpenFalhas((e.currentTarget as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between min-h-[36px]">
                <span className="text-red-700 dark:text-red-400">
                  Falharam na entrega <span className="text-muted-foreground font-normal">({falhasEntrega.length})</span>
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(falhasEntrega.map((x) => x.telefone), "Falharam na entrega"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={!!exportando} onClick={(e) => { e.preventDefault(); baixarFalhasEntrega(); }}>
                    <Download className="h-3 w-3 mr-1" /> {rotuloBaixar("falhas")}
                  </Button>
                </div>
              </summary>
              <div className="h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono" style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
                {falhasEntrega.map((e, i) => (
                  <div key={i} className="border-b border-border/40 py-1">
                    <div className="flex justify-between gap-2">
                      <span>{e.telefone}</span>
                      <div className="flex items-center gap-2">
                        {e.ts && <span className="text-muted-foreground text-[10px]">{new Date(e.ts).toLocaleString("pt-BR")}</span>}
                        <span className="text-muted-foreground text-[10px]">{e.instancia}</span>
                      </div>
                    </div>
                    <div className="text-red-600 text-[11px] break-words mt-0.5 font-sans">{humanizarErroEnvio(e.deliveryErro)}</div>
                    {e.deliveryErro && <div className="text-muted-foreground text-[10px] break-words mt-0.5">Detalhe técnico: {e.deliveryErro}</div>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Sem WhatsApp */}
          {detalhes.semWhatsapp.length > 0 && (
            <details className="rounded-md border bg-card">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium min-h-[36px]">
                <span className="text-amber-700 dark:text-amber-400">Sem WhatsApp ({detalhes.semWhatsapp.length})</span>
              </summary>
              <div className="h-48 overflow-auto px-3 py-2 space-y-0.5 text-xs font-mono" style={{ overflowAnchor: "none", scrollbarGutter: "stable" }}>
                {detalhes.semWhatsapp.map((t, i) => <div key={i}>{t}</div>)}
              </div>
            </details>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
