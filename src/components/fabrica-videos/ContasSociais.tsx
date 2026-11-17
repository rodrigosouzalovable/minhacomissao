import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, CheckCircle2, Circle, Link2, Unlink } from "lucide-react";

type Conta = {
  rede: string; handle: string; perfil_url: string | null; status: string; nome_exibicao: string | null;
  avatar_url: string | null; pode_publicar: boolean; erro: string | null; verificado_em: string | null;
};

const INFO: Record<string, { nome: string; passos: string[]; conexao: string }> = {
  tiktok: {
    nome: "TikTok",
    conexao: "Conexão oficial pronta: peça no chat \"conectar TikTok\" e faça login na conta @topviralfindsusa na janela do TikTok.",
    passos: ["Entrar na conta @topviralfindsusa", "Autorizar leitura do perfil e publicação de vídeos", "Clicar em \"Verificar conexões\" aqui"],
  },
  youtube: {
    nome: "YouTube Shorts",
    conexao: "Exige autorização Google do canal (login oficial). Peça no chat \"conectar YouTube\" e eu abro o passo a passo.",
    passos: ["Canal @topviralfindsusa criado e verificado por telefone", "Criar projeto no Google Cloud e ativar a YouTube Data API v3", "Autorizar o canal na janela de login do Google"],
  },
  instagram: {
    nome: "Instagram Reels",
    conexao: "Exige conta Profissional (Criador ou Empresa) e app da Meta. Peça no chat \"conectar Instagram\" quando estiver pronto.",
    passos: ["Mudar @topviralfindsusa para conta Profissional (Criador)", "Vincular a uma Página do Facebook", "Autorizar publicação de conteúdo no app da Meta"],
  },
};

const STATUS: Record<string, { l: string; v: "default" | "secondary" | "destructive" | "outline" }> = {
  conectado: { l: "Conectado", v: "default" },
  configurado: { l: "Credencial salva", v: "secondary" },
  erro: { l: "Erro na conexão", v: "destructive" },
  desconectado: { l: "Não conectado", v: "outline" },
};

export function ContasSociais() {
  const qc = useQueryClient();
  const [verificando, setVerificando] = useState(false);
  const contas = useQuery({
    queryKey: ["video_contas_sociais"], staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("video_contas_sociais").select("*");
      if (error) throw error;
      const ordem = ["tiktok", "youtube", "instagram"];
      return ((data || []) as Conta[]).sort((a, b) => ordem.indexOf(a.rede) - ordem.indexOf(b.rede));
    },
  });

  async function desconectar(rede: string) {
    if (!confirm("Desconectar esta conta da Fábrica de Vídeos?")) return;
    const { error } = await supabase.from("video_contas_sociais").update({
      status: "desconectado", nome_exibicao: null, avatar_url: null, pode_publicar: false, erro: null, updated_at: new Date().toISOString(),
    }).eq("rede", rede);
    if (error) return toast.error("Falha ao desconectar");
    toast.success("Conta desconectada");
    qc.invalidateQueries({ queryKey: ["video_contas_sociais"] });
  }

  function conectar(rede: string) {
    const nome = INFO[rede]?.nome || rede;
    const url: Record<string, string> = {
      tiktok: "https://www.tiktok.com/logout",
      youtube: "https://accounts.google.com/",
      instagram: "https://www.instagram.com/accounts/login/",
    };
    window.open(url[rede], "_blank", "noopener");
    toast.info(`Entre com @topviralfindsusa no ${nome} na aba aberta e depois peça no chat: "conectar ${nome}". A autorização oficial abre em seguida.`, { duration: 12000 });
  }

  async function verificar() {
    setVerificando(true);
    try {
      const { data, error } = await supabase.functions.invoke("video-social-status", { body: {} });
      if (error) {
        const det = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        throw new Error(det);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Conexões verificadas");
      qc.invalidateQueries({ queryKey: ["video_contas_sociais"] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao verificar conexões");
    } finally { setVerificando(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Contas conectadas — Top Viral Finds USA</CardTitle>
            <CardDescription>As conexões usam o login oficial de cada rede. Senhas nunca são digitadas nem guardadas no sistema.</CardDescription>
          </div>
          <Button onClick={verificar} disabled={verificando}>
            {verificando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Verificar conexões
          </Button>
        </CardHeader>
      </Card>

      {contas.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {contas.error && <p className="text-sm text-destructive">Não foi possível carregar as contas.</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {contas.data?.map((c) => {
          const info = INFO[c.rede];
          const st = STATUS[c.status] || STATUS.desconectado;
          const ligado = c.status === "conectado" || c.status === "configurado";
          return (
            <Card key={c.rede} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{info?.nome || c.rede}</CardTitle>
                  <Badge variant={st.v}>{st.l}</Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  {c.avatar_url && <img src={c.avatar_url} alt="" className="h-6 w-6 rounded-full" />}
                  <span>@{c.handle}{c.nome_exibicao ? ` · ${c.nome_exibicao}` : ""}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {c.pode_publicar ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span>{c.pode_publicar ? "Publicação automática liberada" : "Publicação automática ainda não liberada"}</span>
                </div>
                {!ligado && info && (
                  <>
                    <p className="text-muted-foreground">{info.conexao}</p>
                    <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                      {info.passos.map((p) => <li key={p}>{p}</li>)}
                    </ol>
                  </>
                )}
                {c.erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{c.erro}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button size="sm" onClick={() => conectar(c.rede)}>
                    <Link2 className="mr-1 h-4 w-4" />{ligado || c.status === "erro" ? "Trocar conta" : "Conectar"}
                  </Button>
                  {(ligado || c.status === "erro") && (
                    <Button size="sm" variant="outline" onClick={() => desconectar(c.rede)}>
                      <Unlink className="mr-1 h-4 w-4" />Desconectar
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{c.verificado_em ? `Verificado em ${new Date(c.verificado_em).toLocaleString("pt-BR")}` : "Nunca verificado"}</span>
                  {c.perfil_url && (
                    <a href={c.perfil_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
                      Abrir perfil <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
