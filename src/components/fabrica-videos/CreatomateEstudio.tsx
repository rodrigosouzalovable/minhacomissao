import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Wand2, Download, KeyRound } from "lucide-react";

type Render = { id: string; status: string; url?: string; erro?: string; criado: string };
const LS = "creatomate_renders";

export function CreatomateEstudio() {
  const [links, setLinks] = useState("");
  const [gancho, setGancho] = useState("");
  const [narracao, setNarracao] = useState("");
  const [voz, setVoz] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [chave, setChave] = useState("");
  const [salvandoChave, setSalvandoChave] = useState(false);
  const [statusChave, setStatusChave] = useState<null | { configurada: boolean; valida: boolean }>(null);

  const verificarChave = async () => {
    const { data } = await supabase.functions.invoke("creatomate-render", { body: { acao: "status_chave" } });
    if (data) setStatusChave(data);
  };
  useEffect(() => { verificarChave(); }, []);

  const salvarChave = async () => {
    if (!chave.trim()) return toast.error("Cole a chave da Creatomate");
    setSalvandoChave(true);
    const { data, error } = await supabase.functions.invoke("creatomate-render", { body: { acao: "salvar_chave", chave: chave.trim() } });
    setSalvandoChave(false);
    if (error || data?.error) return toast.error(data?.error || "Não foi possível salvar a chave");
    setChave("");
    toast.success("Chave salva e validada");
    verificarChave();
  };
  const [renders, setRenders] = useState<Render[]>(() => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } });

  useEffect(() => { localStorage.setItem(LS, JSON.stringify(renders.slice(0, 30))); }, [renders]);

  // Consulta status só enquanto há renderização em andamento e a aba está visível
  useEffect(() => {
    const pend = renders.filter((r) => !["succeeded", "failed"].includes(r.status));
    if (!pend.length) return;
    const t = setTimeout(async () => {
      if (document.visibilityState !== "visible") return setRenders((x) => [...x]);
      for (const p of pend) {
        const { data } = await supabase.functions.invoke("creatomate-render", { body: { acao: "status", id: p.id } });
        if (data?.status) setRenders((x) => x.map((r) => (r.id === p.id ? { ...r, ...data } : r)));
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [renders]);

  const criar = async () => {
    const lista = links.split(/\s+/).filter(Boolean);
    if (!lista.length) return toast.error("Cole ao menos um link de vídeo");
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("creatomate-render", {
      body: { links: lista, gancho, narracao, voz: voz || undefined, template_id: templateId || undefined },
    });
    setEnviando(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* corpo ilegível */ }
      return toast.error(msg || "Falha ao criar vídeo. Verifique a chave da Creatomate.");
    }
    setRenders((x) => [{ ...data, criado: new Date().toISOString() }, ...x]);
    toast.success("Vídeo enviado para renderização");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Chave da Creatomate</CardTitle>
          <CardDescription>
            Cole aqui a chave (Creatomate → Project Settings → API Key). Ela fica guardada com segurança e não aparece mais na tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            Situação:{" "}
            {statusChave === null ? <Badge variant="secondary">verificando…</Badge>
              : statusChave.valida ? <Badge>Conectada</Badge>
              : statusChave.configurada ? <Badge variant="destructive">Chave recusada</Badge>
              : <Badge variant="outline">Não configurada</Badge>}
          </div>
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder="Cole a chave aqui" />
            <Button onClick={salvarChave} disabled={salvandoChave}>
              {salvandoChave && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar chave
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Criar vídeo com Creatomate</CardTitle>
          <CardDescription>Vídeo vertical 9:16 com legenda automática animada e voz de narração.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium">Links dos vídeos (um por linha: TikTok ou .mp4)</label>
            <Textarea rows={4} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://www.tiktok.com/@perfil/video/..." />
          </div>
          <div>
            <label className="text-sm font-medium">Frase de impacto (primeiros 3 segundos)</label>
            <Input value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="This $15 gadget changed my desk forever" />
          </div>
          <div>
            <label className="text-sm font-medium">Texto da narração (vira voz + legenda). Vazio = legenda do áudio original</label>
            <Textarea rows={4} value={narracao} onChange={(e) => setNarracao(e.target.value)} />
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Opções avançadas</summary>
            <div className="space-y-2 mt-2">
              <Input value={voz} onChange={(e) => setVoz(e.target.value)} placeholder="Voz (padrão: elevenlabs model_id=eleven_multilingual_v2 voice_id=...)" />
              <Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Template ID da Creatomate (opcional)" />
            </div>
          </details>
          <Button onClick={criar} disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />} Criar vídeo
          </Button>
        </CardContent>
      </Card>

      {renders.map((r) => (
        <Card key={r.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{new Date(r.criado).toLocaleString("pt-BR")}</span>
              <Badge variant={r.status === "succeeded" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                {r.status === "succeeded" ? "Pronto" : r.status === "failed" ? "Falhou" : "Renderizando..."}
              </Badge>
            </div>
            {r.erro && <p className="text-sm text-destructive">{r.erro}</p>}
            {r.status === "succeeded" && r.url && (
              <>
                <video src={r.url} controls className="w-full max-w-xs rounded-md" />
                <Button asChild variant="outline" size="sm"><a href={r.url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" /> Baixar</a></Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
