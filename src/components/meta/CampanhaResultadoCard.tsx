import { useCallback, useEffect, useState } from "react";
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

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CampanhaResultadoCard({ jobId, nome, template }: { jobId: string; nome: string; template?: string | null }) {
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("envio_meta_job_resultado" as any)
      .select("*")
      .eq("job_id", jobId)
      .maybeSingle();
    if (data) setDados(data as unknown as Resultado);
  }, [jobId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const recalcular = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc("envio_meta_job_resultado_calcular" as any, {
        _job_id: jobId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setDados(row as unknown as Resultado);
      else await carregar();
      toast.success("Resultado atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível calcular agora");
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
  const corTaxa = taxa >= 15 ? "bg-green-600" : taxa >= 8 ? "bg-amber-500" : "bg-red-600";

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Resultado da campanha
          {template && <Badge variant="outline" className="font-mono text-[10px]">{template}</Badge>}
          {dados && <Badge className={`${corTaxa} text-white`}>{taxa.toFixed(1).replace(".", ",")}% de resposta</Badge>}
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

      {!dados ? (
        <div className="text-xs text-muted-foreground">
          Ainda não calculado — clique em “Atualizar” para conferir respostas, conversas abertas e acordos desta campanha.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded border bg-muted/40 p-2">
              <div className="text-lg font-semibold">{dados.enviados}</div>
              <div className="text-[11px] text-muted-foreground">Enviadas</div>
            </div>
            <div className="rounded border bg-muted/40 p-2">
              <div className="text-lg font-semibold">{dados.conversas_abertas}</div>
              <div className="text-[11px] text-muted-foreground">Conversas abertas</div>
            </div>
            <div className="rounded border bg-muted/40 p-2">
              <div className="text-lg font-semibold">{dados.respostas}</div>
              <div className="text-[11px] text-muted-foreground">Respostas recebidas</div>
            </div>
            <div className="rounded border bg-muted/40 p-2">
              <div className="text-lg font-semibold flex items-center justify-center gap-1">
                <Handshake className="h-4 w-4" /> {dados.acordos_fechados}
              </div>
              <div className="text-[11px] text-muted-foreground">Acordos ({Number(dados.taxa_acordo).toFixed(1).replace(".", ",")}%)</div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Valor dos acordos: <strong>{brl(Number(dados.acordos_valor))}</strong> • falhas: {dados.falhas} • atualizado em{" "}
            {new Date(dados.calculado_em).toLocaleString("pt-BR")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Resposta = cliente respondeu em até 72h após receber. Acordo = mesmo telefone (ou CPF, quando houver) com acordo
            lançado em até 15 dias — o valor continua subindo nesses 15 dias conforme os atendentes lançam.
          </div>
        </>
      )}
    </div>
  );
}
