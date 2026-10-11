import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { readAllTemplateRows } from "../../../supabase/functions/_shared/meta-template-completion";


type Props = { instanciaIds: string[] };

type Resumo = {
  total: number;
  concluidos: number;
  pendentes: number;
  emVoo: number;
  problemas: number;
  numerosComPendencia: number;
  ultimaConferencia: string | null;
  proximaConferencia: string | null;
};


function rotuloRelativo(iso: string | null): string {
  if (!iso) return "ainda não conferido";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.round(min / 60)} h`;
}

function rotuloFuturo(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 0) return "a qualquer momento";
  if (min < 60) return `em ${min} min`;
  return `em ${Math.round(min / 60)} h`;
}


export default function TemplatesInjecaoProgresso({ instanciaIds }: Props) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [atualizando, setAtualizando] = useState(false);



  const carregar = useCallback(async () => {
    if (instanciaIds.length === 0) {
      setResumo(null);
      return;
    }
    let linhas: Array<{ instancia_id: string; status: string }>;
    try {
      linhas = await readAllTemplateRows(() => supabase.from("meta_templates_onboarding_fila")
        .select("id,instancia_id,status").in("instancia_id", instanciaIds).neq("status", "CANCELADO"));
    } catch { return; }
    if (linhas.length === 0) {
      setResumo(null);
      return;
    }
    const pendentesPorInst = new Set<string>();
    let pendentes = 0;
    let emVoo = 0;
    let problemas = 0;
    let concluidos = 0;
    for (const r of linhas) {
      const st = String(r.status || "").toUpperCase();
      if (st === "PENDENTE") {
        pendentes++;
        pendentesPorInst.add(r.instancia_id);
      } else if (st === "ENVIADO") {
        emVoo++;
        pendentesPorInst.add(r.instancia_id);
      } else if (st === "APPROVED") {
        concluidos++;
      } else {
        if (["REJECTED", "FALHA_ENVIO", "ERRO"].includes(st)) problemas++;
      }
    }
    // Conferência de aprovação na Meta (última feita / próxima programada)
    const confs = await readAllTemplateRows(() => supabase.from("meta_templates_instancia")
      .select("id,ultima_verificacao_em,proxima_verificacao_em").in("instancia_id", instanciaIds)
      .in("status", ["PENDING", "ENVIADO"])).catch(() => []);
    const ultimas = confs.map((c) => c.ultima_verificacao_em).filter(Boolean) as string[];
    const proximas = confs.map((c) => c.proxima_verificacao_em).filter(Boolean) as string[];

    setResumo({
      total: linhas.length,
      concluidos,
      pendentes,
      emVoo,
      problemas,
      numerosComPendencia: pendentesPorInst.size,
      ultimaConferencia: ultimas.length > 0 ? ultimas.sort().slice(-1)[0] : null,
      proximaConferencia: proximas.length > 0 ? proximas.sort()[0] : null,
    });

  }, [instanciaIds.join(",")]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Atualiza a cada 60s somente enquanto há pendência e a aba está visível.
  useEffect(() => {
    if (!resumo || resumo.pendentes === 0) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, 60000);
    return () => clearInterval(t);
  }, [resumo?.pendentes, carregar]);

  if (!resumo) return null;

  const pct = resumo.total > 0 ? Math.round((resumo.concluidos / resumo.total) * 100) : 0;
  const previsao = resumo.pendentes > 0 ? "conforme cota e aprovação da Meta" : resumo.emVoo > 0 ? "aguardando Meta" : resumo.problemas > 0 ? "há itens com falha" : "concluído";

  return (
    <Card className="border-blue-500/40 bg-blue-50/40">
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">Injeção de templates nas instâncias</span>
          <Badge variant="outline" className="text-[10px]">
            {resumo.concluidos} de {resumo.total} aprovados
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[11px]"
            disabled={atualizando}
            onClick={async () => {
              setAtualizando(true);
              try {
                const respostas = await Promise.all([
                  supabase.functions.invoke("meta-templates-onboarding-tick", {
                    body: { forcar: true },
                  }),
                  supabase.functions.invoke("meta-verificar-status-templates", {
                    body: { forcar: true },
                  }),
                ]);
                if (respostas.some(({ error }) => error)) throw new Error("Não foi possível conferir os modelos agora");
                toast.success("Situação dos modelos conferida");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Falha ao conferir modelos");
              }
              await carregar();
              setAtualizando(false);
            }}
          >
            <RefreshCw className={`h-3 w-3 ${atualizando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> Previsão de término: {previsao}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{pct}% aprovados</span>
          <span>Faltam: {resumo.pendentes}</span>
          <span>Aguardando resposta da Meta: {resumo.emVoo}</span>
          <span>Reprovados/falhas: {resumo.problemas}</span>
          <span>Números com pendência: {resumo.numerosComPendencia}</span>
          <span>Última conferência: {rotuloRelativo(resumo.ultimaConferencia)}</span>
          <span>Próxima conferência: {rotuloFuturo(resumo.proximaConferencia)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Aplicação 24h, inclusive domingos, um modelo por vez. Tier 250: até dois modelos por número/dia; demais tiers mantêm intervalos sequenciais.
          A aprovação na Meta é conferida a cada 30 minutos e para de ser consultada assim que sai o resultado.
        </p>

      </CardContent>
    </Card>
  );
}
