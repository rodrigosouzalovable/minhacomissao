import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleOff, Loader2, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEnvioMetaSending, type InstanciaStatusJob } from "@/contexts/EnvioMetaSendingContext";
import { toast } from "sonner";

type Props = {
  jobId: string;
  isAdmin: boolean;
  initialOpen?: boolean;
};

function qualidadeLabel(qualidade: string | null) {
  const value = String(qualidade || "").toUpperCase();
  return value === "GREEN" || value === "YELLOW" || value === "RED" ? value : "Sem informação";
}

function qualidadeClass(qualidade: string | null) {
  switch (String(qualidade || "").toUpperCase()) {
    case "GREEN": return "bg-green-500/15 text-green-700 dark:text-green-300";
    case "YELLOW": return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "RED": return "bg-red-500/15 text-red-700 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function InstanciaRow({
  instancia,
  isAdmin,
  reativando,
  onReativar,
}: {
  instancia: InstanciaStatusJob;
  isAdmin: boolean;
  reativando: boolean;
  onReativar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b last:border-b-0 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {instancia.ignorada ? (
          <CircleOff className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{instancia.nome}</span>
            {instancia.em_uso && <Badge variant="outline" className="text-[10px]">Enviando agora</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {instancia.telefone && <span>{instancia.telefone}</span>}
            {instancia.bm && <span>BM: {instancia.bm}</span>}
            <span>{instancia.enviados} enviados</span>
            {instancia.erros > 0 && <span className="text-destructive">{instancia.erros} erros</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={qualidadeClass(instancia.qualidade)}>{qualidadeLabel(instancia.qualidade)}</Badge>
        {instancia.ignorada && instancia.motivo_ignorada && (
          <span className="max-w-[170px] text-right text-xs text-muted-foreground">{instancia.motivo_ignorada}</span>
        )}
        {instancia.ignorada && instancia.motivo_ignorada === "falhas consecutivas" && isAdmin && (
          <Button size="sm" variant="outline" disabled={reativando} onClick={onReativar}>
            {reativando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CampanhaInstanciasPanel({ jobId, isAdmin, initialOpen = false }: Props) {
  const { listarInstanciasStatusJob, reativarInstanciaJob } = useEnvioMetaSending();
  const [instancias, setInstancias] = useState<InstanciaStatusJob[] | null>(null);
  const [open, setOpen] = useState(initialOpen);
  const [carregando, setCarregando] = useState(false);
  const [reativando, setReativando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setInstancias(await listarInstanciasStatusJob(jobId));
    } finally {
      setCarregando(false);
    }
  }, [jobId, listarInstanciasStatusJob]);

  useEffect(() => {
    setOpen(initialOpen);
    if (initialOpen) void carregar();
  }, [initialOpen, carregar]);

  const abrir = () => {
    setOpen((value) => !value);
    if (!open && !instancias) void carregar();
  };

  const reativar = async (id: string) => {
    setReativando(id);
    try {
      if (await reativarInstanciaJob(jobId, id)) await carregar();
    } finally {
      setReativando(null);
    }
  };

  const ativas = (instancias || []).filter((i) => !i.ignorada);
  const ignoradas = (instancias || []).filter((i) => i.ignorada);

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Button type="button" variant="ghost" className="h-auto min-w-0 justify-start gap-2 px-0 py-0 text-left text-sm font-medium" onClick={abrir} aria-expanded={open}>
          <Send className="h-4 w-4 text-muted-foreground" />
          <span>Instâncias do disparo</span>
          {instancias && <span className="text-xs font-normal text-muted-foreground">{ativas.length} ativas · {ignoradas.length} ignoradas</span>}
        </Button>
        {open && (
          <Button size="sm" variant="ghost" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar instâncias">
            <RefreshCw className={carregando ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        )}
      </div>
      {open && (
        <div className="border-t">
          {carregando && !instancias ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando instâncias…</div>
          ) : instancias?.length ? (
            <div>
              {ativas.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300"><CheckCircle2 className="h-3.5 w-3.5" /> Ativas (enviando)</div>
                  {ativas.map((instancia) => <InstanciaRow key={instancia.id} instancia={instancia} isAdmin={isAdmin} reativando={reativando === instancia.id} onReativar={() => void reativar(instancia.id)} />)}
                </div>
              )}
              {ignoradas.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 border-t bg-muted/40 px-3 py-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Ignoradas automaticamente</div>
                  {ignoradas.map((instancia) => <InstanciaRow key={instancia.id} instancia={instancia} isAdmin={isAdmin} reativando={reativando === instancia.id} onReativar={() => void reativar(instancia.id)} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><XCircle className="h-4 w-4" /> Nenhuma instância encontrada nesta campanha.</div>
          )}
        </div>
      )}
    </div>
  );
}
