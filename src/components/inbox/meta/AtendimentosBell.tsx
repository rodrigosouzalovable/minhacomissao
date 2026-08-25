import { useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "semana" | "mes";

interface Linha {
  user_id: string;
  nome: string;
  atendidas: number;
  iniciadas: number;
}

/** Início do dia em BRT (UTC-3) convertido para instante absoluto */
function inicioDiaBrt(offsetDias = 0) {
  const agora = new Date();
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth();
  const d = brt.getUTCDate() - offsetDias;
  return new Date(Date.UTC(y, m, d, 3, 0, 0));
}

function inicioMesBrt() {
  const agora = new Date();
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 3, 0, 0));
}

function intervalo(periodo: Periodo) {
  const fim = new Date(Date.now() + 60 * 1000);
  if (periodo === "hoje") return { inicio: inicioDiaBrt(0), fim };
  if (periodo === "semana") return { inicio: inicioDiaBrt(6), fim };
  return { inicio: inicioMesBrt(), fim };
}

/**
 * Painel de mensuração: quantas conversas cada atendente atendeu (manual)
 * e quantas iniciou (template) no período. Visível para todos os usuários.
 */
export function AtendimentosBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("hoje");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["meta-atendimentos", periodo],
    queryFn: async () => {
      const { inicio, fim } = intervalo(periodo);
      const { data, error } = await supabase.rpc("meta_atendimentos_por_atendente" as any, {
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
      });
      if (error) throw error;
      return ((data as any) || []).map((r: any) => ({
        user_id: r.user_id,
        nome: r.nome,
        atendidas: Number(r.atendidas || 0),
        iniciadas: Number(r.iniciadas || 0),
      })) as Linha[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: hoje } = useQuery({
    queryKey: ["meta-atendimentos-badge"],
    queryFn: async () => {
      const { inicio, fim } = intervalo("hoje");
      const { data, error } = await supabase.rpc("meta_atendimentos_por_atendente" as any, {
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
      });
      if (error) throw error;
      return ((data as any) || []) as any[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const badge = useMemo(() => {
    const linhas = (hoje || []) as any[];
    return linhas.reduce((s, l) => s + Number(l.atendidas || 0) + Number(l.iniciadas || 0), 0);
  }, [hoje]);

  const totais = useMemo(
    () => ({
      atendidas: (data || []).reduce((s, l) => s + l.atendidas, 0),
      iniciadas: (data || []).reduce((s, l) => s + l.iniciadas, 0),
    }),
    [data],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Conversas por atendente">
          <BarChart3 className="h-4 w-4" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Conversas por atendente</p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>

        <div className="px-3 pt-2">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground">
          <span>Atendente</span>
          <span className="w-16 text-right">Atendidas</span>
          <span className="w-16 text-right">Iniciadas</span>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {(data || []).length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? "Carregando..." : "Nenhuma conversa no período."}
            </p>
          )}
          {(data || []).map((l) => (
            <div
              key={l.user_id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0"
            >
              <span className={cn("truncate", l.user_id === user?.id && "font-semibold")}>{l.nome}</span>
              <span className="w-16 text-right font-semibold text-emerald-600 dark:text-emerald-400">{l.atendidas}</span>
              <span className="w-16 text-right font-semibold text-sky-600 dark:text-sky-400">{l.iniciadas}</span>
            </div>
          ))}
        </div>

        {(data || []).length > 1 && (
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t bg-muted/40 px-3 py-2 text-xs font-semibold">
            <span>Total</span>
            <span className="w-16 text-right">{totais.atendidas}</span>
            <span className="w-16 text-right">{totais.iniciadas}</span>
          </div>
        )}

        <p className="border-t px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
          Atendidas = contatos que receberam mensagem manual. Iniciadas = contatos que receberam template/campanha.
        </p>
      </PopoverContent>
    </Popover>
  );
}
