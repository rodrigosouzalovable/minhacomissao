import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MessageSquare, Save, PlayCircle, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props { grupoId: string; grupoNome: string }

interface Config {
  grupo_id: string;
  ativo: boolean;
  msgs_min_dia: number;
  msgs_max_dia: number;
  mix_texto: number;
  mix_audio: number;
  mix_imagem: number;
  carencia_horas: number;
  max_msgs_por_instancia_dia: number;
  max_audios_por_instancia_dia: number;
  max_imagens_por_instancia_dia: number;
}

interface LogRow {
  id: string;
  enviado_em: string;
  tipo: string;
  contexto: string | null;
  conteudo_preview: string | null;
  sucesso: boolean;
  erro: string | null;
  instancia_id: string;
  inst_nome?: string;
}

export default function ConversaGrupoPanel({ grupoId, grupoNome }: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [poolCount, setPoolCount] = useState(0);
  const [statsHoje, setStatsHoje] = useState({ total: 0, texto: 0, audio: 0, imagem: 0 });

  const carregar = useCallback(async () => {
    setLoading(true);
    const hojeIso = new Date(new Date().toDateString()).toISOString();
    const [{ data: cfg }, { data: logRaw, count: totalHoje }, { count: pc }, { data: tipoHoje }] = await Promise.all([
      supabase.from("whatsapp_aquecimento_grupo_config" as any).select("*").eq("grupo_id", grupoId).maybeSingle(),
      supabase.from("whatsapp_aquecimento_grupo_conversas_log" as any)
        .select("*", { count: "exact" })
        .eq("grupo_id", grupoId)
        .order("enviado_em", { ascending: false })
        .limit(30),
      supabase.from("whatsapp_aquecimento_grupo_dialogos_pool" as any).select("id", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("whatsapp_aquecimento_grupo_conversas_log" as any).select("tipo")
        .eq("grupo_id", grupoId).eq("sucesso", true).gte("enviado_em", hojeIso),
    ]);

    if (!cfg) {
      // cria default
      const def: Config = {
        grupo_id: grupoId, ativo: true, msgs_min_dia: 15, msgs_max_dia: 25,
        mix_texto: 70, mix_audio: 20, mix_imagem: 10, carencia_horas: 24,
        max_msgs_por_instancia_dia: 6, max_audios_por_instancia_dia: 2, max_imagens_por_instancia_dia: 1,
      };
      await supabase.from("whatsapp_aquecimento_grupo_config" as any).insert(def as any);
      setConfig(def);
    } else {
      setConfig(cfg as any);
    }

    const instIds = Array.from(new Set((logRaw || []).map((l: any) => l.instancia_id)));
    const { data: insts } = await supabase.from("user_whatsapp_instances")
      .select("id, nome").in("id", instIds.length ? instIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((insts || []).map((i: any) => [i.id, i.nome]));
    setLogs(((logRaw as any) || []).map((l: any) => ({ ...l, inst_nome: nameMap.get(l.instancia_id) || l.instancia_id.slice(0, 8) })));
    setPoolCount(pc || 0);

    const stats = { total: tipoHoje?.length || 0, texto: 0, audio: 0, imagem: 0 };
    for (const t of tipoHoje || []) (stats as any)[t.tipo] = ((stats as any)[t.tipo] || 0) + 1;
    setStatsHoje(stats);

    setLoading(false);
  }, [grupoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!config) return;
    if (config.mix_texto + config.mix_audio + config.mix_imagem !== 100) {
      toast({ title: "Mix deve somar 100", variant: "destructive" }); return;
    }
    setSaving(true);
    const { error } = await supabase.from("whatsapp_aquecimento_grupo_config" as any).update(config as any).eq("grupo_id", grupoId);
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Configuração salva!" });
  };

  const executarRajada = async () => {
    if (!confirm(`Disparar uma rajada AGORA no grupo "${grupoNome}"? Vai enviar 1-4 mensagens em sequência.`)) return;
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke("aquecimento-grupo-conversa", { body: { forcar: true, grupo_id: grupoId } });
      if (error) throw error;
      const r = data?.resultados?.[0];
      toast({ title: "Rajada executada", description: r ? `${r.enviados} enviadas, ${r.erros} erros${r.pulado ? ` (${r.pulado})` : ""}` : "Sem resultado" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setExecutando(false); }
  };

  if (loading || !config) return <div className="text-xs text-muted-foreground py-3">Carregando configuração da conversa...</div>;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            Conversa automática no grupo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Ativa</Label>
            <Switch checked={config.ativo} onCheckedChange={(v) => setConfig({ ...config, ativo: v })} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Os números do grupo conversam entre si simulando uma família real (texto/áudio/imagem). Janela 07h-21h BRT, exceto domingo.
          Pool: <strong>{poolCount}</strong> diálogos. Hoje: <strong>{statsHoje.total}</strong> msgs ({statsHoje.texto}T / {statsHoje.audio}A / {statsHoje.imagem}I).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Mín msgs/dia</Label>
            <Input type="number" min={1} max={200} value={config.msgs_min_dia}
              onChange={(e) => setConfig({ ...config, msgs_min_dia: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Máx msgs/dia</Label>
            <Input type="number" min={1} max={200} value={config.msgs_max_dia}
              onChange={(e) => setConfig({ ...config, msgs_max_dia: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Carência novos membros (h)</Label>
            <Input type="number" min={0} max={168} value={config.carencia_horas}
              onChange={(e) => setConfig({ ...config, carencia_horas: Number(e.target.value) || 0 })} />
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Mix de mídia (deve somar 100)</Label>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Texto %</Label>
              <Input type="number" min={0} max={100} value={config.mix_texto}
                onChange={(e) => setConfig({ ...config, mix_texto: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Áudio %</Label>
              <Input type="number" min={0} max={100} value={config.mix_audio}
                onChange={(e) => setConfig({ ...config, mix_audio: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Imagem %</Label>
              <Input type="number" min={0} max={100} value={config.mix_imagem}
                onChange={(e) => setConfig({ ...config, mix_imagem: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Limites por número/dia (anti-ban)</Label>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Total msgs</Label>
              <Input type="number" min={1} max={50} value={config.max_msgs_por_instancia_dia}
                onChange={(e) => setConfig({ ...config, max_msgs_por_instancia_dia: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Áudios</Label>
              <Input type="number" min={0} max={20} value={config.max_audios_por_instancia_dia}
                onChange={(e) => setConfig({ ...config, max_audios_por_instancia_dia: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Imagens</Label>
              <Input type="number" min={0} max={20} value={config.max_imagens_por_instancia_dia}
                onChange={(e) => setConfig({ ...config, max_imagens_por_instancia_dia: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={salvar} disabled={saving} size="sm">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar config
          </Button>
          <Button onClick={executarRajada} disabled={executando || !config.ativo} size="sm" variant="outline">
            {executando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
            Disparar rajada agora
          </Button>
          <Button onClick={carregar} size="sm" variant="ghost">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>

        <div className="border rounded-md">
          <div className="text-xs font-semibold px-3 py-2 border-b bg-muted/40">Últimas 30 mensagens</div>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Hora</TableHead>
                  <TableHead className="text-[10px]">Quem</TableHead>
                  <TableHead className="text-[10px]">Tipo</TableHead>
                  <TableHead className="text-[10px]">Cena</TableHead>
                  <TableHead className="text-[10px]">Conteúdo</TableHead>
                  <TableHead className="text-[10px]">OK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[10px] whitespace-nowrap">{format(new Date(l.enviado_em), "dd/MM HH:mm")}</TableCell>
                    <TableCell className="text-[10px] truncate max-w-[120px]" title={l.inst_nome}>{l.inst_nome}</TableCell>
                    <TableCell className="text-[10px]">
                      <Badge variant="outline" className="text-[9px]">{l.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] truncate max-w-[100px]">{l.contexto}</TableCell>
                    <TableCell className="text-[10px] truncate max-w-[200px]" title={l.conteudo_preview || ""}>{l.conteudo_preview}</TableCell>
                    <TableCell className="text-[10px]">
                      {l.sucesso ? <Badge variant="default" className="text-[9px]">OK</Badge> : <Badge variant="destructive" className="text-[9px]" title={l.erro || ""}>erro</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-xs">Nenhuma mensagem ainda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
