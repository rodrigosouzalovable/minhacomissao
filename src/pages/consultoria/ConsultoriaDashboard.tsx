import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoria } from "@/hooks/useConsultoria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronRight, PlayCircle, CheckCircle2, Circle } from "lucide-react";

type Modulo = { id: number; titulo: string; descricao: string; duracao: string; ordem: number };
type Aula = { id: string; modulo_id: number; numero: number; titulo: string; ordem: number };
type Prog = { aula_id: string; status: "nao_iniciado" | "em_andamento" | "concluido" };

export default function ConsultoriaDashboard() {
  const { aluno, isAdmin } = useConsultoria();
  const nav = useNavigate();

  const { data: modulos = [] } = useQuery({
    queryKey: ["consultoria-modulos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_modulos")
        .select("*")
        .order("ordem");
      return (data ?? []) as Modulo[];
    },
  });

  const { data: aulas = [] } = useQuery({
    queryKey: ["consultoria-aulas-all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_aulas")
        .select("id, modulo_id, numero, titulo, ordem")
        .order("modulo_id")
        .order("ordem");
      return (data ?? []) as Aula[];
    },
  });

  const { data: progresso = [] } = useQuery({
    queryKey: ["consultoria-progresso", aluno?.id],
    queryFn: async () => {
      if (!aluno) return [];
      const { data } = await (supabase as any)
        .from("consultoria_progresso")
        .select("aula_id, status")
        .eq("aluno_id", aluno.id);
      return (data ?? []) as Prog[];
    },
    enabled: !!aluno,
  });

  const progMap = useMemo(() => {
    const m = new Map<string, Prog["status"]>();
    progresso.forEach((p) => m.set(p.aula_id, p.status));
    return m;
  }, [progresso]);

  const totais = useMemo(() => {
    const porModulo = new Map<number, { total: number; concluidas: number; em: number }>();
    aulas.forEach((a) => {
      const cur = porModulo.get(a.modulo_id) ?? { total: 0, concluidas: 0, em: 0 };
      cur.total += 1;
      const s = progMap.get(a.id);
      if (s === "concluido") cur.concluidas += 1;
      if (s === "em_andamento") cur.em += 1;
      porModulo.set(a.modulo_id, cur);
    });
    let total = 0;
    let concl = 0;
    porModulo.forEach((v) => {
      total += v.total;
      concl += v.concluidas;
    });
    return { porModulo, total, concl, pct: total ? Math.round((concl / total) * 100) : 0 };
  }, [aulas, progMap]);

  function continuar() {
    const emAndamento = aulas.find((a) => progMap.get(a.id) === "em_andamento");
    const proxima =
      emAndamento ?? aulas.find((a) => (progMap.get(a.id) ?? "nao_iniciado") !== "concluido");
    if (proxima) nav(`/consultoria/aula/${proxima.modulo_id}/${proxima.numero}`);
    else if (aulas[0]) nav(`/consultoria/aula/${aulas[0].modulo_id}/${aulas[0].numero}`);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Olá, {aluno?.nome?.split(" ")[0] ?? "Administrador"} 👋
        </h1>
        <p className="text-muted-foreground">
          {isAdmin && !aluno
            ? "Você tem acesso administrativo à consultoria."
            : "Continue de onde parou e evolua no curso."}
        </p>
      </header>

      {aluno && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Seu progresso geral</CardTitle>
              <span className="text-2xl font-bold text-primary">{totais.pct}%</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={totais.pct} className="h-3" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {totais.concl} de {totais.total} aulas concluídas
              </span>
              <Button size="sm" onClick={continuar}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Continuar onde parei
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {modulos.map((m) => {
          const t = totais.porModulo.get(m.id) ?? { total: 0, concluidas: 0, em: 0 };
          const pct = t.total ? Math.round((t.concluidas / t.total) * 100) : 0;
          return (
            <Card
              key={m.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => nav(`/consultoria/modulo/${m.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-medium text-primary uppercase tracking-wide">
                      Módulo {m.id} · {m.duracao}
                    </div>
                    <CardTitle className="text-lg leading-tight">{m.titulo}</CardTitle>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
                <Progress value={pct} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {t.concluidas === t.total && t.total > 0 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                    {t.concluidas}/{t.total} aulas
                  </span>
                  <span className="font-medium">{pct}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
