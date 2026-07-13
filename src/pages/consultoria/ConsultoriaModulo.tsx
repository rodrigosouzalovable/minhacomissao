import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoria } from "@/hooks/useConsultoria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, FileText, ExternalLink } from "lucide-react";

export default function ConsultoriaModulo() {
  const { id } = useParams();
  const moduloId = Number(id);
  const { aluno } = useConsultoria();
  const nav = useNavigate();

  const { data: modulo } = useQuery({
    queryKey: ["consultoria-modulo", moduloId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_modulos")
        .select("*")
        .eq("id", moduloId)
        .maybeSingle();
      return data;
    },
  });

  const { data: aulas = [] } = useQuery({
    queryKey: ["consultoria-aulas", moduloId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_aulas")
        .select("id, numero, titulo, ordem")
        .eq("modulo_id", moduloId)
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: progresso = [] } = useQuery({
    queryKey: ["consultoria-progresso-mod", aluno?.id, moduloId],
    queryFn: async () => {
      if (!aluno) return [];
      const ids = aulas.map((a: any) => a.id);
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("consultoria_progresso")
        .select("aula_id, status")
        .eq("aluno_id", aluno.id)
        .in("aula_id", ids);
      return data ?? [];
    },
    enabled: !!aluno && aulas.length > 0,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["consultoria-materiais-mod", moduloId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_materiais")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("ordem");
      return data ?? [];
    },
  });

  const statusOf = (aulaId: string) =>
    progresso.find((p: any) => p.aula_id === aulaId)?.status ?? "nao_iniciado";

  if (!modulo) return <div className="text-muted-foreground">Módulo não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => nav("/consultoria")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao dashboard
        </Button>
      </div>
      <header className="space-y-2">
        <div className="text-xs font-medium text-primary uppercase tracking-wide">
          Módulo {modulo.id} · {modulo.duracao}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{modulo.titulo}</h1>
        <p className="text-muted-foreground">{modulo.descricao}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aulas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {aulas.map((a: any) => {
              const s = statusOf(a.id);
              return (
                <li key={a.id}>
                  <Link
                    to={`/consultoria/aula/${moduloId}/${a.numero}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-accent transition-colors"
                  >
                    {s === "concluido" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : s === "em_andamento" ? (
                      <PlayCircle className="w-5 h-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {modulo.id}.{a.numero} — {a.titulo}
                      </div>
                    </div>
                    <Badge
                      variant={
                        s === "concluido" ? "default" : s === "em_andamento" ? "secondary" : "outline"
                      }
                    >
                      {s === "concluido"
                        ? "Concluída"
                        : s === "em_andamento"
                          ? "Em andamento"
                          : "Não iniciada"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {materiais.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materiais de apoio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {materiais.map((m: any) => (
              <MaterialItem key={m.id} m={m} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function MaterialItem({ m }: { m: any }) {
  async function baixar() {
    if (m.url_externa) {
      window.open(m.url_externa, "_blank");
      return;
    }
    if (m.storage_path) {
      const { data } = await supabase.storage
        .from("consultoria-materiais")
        .createSignedUrl(m.storage_path, 60 * 10);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    }
  }
  return (
    <button
      onClick={baixar}
      className="w-full flex items-center gap-3 p-3 rounded-md border hover:bg-accent transition-colors text-left"
    >
      <FileText className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{m.nome}</div>
        {m.descricao && <div className="text-xs text-muted-foreground">{m.descricao}</div>}
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
