import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, Copy, Download } from "lucide-react";
import { exportarParaExcel } from "@/lib/exportExcel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Notificacao {
  id: string;
  cpf: string;
  nome: string | null;
  credor: string | null;
  total_debitos: number;
  telefones: string | null;
  lida_em: string | null;
  cpf_copiado_em: string | null;
  assigned_user_id: string | null;
  created_at: string;
}

function formatarCpf(cpf: string) {
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

// Retorna a data (YYYY-MM-DD) no fuso America/Sao_Paulo
function dataBRT(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${dd}`;
}

function hojeBRT(): string {
  return dataBRT(new Date().toISOString());
}

function rotuloDia(dateStr: string): string {
  const hoje = hojeBRT();
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const hojeDt = new Date(hoje + "T12:00:00Z");
  const diff = Math.round((hojeDt.getTime() - dt.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  const dow = dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const dm = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)} ${dm}`;
}

export function NotificacoesCpfBell() {
  const { user } = useAuth();
  const { isAdmin, loading: loadingRole } = useUserRole();
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});
  const [statsPorDia, setStatsPorDia] = useState<{ data: string; total: number }[]>([]);
  const [totalHoje, setTotalHoje] = useState(0);

  const [naoLidasCount, setNaoLidasCount] = useState(0);
  // Mantido em ref para não entrar nas dependências do fetch (causava
  // recarga em ciclo e reinscrição repetida do canal em tempo real).
  const nomesRef = useRef<Record<string, string>>({});

  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id) return;
    let query = supabase
      .from("consulta_cpf_notificacoes" as any)
      .select(
        "id, cpf, nome, credor, total_debitos, telefones, lida_em, cpf_copiado_em, assigned_user_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isAdmin) {
      query = query.eq("assigned_user_id", user.id);
    }

    const { data } = await query;
    const rows = ((data as any) || []) as Notificacao[];
    setNotificacoes(rows);

    if (isAdmin) {
      const ids = Array.from(
        new Set(rows.map((n) => n.assigned_user_id).filter(Boolean) as string[])
      );
      const faltantes = ids.filter((id) => !(id in nomesRef.current));
      if (faltantes.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", faltantes);
        const map: Record<string, string> = { ...nomesRef.current };
        for (const p of (profs || []) as any[]) {
          map[p.id] = p.nome || p.email || p.id.slice(0, 8);
        }
        nomesRef.current = map;
        setNomesUsuarios(map);
      }
    }
  }, [user?.id, isAdmin]);

  // Contagem leve para o badge (sem baixar registros)
  const fetchNaoLidas = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any).rpc("consulta_cpf_nao_lidas");
    setNaoLidasCount(typeof data === "number" ? data : 0);
  }, [user?.id]);

  // Estatísticas agregadas no banco (últimos 7 dias) — sem leitura em massa
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any).rpc("consulta_cpf_stats_7d");
    const rows = ((data as any) || []) as { dia: string; total: number }[];

    const contagem = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      contagem.set(dataBRT(d.toISOString()), 0);
    }
    for (const r of rows) {
      if (contagem.has(r.dia)) contagem.set(r.dia, Number(r.total) || 0);
    }

    const dias = Array.from(contagem.entries())
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => (a.data < b.data ? 1 : -1));

    setStatsPorDia(dias);
    setTotalHoje(contagem.get(hojeBRT()) || 0);
  }, [user?.id]);

  // Badge: contagem leve + canal em tempo real criado uma única vez
  useEffect(() => {
    if (!user?.id || loadingRole) return;
    fetchNaoLidas();

    const channel = supabase
      .channel(`consulta-cpf-notif-${user.id}-${isAdmin ? "admin" : "user"}`)
      .on(
        "postgres_changes",
        isAdmin
          ? { event: "*", schema: "public", table: "consulta_cpf_notificacoes" }
          : {
              event: "*",
              schema: "public",
              table: "consulta_cpf_notificacoes",
              filter: `assigned_user_id=eq.${user.id}`,
            },
        () => {
          fetchNaoLidas();
          setDirty(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, loadingRole, fetchNaoLidas]);

  // Lista e estatísticas só quando o sino é aberto (ou após novo evento)
  const [dirty, setDirty] = useState(true);
  useEffect(() => {
    if (!open || !user?.id || loadingRole || !dirty) return;
    setDirty(false);
    fetchNotificacoes(); fetchNaoLidas();
    fetchStats();
  }, [open, dirty, user?.id, loadingRole, fetchNotificacoes, fetchStats]);

  const naoLidas = naoLidasCount;

  // Não lidas de hoje (funcionário: disponíveis para atender)
  const naoLidasHoje = notificacoes.filter(
    (n) => !n.lida_em && dataBRT(n.created_at) === hojeBRT()
  ).length;


  // Média dos últimos 7 dias excluindo hoje
  const diasAnteriores = statsPorDia.filter((d) => d.data !== hojeBRT());
  const mediaDiaria =
    diasAnteriores.length > 0
      ? Math.round(
          diasAnteriores.reduce((s, d) => s + d.total, 0) / diasAnteriores.length
        )
      : 0;

  const marcarLida = async (id: string) => {
    await supabase
      .from("consulta_cpf_notificacoes" as any)
      .update({ lida_em: new Date().toISOString() })
      .eq("id", id);
    fetchNotificacoes(); fetchNaoLidas();
  };

  const marcarTodasLidas = async () => {
    if (!user?.id) return;
    let q = supabase
      .from("consulta_cpf_notificacoes" as any)
      .update({ lida_em: new Date().toISOString() })
      .is("lida_em", null);
    if (!isAdmin) q = q.eq("assigned_user_id", user.id);
    await q;
    fetchNotificacoes(); fetchNaoLidas();
  };

  const copiarCpf = async (n: Notificacao) => {
    const digits = (n.cpf || "").replace(/\D/g, "");
    try {
      await navigator.clipboard.writeText(digits);
      toast.success("CPF copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
    if (!n.cpf_copiado_em) {
      await supabase
        .from("consulta_cpf_notificacoes" as any)
        .update({ cpf_copiado_em: new Date().toISOString() })
        .eq("id", n.id);
      fetchNotificacoes(); fetchNaoLidas();
    }
  };

  const [exportando, setExportando] = useState(false);
  const [exportProgresso, setExportProgresso] = useState(0);
  const baixarExcel = async () => {
    if (!user?.id) return;
    setExportando(true);
    setExportProgresso(0);
    try {
      const PAGE = 1000;
      const rows: Notificacao[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query = supabase
          .from("consulta_cpf_notificacoes" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (!isAdmin) query = query.eq("assigned_user_id", user.id);
        const { data, error } = await query;
        if (error) throw error;
        const pagina = ((data as any) || []) as Notificacao[];
        rows.push(...pagina);
        setExportProgresso(rows.length);
        if (pagina.length < PAGE) break;
        from += PAGE;
      }
      if (rows.length === 0) {
        toast.info("Nenhuma consulta para exportar");
        return;
      }


      let nomeMap: Record<string, string> = { ...nomesUsuarios };
      if (isAdmin) {
        const ids = Array.from(
          new Set(rows.map((n) => n.assigned_user_id).filter(Boolean) as string[])
        );
        const faltantes = ids.filter((id) => !(id in nomeMap));
        if (faltantes.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, nome, email")
            .in("id", faltantes);
          for (const p of (profs || []) as any[]) {
            nomeMap[p.id] = p.nome || p.email || p.id.slice(0, 8);
          }
        }
      }

      const fmtDT = (iso: string | null) =>
        iso
          ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : "";

      const dados = rows.map((n) => ({
        data_hora: fmtDT(n.created_at),
        cpf: formatarCpf(n.cpf),
        nome: n.nome || "",
        credor: n.credor || "",
        total_debitos: n.total_debitos ?? 0,
        telefones: n.telefones || "",
        atribuido: n.assigned_user_id ? nomeMap[n.assigned_user_id] || "" : "",
        lida_em: fmtDT(n.lida_em),
        cpf_copiado_em: fmtDT(n.cpf_copiado_em),
      }));

      const hoje = new Date().toISOString().slice(0, 10);
      await exportarParaExcel(
        dados,
        [
          { chave: "data_hora", titulo: "Data/Hora" },
          { chave: "cpf", titulo: "CPF" },
          { chave: "nome", titulo: "Nome" },
          { chave: "credor", titulo: "Credor" },
          { chave: "total_debitos", titulo: "Total de débitos" },
          { chave: "telefones", titulo: "Telefone(s)" },
          { chave: "atribuido", titulo: "Atribuído a" },
          { chave: "lida_em", titulo: "Lida em" },
          { chave: "cpf_copiado_em", titulo: "CPF copiado em" },
        ],
        `consultas-cpf-portal-${hoje}`
      );
      toast.success(`${rows.length} consulta(s) exportada(s)`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar Excel");
    } finally {
      setExportando(false);
    }
  };

  const baixarQualificacoes = async () => {
    setExportando(true);
    setExportProgresso(0);
    try {
      const PAGE = 1000;
      const rows: any[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await (supabase as any)
          .from("meta_contato_qualificacao")
          .select("contato_id, qualificacao_id, user_id, created_at, meta_qualificacoes(nome), meta_whatsapp_contatos(nome, telefone, folder_id)")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const pagina = (data as any[]) || [];
        rows.push(...pagina);
        setExportProgresso(rows.length);
        if (pagina.length < PAGE) break;
        from += PAGE;
      }
      if (rows.length === 0) {
        toast.info("Nenhuma qualificação lançada ainda");
        return;
      }

      const { data: pastas } = await (supabase as any).from("meta_inbox_folders").select("id, nome");
      const pastaMap: Record<string, string> = {};
      ((pastas as any[]) || []).forEach((p) => { pastaMap[p.id] = p.nome; });

      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
      const nomeMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
        ((profs as any[]) || []).forEach((p) => { nomeMap[p.id] = p.nome || p.email || p.id.slice(0, 8); });
      }

      const fmtDT = (iso: string | null) =>
        iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

      const dados = rows.map((r) => ({
        data_hora: fmtDT(r.created_at),
        qualificacao: r.meta_qualificacoes?.nome || "",
        telefone: r.meta_whatsapp_contatos?.telefone || "",
        nome: r.meta_whatsapp_contatos?.nome || "",
        caixa: r.meta_whatsapp_contatos?.folder_id
          ? pastaMap[r.meta_whatsapp_contatos.folder_id] || ""
          : "Padrão",
        atendente: r.user_id ? nomeMap[r.user_id] || "" : "",
      }));
      dados.sort((a, b) => a.qualificacao.localeCompare(b.qualificacao));

      const hoje = new Date().toISOString().slice(0, 10);
      await exportarParaExcel(
        dados,
        [
          { chave: "qualificacao", titulo: "Qualificação" },
          { chave: "telefone", titulo: "Telefone" },
          { chave: "nome", titulo: "Nome" },
          { chave: "caixa", titulo: "Caixa de mensagens" },
          { chave: "atendente", titulo: "Qualificado por" },
          { chave: "data_hora", titulo: "Data/Hora" },
        ],
        `qualificacoes-inbox-meta-${hoje}`
      );
      toast.success(`${rows.length} qualificação(ões) exportada(s)`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar qualificações");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 relative"
          title="Notificações de consulta de CPF"
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">
            Consultas de CPF {isAdmin && <span className="text-xs text-muted-foreground font-normal">(todos)</span>}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={exportando}
                  title="Baixar relatórios em Excel"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {exportando
                    ? `Baixando...${exportProgresso ? ` ${exportProgresso.toLocaleString("pt-BR")}` : ""}`
                    : "Excel"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={baixarExcel}>
                  Consultas de CPF ao portal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={baixarQualificacoes}>
                  Qualificações lançadas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {naoLidas > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={marcarTodasLidas}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        {/* Painel de estatísticas */}
        <div className="px-3 py-2 border-b bg-muted/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 rounded-md bg-background border p-2">
              <div className="text-[10px] uppercase text-muted-foreground font-medium">
                {isAdmin ? "Hoje (todos)" : "Hoje"}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">{totalHoje}</span>
                <span className="text-[10px] text-muted-foreground">
                  {isAdmin ? "consultas" : "atribuídas"}
                </span>
              </div>
            </div>
            {!isAdmin && (
              <div className="flex-1 rounded-md bg-background border p-2">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">
                  Disponíveis
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-primary">{naoLidasHoje}</span>
                  <span className="text-[10px] text-muted-foreground">não lidas hoje</span>
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="flex-1 rounded-md bg-background border p-2">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">
                  Média 7d
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground">{mediaDiaria}</span>
                  <span className="text-[10px] text-muted-foreground">por dia</span>
                </div>
              </div>
            )}
          </div>

          {isAdmin && statsPorDia.length > 0 && (
            <div className="rounded-md bg-background border">
              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-medium border-b">
                Últimos 7 dias
              </div>
              <div className="divide-y">
                {statsPorDia.map((d) => (
                  <div
                    key={d.data}
                    className="flex items-center justify-between px-2 py-1 text-xs"
                  >
                    <span
                      className={cn(
                        "text-muted-foreground",
                        d.data === hojeBRT() && "font-semibold text-foreground"
                      )}
                    >
                      {rotuloDia(d.data)}
                    </span>
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        d.data === hojeBRT() ? "font-bold text-foreground" : "text-foreground"
                      )}
                    >
                      {d.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            notificacoes.map((n) => {
              const copiado = !!n.cpf_copiado_em;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "px-3 py-2 border-b last:border-b-0 flex gap-2 items-start transition-colors",
                    copiado
                      ? "bg-green-500/15 border-l-2 border-l-green-500"
                      : !n.lida_em && "bg-primary/5"
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          copiado ? "text-green-700 dark:text-green-400" : (!n.lida_em ? "text-foreground" : "text-muted-foreground")
                        )}
                      >
                        📋 CONSULTA NO PORTAL
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {tempoRelativo(n.created_at)}
                      </span>
                    </div>
                    <div className="text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">CPF:</span>{" "}
                        <span className="font-mono">{formatarCpf(n.cpf)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => copiarCpf(n)}
                          title="Copiar CPF"
                        >
                          {copiado ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      {n.nome && (
                        <div>
                          <span className="text-muted-foreground">Nome:</span> {n.nome}
                        </div>
                      )}
                      {n.credor && (
                        <div>
                          <span className="text-muted-foreground">Credor:</span> {n.credor}
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Débitos:</span>{" "}
                        {n.total_debitos}
                      </div>
                      {n.telefones && (
                        <div className="flex items-start gap-1 break-all">
                          <span className="text-muted-foreground">Telefone(s):</span>{" "}
                          <span className="font-mono">{n.telefones}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(String(n.telefones || ""));
                              toast.success("Telefone copiado!");
                            }}
                            title="Copiar telefone"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}

                      {isAdmin && (
                        <div>
                          <span className="text-muted-foreground">Atribuído a:</span>{" "}
                          <span className="font-medium">
                            {n.assigned_user_id
                              ? nomesUsuarios[n.assigned_user_id] || "..."
                              : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!n.lida_em && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => marcarLida(n.id)}
                      title="Marcar como lida"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
