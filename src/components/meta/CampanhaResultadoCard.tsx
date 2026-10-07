import { useEffect, useRef, useState } from "react";
import { useCampaignLive } from '@/hooks/useCampaignLive';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, MessageSquare, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportarParaExcel } from "@/lib/exportExcel";

type Resultado = {
  enviados: number;
  falhas: number;
  respostas: number;
  conversas_abertas: number;
  acordos_fechados: number;
  acordos_valor: number;
  taxa_resposta: number;
  taxa_acordo: number;
  calculado_em: string;
};

type CalculationError = { code?: string; message?: string; status?: number };

function descreverFalha(error: unknown): string {
  const falha = error && typeof error === "object" ? error as CalculationError : {};
  if (falha.code === "57014" || falha.status === 408 || falha.status === 504) {
    return "A apuração demorou mais do que o servidor permite. Os números anteriores foram preservados; tente novamente em alguns minutos.";
  }
  if (falha.code === "42501" || falha.status === 401 || falha.status === 403 || /n[aã]o autorizado|apenas administradores/i.test(falha.message || "")) {
    return "Sua sessão não tem permissão para apurar esta campanha. Entre novamente e tente outra vez.";
  }
  if (falha.status === 0 || /fetch|network|connection/i.test(falha.message || "")) {
    return "A conexão foi interrompida antes do fim da apuração. Os números anteriores foram preservados; tente novamente.";
  }
  return `Não foi possível atualizar o resultado${falha.code ? ` (código ${falha.code})` : ""}. Os números anteriores foram preservados; tente novamente.`;
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CampanhaResultadoCard({ jobId, nome, template, enviadosAtual }: { jobId: string; nome: string; template?: string | null; enviadosAtual: number }) {
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroAtualizacao, setErroAtualizacao] = useState<string | null>(null);
  const busy = useRef(false);
  const lastRead = useRef(0);
  useCampaignLive([jobId], () => {
    if (busy.current || Date.now() - lastRead.current < 15000) return;
    busy.current = true;
    lastRead.current = Date.now();
    void supabase.rpc('campanha_meta_resultado_ao_vivo', { _job_id: jobId }).then(({ data, error }) => {
      if (!error && data) setDados(data as unknown as Resultado);
    }).finally(() => { busy.current = false; });
  });

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErroAtualizacao(null);
    const carregar = async () => {
      const { data } = await supabase
        .from("envio_meta_job_resultado" as any)
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();
      if (ativo && data) setDados(data as unknown as Resultado);
    };
    void carregar();
    return () => { ativo = false; };
  }, [jobId]);

  const recalcular = async () => {
    if (carregando) return;
    setCarregando(true);
    setErroAtualizacao(null);
    try {
      const { data, error } = await supabase.rpc("campanha_meta_resultado_ao_vivo", {
        _job_id: jobId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("A apuração não retornou resultado");
      setDados(row as unknown as Resultado);
      toast.success("Resultado atualizado");
    } catch (e) {
      console.warn("Falha ao apurar resultado da campanha", { jobId, error: e });
      setErroAtualizacao(descreverFalha(e));
    } finally {
      setCarregando(false);
    }
  };

  const baixar = async () => {
    if (!dados) return;
    await exportarParaExcel(
      [
        {
          campanha: nome,
          enviados: dados.enviados,
          conversas: dados.conversas_abertas,
          respostas: dados.respostas,
          taxa: `${Number(dados.taxa_resposta).toFixed(2).replace(".", ",")}%`,
          acordos: dados.acordos_fechados,
          valor: brl(Number(dados.acordos_valor)),
          taxa_acordo: `${Number(dados.taxa_acordo).toFixed(2).replace(".", ",")}%`,
        },
      ],
      [
        { chave: "campanha", titulo: "Campanha" },
        { chave: "enviados", titulo: "Enviadas" },
        { chave: "conversas", titulo: "Conversas abertas" },
        { chave: "respostas", titulo: "Respostas recebidas" },
        { chave: "taxa", titulo: "Taxa de resposta" },
        { chave: "acordos", titulo: "Acordos fechados" },
        { chave: "valor", titulo: "Valor dos acordos" },
        { chave: "taxa_acordo", titulo: "Taxa de acordos" },
      ],
      `resultado_${(nome || "campanha").replace(/[^\w\-.]+/g, "_").slice(0, 50)}`,
    );
    toast.success("Resultado exportado");
  };

  const taxa = Number(dados?.taxa_resposta || 0);
  const formatar = (valor: number) => Number(valor || 0).toLocaleString("pt-BR");

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Resultado da campanha
          {template && <Badge variant="outline" className="font-mono text-[10px]">{template}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={carregando} onClick={recalcular}>
            <RefreshCw className={`h-3 w-3 mr-1 ${carregando ? "animate-spin" : ""}`} />
            {carregando ? "Calculando..." : "Atualizar"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!dados} onClick={baixar}>
            <Download className="h-3 w-3 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {carregando && <p role="status" className="text-xs text-muted-foreground">Apurando envios e respostas; aguarde a conclusão.</p>}
      {erroAtualizacao && <p role="alert" className="text-xs text-destructive">{erroAtualizacao}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded border bg-muted/40 p-2 min-w-0">
          <div className="text-lg font-semibold tabular-nums">{formatar(enviadosAtual)}</div>
          <div className="text-[11px] text-muted-foreground">Mensagens enviadas até agora</div>
        </div>
        <div className="rounded border bg-muted/40 p-2 min-w-0">
          <div className="text-lg font-semibold tabular-nums">{dados ? formatar(dados.respostas) : "—"}</div>
          <div className="text-[11px] text-muted-foreground">Mensagens respondidas</div>
        </div>
        <div className="rounded border bg-muted/40 p-2 min-w-0">
          <div className="text-lg font-semibold tabular-nums">{dados ? formatar(dados.conversas_abertas) : "—"}</div>
          <div className="text-[11px] text-muted-foreground">Pessoas que responderam</div>
        </div>
        <div className="rounded border bg-muted/40 p-2 min-w-0">
          <div className="text-lg font-semibold tabular-nums">{dados ? `${taxa.toFixed(1).replace(".", ",")}%` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">Taxa de resposta</div>
        </div>
      </div>
      {!dados ? (
        <p className="text-xs text-muted-foreground">Aguardando apuração das respostas.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Respostas apuradas em {new Date(dados.calculado_em).toLocaleString("pt-BR")} com {formatar(dados.enviados)} envios.
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <Handshake className="h-3.5 w-3.5" /> Acordos: <strong>{formatar(dados.acordos_fechados)}</strong> ({Number(dados.taxa_acordo).toFixed(1).replace(".", ",")}%) • Valor: <strong>{brl(Number(dados.acordos_valor))}</strong> • Falhas: {formatar(dados.falhas)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Resposta = mensagem recebida até 72h após o envio. A taxa considera pessoas distintas sobre os envios apurados; várias respostas da mesma pessoa contam uma vez na taxa. Acordos são vinculados por telefone ou CPF em até 15 dias.
          </p>
        </>
      )}
    </div>
  );
}
