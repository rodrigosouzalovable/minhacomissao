import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, Square, RefreshCw, Trash2, RotateCcw, Copy, Download, HelpCircle, Repeat } from "lucide-react";
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
    refreshStatus,
  } = useEnvioMetaSending();

  const job = useMemo(() => jobs.find((j) => j.id === jobId) || null, [jobs, jobId]);

  // Ao abrir o diálogo, sempre força um refetch dos itens (não só a primeira vez).
  useEffect(() => {
    if (open && jobId) {
      ensureItensLoaded(jobId);
      recarregarItensJob(jobId);
    }
  }, [open, jobId, ensureItensLoaded, recarregarItensJob]);

  // Polling leve enquanto o diálogo está aberto e o job segue rodando/pausado.
  useEffect(() => {
    if (!open || !jobId) return;
    const j = jobs.find((x) => x.id === jobId);
    if (!j || (j.status !== "rodando" && j.status !== "pausado")) return;
    const t = setInterval(() => { recarregarItensJob(jobId); }, 8000);
    return () => clearInterval(t);
  }, [open, jobId, jobs, recarregarItensJob]);

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
  const ativa = job.status === "rodando" || job.status === "pausado";
  const pausado = job.status === "pausado";
  const totalProcessado = job.enviados + job.erros;
  const percent = Math.round((totalProcessado / Math.max(job.total, 1)) * 100);

  const nome = job.nome_campanha || job.template_nome || "Campanha";

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
    const rows = detalhes.enviados.map((e) => ({
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
  };
  const baixarErros = async () => {
    const rows = detalhes.erros.map((e) => ({
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
  };
  const falhasEntrega = detalhes.enviados.filter(
    (e) => (e.deliveryStatus as string) === "failed" || (e.deliveryStatus as string) === "falhou",
  );
  const baixarFalhasEntrega = async () => {
    const rows = falhasEntrega.map((e) => ({
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

        <div className="space-y-4">
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
            <Progress value={percent} />
            {progresso?.atualTelefone && (
              <div className="text-xs text-muted-foreground">
                Último: <code>{progresso.atualTelefone}</code>
                {progresso.atualInstancia && <> via <strong>{progresso.atualInstancia}</strong></>}
              </div>
            )}
            {progresso && progresso.proximoEmSeg > 0 && !pausado && (
              <div className="text-xs text-muted-foreground">Próximo envio em {progresso.proximoEmSeg}s</div>
            )}
            {resultado?.statusMotivo && resultado.enviados === 0 && (
              <div className="text-xs text-amber-600">Nenhuma mensagem foi enviada: {resultado.statusMotivo}</div>
            )}
            {job.instancias_bloqueadas_run.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                ⚠️ {job.instancias_bloqueadas_run.length} instância(s) ignorada(s) automaticamente após falhas consecutivas. Envios continuam com as demais.
              </div>
            )}
          </div>

          {/* Delivery resumo */}
          {detalhes.enviados.length > 0 && (
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
          )}


          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
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
            {!ativa && (
              <Button size="sm" variant="outline" onClick={() => limparJob(job.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { refreshStatus(); recarregarItensJob(job.id); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
            </Button>
          </div>

          {/* Enviados */}
          <details className="rounded-md border bg-card" open={detalhes.enviados.length > 0 && detalhes.enviados.length <= 20}>
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="text-green-700 dark:text-green-400">
                Enviados <span className="text-muted-foreground font-normal">({detalhes.enviados.length})</span>
              </span>
              {detalhes.enviados.length > 0 && (
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(detalhes.enviados.map((x) => x.telefone), "Enviados"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); baixarEnviados(); }}>
                    <Download className="h-3 w-3 mr-1" /> Baixar Excel
                  </Button>
                </div>
              )}
            </summary>
            <div className="max-h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono">
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
            </div>
          </details>

          {/* Erros */}
          {detalhes.erros.length > 0 && (
            <details className="rounded-md border bg-card" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                <span className="text-red-700 dark:text-red-400">
                  Erros <span className="text-muted-foreground font-normal">({detalhes.erros.length})</span>
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(detalhes.erros.map((x) => x.telefone), "Erros"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); baixarErros(); }}>
                    <Download className="h-3 w-3 mr-1" /> Baixar Excel
                  </Button>
                </div>
              </summary>
              <div className="max-h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono">
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
              </div>
            </details>
          )}

          {/* Falharam na entrega */}
          {falhasEntrega.length > 0 && (
            <details className="rounded-md border bg-card" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                <span className="text-red-700 dark:text-red-400">
                  Falharam na entrega <span className="text-muted-foreground font-normal">({falhasEntrega.length})</span>
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); copiar(falhasEntrega.map((x) => x.telefone), "Falharam na entrega"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={(e) => { e.preventDefault(); baixarFalhasEntrega(); }}>
                    <Download className="h-3 w-3 mr-1" /> Baixar Excel
                  </Button>
                </div>
              </summary>
              <div className="max-h-64 overflow-auto px-3 py-2 space-y-1 text-xs font-mono">
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
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                <span className="text-amber-700 dark:text-amber-400">Sem WhatsApp ({detalhes.semWhatsapp.length})</span>
              </summary>
              <div className="max-h-48 overflow-auto px-3 py-2 space-y-0.5 text-xs font-mono">
                {detalhes.semWhatsapp.map((t, i) => <div key={i}>{t}</div>)}
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
