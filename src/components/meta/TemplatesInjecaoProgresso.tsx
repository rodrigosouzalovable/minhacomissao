import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";


type Props = { instanciaIds: string[] };

type Resumo = {
  total: number;
  concluidos: number;
  pendentes: number;
  emVoo: number;
  problemas: number;
  numerosComPendencia: number;
};

const HORA_INICIO = 7;
const HORA_FIM = 20;
const MINUTOS_MEDIOS = 3.5;

// Avança "minutos" apenas dentro da janela 07h–20h BRT, pulando domingo.
function previsaoTermino(minutos: number): Date | null {
  if (minutos <= 0) return null;
  let cursor = new Date(Date.now() - 3 * 60 * 60 * 1000); // agora em BRT (via UTC deslocado)
  let restante = minutos;
  let guarda = 0;
  while (restante > 0 && guarda < 400) {
    guarda++;
    const hora = cursor.getUTCHours() + cursor.getUTCMinutes() / 60;
    const domingo = cursor.getUTCDay() === 0;
    if (domingo || hora >= HORA_FIM) {
      // pula para o próximo dia útil às 07h
      cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
      cursor.setUTCHours(HORA_INICIO, 0, 0, 0);
      continue;
    }
    if (hora < HORA_INICIO) {
      cursor.setUTCHours(HORA_INICIO, 0, 0, 0);
      continue;
    }
    const disponivel = (HORA_FIM - hora) * 60;
    const usar = Math.min(disponivel, restante);
    cursor = new Date(cursor.getTime() + usar * 60000);
    restante -= usar;
  }
  // volta de BRT para tempo real (UTC + 3h de deslocamento aplicado antes)
  return new Date(cursor.getTime() + 3 * 60 * 60 * 1000);
}

function rotuloPrevisao(d: Date | null): string {
  if (!d) return "—";
  const fmt = (dt: Date) =>
    dt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  const dia = (dt: Date) =>
    dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hojeDia = dia(new Date());
  const amanhaDia = dia(new Date(Date.now() + 86400000));
  const alvo = dia(d);
  if (alvo === hojeDia) return `hoje ~${fmt(d)}`;
  if (alvo === amanhaDia) return `amanhã ~${fmt(d)}`;
  return `${alvo} ~${fmt(d)}`;
}

export default function TemplatesInjecaoProgresso({ instanciaIds }: Props) {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const carregar = useCallback(async () => {
    if (instanciaIds.length === 0) {
      setResumo(null);
      return;
    }
    const { data } = await supabase
      .from("meta_templates_onboarding_fila")
      .select("instancia_id, status")
      .in("instancia_id", instanciaIds);
    const linhas = (data as any[]) ?? [];
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
        concluidos++;
      } else {
        if (["REJECTED", "FALHA_ENVIO", "ERRO"].includes(st)) problemas++;
        concluidos++;
      }
    }
    setResumo({
      total: linhas.length,
      concluidos,
      pendentes,
      emVoo,
      problemas,
      numerosComPendencia: pendentesPorInst.size,
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
  const numerosAtivos = Math.max(1, resumo.numerosComPendencia);
  const minutos = (resumo.pendentes / numerosAtivos) * MINUTOS_MEDIOS;
  const previsao = resumo.pendentes > 0 ? rotuloPrevisao(previsaoTermino(minutos)) : "concluído";

  return (
    <Card className="border-blue-500/40 bg-blue-50/40">
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">Injeção de templates nas instâncias</span>
          <Badge variant="outline" className="text-[10px]">
            {resumo.concluidos} de {resumo.total} modelos
          </Badge>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> Previsão de término: {previsao}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{pct}% concluído</span>
          <span>Faltam: {resumo.pendentes}</span>
          <span>Aguardando resposta da Meta: {resumo.emVoo}</span>
          <span>Reprovados/falhas: {resumo.problemas}</span>
          <span>Números com pendência: {resumo.numerosComPendencia}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          1 modelo por vez em cada número, com intervalo de 2 a 5 minutos, das 07h às 20h e nunca no domingo.
        </p>
      </CardContent>
    </Card>
  );
}
