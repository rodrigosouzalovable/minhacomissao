import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Pause, Play, Square } from "lucide-react";
import { useEnvioMetaSending } from "@/contexts/EnvioMetaSendingContext";
import { useUserRole } from "@/hooks/useUserRole";
import CampanhaDetalheDialog from "./CampanhaDetalheDialog";
import { cn } from "@/lib/utils";

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

export default function CampanhasFlutuante() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { jobs, jobsAtivos, togglePausaJob, cancelarJob } = useEnvioMetaSending();
  const [open, setOpen] = useState(false);
  const [dialogJobId, setDialogJobId] = useState<string | null>(null);

  // Mostra o widget se existirem campanhas ativas OU alguma finalizada recentemente exibível
  const finalizadasRecentes = jobs
    .filter((j) => ["concluido", "cancelado", "erro"].includes(j.status))
    .slice(0, 5);

  if (jobsAtivos.length === 0 && finalizadasRecentes.length === 0) return null;

  const abrirDetalhe = (id: string) => {
    setOpen(false);
    setDialogJobId(id);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="lg"
              className={cn(
                "rounded-full shadow-lg h-14 pl-4 pr-5 gap-2",
                jobsAtivos.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-secondary text-secondary-foreground"
              )}
              title="Campanhas de envio Meta"
            >
              <Send className="h-5 w-5" />
              <span className="font-semibold">Campanhas</span>
              {jobsAtivos.length > 0 && (
                <Badge className="bg-white text-blue-700 hover:bg-white h-6 min-w-6 px-2 flex items-center justify-center rounded-full">
                  {jobsAtivos.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-96 p-0 max-h-[70vh] overflow-y-auto">
            <div className="p-3 border-b bg-muted/40">
              <div className="text-sm font-semibold">Campanhas de envio</div>
              <div className="text-xs text-muted-foreground">
                {jobsAtivos.length > 0
                  ? `${jobsAtivos.length} em andamento`
                  : "Nenhuma campanha em andamento"}
              </div>
            </div>

            {jobsAtivos.length > 0 && (
              <div className="p-2 space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Ativas</div>
                {jobsAtivos.map((j) => {
                  const total = j.total;
                  const done = j.enviados + j.erros;
                  const pct = Math.round((done / Math.max(total, 1)) * 100);
                  return (
                    <div key={j.id} className="rounded-md border bg-card p-2 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="text-left flex-1 min-w-0"
                          onClick={() => abrirDetalhe(j.id)}
                        >
                          <div className="text-sm font-medium truncate">
                            {j.nome_campanha || j.template_nome || "Campanha"}
                          </div>
                          {j.nome_campanha && j.template_nome && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {j.template_nome}
                            </div>
                          )}
                        </button>
                        <Badge className={statusColor(j.status)}>{statusLabel(j.status)}</Badge>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{done}/{total} • {pct}%</span>
                        <span>✅ {j.enviados} • ❌ {j.erros}</span>
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={() => abrirDetalhe(j.id)}>
                          Ver detalhes
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => togglePausaJob(j.id)} title={j.status === "rodando" ? "Pausar" : "Retomar"}>
                          {j.status === "rodando" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => cancelarJob(j.id)} title="Cancelar">
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {finalizadasRecentes.length > 0 && (
              <div className="p-2 space-y-1 border-t">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Últimas finalizadas</div>
                {finalizadasRecentes.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => abrirDetalhe(j.id)}
                    className="w-full text-left rounded-md hover:bg-muted/60 p-2 flex items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {j.nome_campanha || j.template_nome || "Campanha"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ✅ {j.enviados} • ❌ {j.erros} de {j.total}
                      </div>
                    </div>
                    <Badge className={statusColor(j.status) + " text-[10px]"}>{statusLabel(j.status)}</Badge>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <CampanhaDetalheDialog
        jobId={dialogJobId}
        open={!!dialogJobId}
        onOpenChange={(v) => { if (!v) setDialogJobId(null); }}
      />
    </>
  );
}
