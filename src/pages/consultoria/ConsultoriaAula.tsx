import { useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoria } from "@/hooks/useConsultoria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  ListChecks,
} from "lucide-react";
import { MaterialItem } from "./ConsultoriaModulo";
import { AulaMarkdown, extractHeadings } from "./aulaRenderer";

const MODULO_META: Record<number, { label: string; accent: string }> = {
  1: { label: "Fundamentos", accent: "from-sky-500/20 to-primary/10" },
  2: { label: "Configuração", accent: "from-emerald-500/20 to-primary/10" },
  3: { label: "Templates", accent: "from-violet-500/20 to-primary/10" },
  4: { label: "Operação", accent: "from-amber-500/20 to-primary/10" },
  5: { label: "Troubleshooting", accent: "from-rose-500/20 to-primary/10" },
};

export default function ConsultoriaAula() {
  const { modulo, aula } = useParams();
  const moduloId = Number(modulo);
  const aulaNum = Number(aula);
  const { aluno } = useConsultoria();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: aulas = [] } = useQuery({
    queryKey: ["consultoria-aulas", moduloId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_aulas")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("ordem");
      return data ?? [];
    },
  });

  const atual = useMemo(
    () => aulas.find((a: any) => a.numero === aulaNum),
    [aulas, aulaNum],
  );
  const idx = aulas.findIndex((a: any) => a.numero === aulaNum);
  const prev = idx > 0 ? aulas[idx - 1] : null;
  const next = idx >= 0 && idx < aulas.length - 1 ? aulas[idx + 1] : null;

  const { data: prog } = useQuery({
    queryKey: ["consultoria-prog-aula", aluno?.id, atual?.id],
    queryFn: async () => {
      if (!aluno || !atual) return null;
      const { data } = await (supabase as any)
        .from("consultoria_progresso")
        .select("*")
        .eq("aluno_id", aluno.id)
        .eq("aula_id", atual.id)
        .maybeSingle();
      return data;
    },
    enabled: !!aluno && !!atual,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["consultoria-materiais-aula", atual?.id],
    queryFn: async () => {
      if (!atual) return [];
      const { data } = await (supabase as any)
        .from("consultoria_materiais")
        .select("*")
        .eq("aula_id", atual.id)
        .order("ordem");
      return data ?? [];
    },
    enabled: !!atual,
  });

  useEffect(() => {
    if (!aluno || !atual) return;
    if (prog?.status === "concluido") return;
    (async () => {
      await (supabase as any).from("consultoria_progresso").upsert(
        {
          aluno_id: aluno.id,
          aula_id: atual.id,
          status: prog?.status === "concluido" ? "concluido" : "em_andamento",
          data_inicio: prog?.data_inicio ?? new Date().toISOString(),
        },
        { onConflict: "aluno_id,aula_id" },
      );
      qc.invalidateQueries({ queryKey: ["consultoria-prog-aula"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno?.id, atual?.id]);

  async function marcarConcluido() {
    if (!aluno || !atual) return;
    const { error } = await (supabase as any)
      .from("consultoria_progresso")
      .upsert(
        {
          aluno_id: aluno.id,
          aula_id: atual.id,
          status: "concluido",
          progresso: 100,
          data_conclusao: new Date().toISOString(),
        },
        { onConflict: "aluno_id,aula_id" },
      );
    if (error) return toast.error(error.message);
    toast.success("Aula marcada como concluída!");
    qc.invalidateQueries({ queryKey: ["consultoria-prog-aula"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso-mod"] });
    if (next) nav(`/consultoria/aula/${moduloId}/${next.numero}`);
  }

  async function reabrir() {
    if (!aluno || !atual) return;
    await (supabase as any)
      .from("consultoria_progresso")
      .upsert(
        {
          aluno_id: aluno.id,
          aula_id: atual.id,
          status: "em_andamento",
          progresso: 50,
          data_conclusao: null,
        },
        { onConflict: "aluno_id,aula_id" },
      );
    qc.invalidateQueries({ queryKey: ["consultoria-prog-aula"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso-mod"] });
  }

  const headings = useMemo(
    () => (atual ? extractHeadings(atual.conteudo_md ?? "") : []),
    [atual],
  );

  const readMin = useMemo(() => {
    const words = (atual?.conteudo_md ?? "").split(/\s+/).length;
    return Math.max(3, Math.round(words / 220));
  }, [atual]);

  if (!atual) return <div className="text-muted-foreground">Aula não encontrada.</div>;

  const concluida = prog?.status === "concluido";
  const meta = MODULO_META[moduloId] ?? { label: "Aula", accent: "from-primary/20 to-primary/5" };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => nav(`/consultoria/modulo/${moduloId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao módulo
        </Button>
        <Badge variant={concluida ? "default" : "outline"} className="gap-1">
          {concluida ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <Circle className="w-3.5 h-3.5" />
          )}
          {concluida ? "Concluída" : "Em andamento"}
        </Badge>
      </div>

      {/* Hero */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${meta.accent} p-6 md:p-8`}
      >
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Módulo {moduloId} · {meta.label}</span>
            <span className="text-muted-foreground/60">/</span>
            <span>Aula {moduloId}.{atual.numero}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground leading-tight max-w-3xl">
            {atual.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1 text-xs text-foreground/80">
              <Clock className="w-3.5 h-3.5" />
              ~{readMin} min de leitura
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1 text-xs text-foreground/80">
              <ListChecks className="w-3.5 h-3.5" />
              {headings.length} seções
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1 text-xs text-foreground/80">
              Aula {idx + 1} de {aulas.length}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {atual.video_url && (
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-black">
              {atual.video_url.includes("youtube.com") ||
              atual.video_url.includes("youtu.be") ? (
                <iframe
                  src={toEmbed(atual.video_url)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={atual.video_url} controls className="w-full h-full" />
              )}
            </div>
          )}

          <Card className="border-border/60">
            <CardContent className="pt-6 md:pt-8 px-5 md:px-8 pb-8">
              <AulaMarkdown content={atual.conteudo_md ?? ""} />
            </CardContent>
          </Card>

          {materiais.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Materiais desta aula</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {materiais.map((m: any) => (
                  <MaterialItem key={m.id} m={m} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Footer nav */}
          <div className="grid gap-3 md:grid-cols-2 pt-4">
            {prev ? (
              <Link
                to={`/consultoria/aula/${moduloId}/${prev.numero}`}
                className="group rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-accent/40 transition"
              >
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Aula anterior
                </div>
                <div className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition">
                  {prev.titulo}
                </div>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                to={`/consultoria/aula/${moduloId}/${next.numero}`}
                className="group rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-accent/40 transition text-right md:text-right"
              >
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mb-1">
                  Próxima aula <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <div className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition">
                  {next.titulo}
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Nesta aula
              </div>
              {headings.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem seções</p>
              ) : (
                <nav className="space-y-1.5">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="block text-[13px] text-foreground/70 hover:text-primary transition leading-snug"
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>

            {concluida ? (
              <Button variant="outline" className="w-full" onClick={reabrir}>
                Reabrir aula
              </Button>
            ) : (
              <Button className="w-full" onClick={marcarConcluido}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Marcar como concluída
              </Button>
            )}
          </div>
        </aside>

        {/* Mobile complete button */}
        <div className="lg:hidden">
          {concluida ? (
            <Button variant="outline" className="w-full" onClick={reabrir}>
              Reabrir aula
            </Button>
          ) : (
            <Button className="w-full" onClick={marcarConcluido}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como concluída
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function toEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}
