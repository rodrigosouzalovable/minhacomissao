import { useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
} from "lucide-react";
import { MaterialItem } from "./ConsultoriaModulo";

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
    [aulas, aulaNum]
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

  // Start progress on view
  useEffect(() => {
    if (!aluno || !atual) return;
    if (prog?.status === "concluido") return;
    (async () => {
      await (supabase as any)
        .from("consultoria_progresso")
        .upsert(
          {
            aluno_id: aluno.id,
            aula_id: atual.id,
            status: prog?.status === "concluido" ? "concluido" : "em_andamento",
            data_inicio: prog?.data_inicio ?? new Date().toISOString(),
          },
          { onConflict: "aluno_id,aula_id" }
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
        { onConflict: "aluno_id,aula_id" }
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
        { onConflict: "aluno_id,aula_id" }
      );
    qc.invalidateQueries({ queryKey: ["consultoria-prog-aula"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso"] });
    qc.invalidateQueries({ queryKey: ["consultoria-progresso-mod"] });
  }

  if (!atual) return <div className="text-muted-foreground">Aula não encontrada.</div>;

  const concluida = prog?.status === "concluido";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => nav(`/consultoria/modulo/${moduloId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao módulo
        </Button>
        <Badge variant={concluida ? "default" : "outline"} className="gap-1">
          {concluida ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          {concluida ? "Concluída" : "Em andamento"}
        </Badge>
      </div>

      <header className="space-y-2">
        <div className="text-xs font-medium text-primary uppercase tracking-wide">
          Aula {moduloId}.{atual.numero}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{atual.titulo}</h1>
      </header>

      {atual.video_url && (
        <div className="aspect-video w-full rounded-xl overflow-hidden border">
          {atual.video_url.includes("youtube.com") || atual.video_url.includes("youtu.be") ? (
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

      <Card>
        <CardContent className="pt-6">
          <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:tracking-tight prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{atual.conteudo_md}</ReactMarkdown>
          </article>
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

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" disabled={!prev} asChild={!!prev}>
          {prev ? (
            <Link to={`/consultoria/aula/${moduloId}/${prev.numero}`}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
            </span>
          )}
        </Button>

        {concluida ? (
          <Button variant="outline" onClick={reabrir}>
            Reabrir aula
          </Button>
        ) : (
          <Button onClick={marcarConcluido}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar como concluída
          </Button>
        )}

        <Button variant="outline" disabled={!next} asChild={!!next}>
          {next ? (
            <Link to={`/consultoria/aula/${moduloId}/${next.numero}`}>
              Próxima <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          ) : (
            <span>
              Próxima <ChevronRight className="w-4 h-4 ml-2" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function toEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}
