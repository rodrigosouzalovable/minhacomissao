import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Notificacao {
  id: string;
  cpf: string;
  nome: string | null;
  credor: string | null;
  total_debitos: number;
  telefones: string | null;
  lida_em: string | null;
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

export function NotificacoesCpfBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("consulta_cpf_notificacoes" as any)
      .select("*")
      .eq("assigned_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotificacoes((data as any) || []);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotificacoes();

    const channel = supabase
      .channel(`consulta-cpf-notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consulta_cpf_notificacoes",
          filter: `assigned_user_id=eq.${user.id}`,
        },
        () => fetchNotificacoes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotificacoes]);

  const naoLidas = notificacoes.filter((n) => !n.lida_em).length;

  const marcarLida = async (id: string) => {
    await supabase
      .from("consulta_cpf_notificacoes" as any)
      .update({ lida_em: new Date().toISOString() })
      .eq("id", id);
    fetchNotificacoes();
  };

  const marcarTodasLidas = async () => {
    if (!user?.id) return;
    await supabase
      .from("consulta_cpf_notificacoes" as any)
      .update({ lida_em: new Date().toISOString() })
      .eq("assigned_user_id", user.id)
      .is("lida_em", null);
    fetchNotificacoes();
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
          <div className="text-sm font-semibold">Consultas de CPF</div>
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
        <div className="max-h-[420px] overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação por enquanto.
            </div>
          ) : (
            notificacoes.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-3 py-2 border-b last:border-b-0 flex gap-2 items-start",
                  !n.lida_em && "bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        !n.lida_em && "text-foreground",
                        n.lida_em && "text-muted-foreground"
                      )}
                    >
                      📋 CONSULTA NO PORTAL
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {tempoRelativo(n.created_at)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <div>
                      <span className="text-muted-foreground">CPF:</span>{" "}
                      <span className="font-mono">{formatarCpf(n.cpf)}</span>
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
                      <div className="break-all">
                        <span className="text-muted-foreground">Telefone(s):</span>{" "}
                        {n.telefones}
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
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
