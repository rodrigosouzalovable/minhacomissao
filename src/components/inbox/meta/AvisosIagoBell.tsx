import { useCallback, useEffect, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface Aviso {
  id: string;
  mensagem: string;
  enviado_em: string;
}

const LIDO_KEY = "avisos-iago-lido-em";

function tempoRelativo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/**
 * Avisos internos do IAGO quando ele escala uma negociação para um humano.
 * Não depende da entrega no WhatsApp. Carrega ao abrir (sem polling).
 */
export function AvisosIagoBell() {
  const { isAdmin } = useUserRole() as any;
  const [open, setOpen] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(false);
  const [lidoEm, setLidoEm] = useState<number>(() => Number(localStorage.getItem(LIDO_KEY) || 0));

  const podeVer = !!isAdmin;

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    setLoading(true);
    const { data } = await supabase
      .from("admin_notificacoes_log")
      .select("id, mensagem, enviado_em")
      .eq("tipo", "iago_humano_painel")
      .order("enviado_em", { ascending: false })
      .limit(50);
    setAvisos((data as any) || []);
    setLoading(false);
  }, [podeVer]);

  useEffect(() => {
    if (podeVer) carregar();
  }, [podeVer, carregar]);

  if (!podeVer) return null;

  const naoLidos = avisos.filter((a) => new Date(a.enviado_em).getTime() > lidoEm).length;

  const marcarLido = () => {
    const agora = Date.now();
    localStorage.setItem(LIDO_KEY, String(agora));
    setLidoEm(agora);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          carregar();
          marcarLido();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Negociações do IAGO para humano">
          <BellRing className={cn("h-4 w-4", naoLidos > 0 && "text-amber-500")} />
          {naoLidos > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {naoLidos > 99 ? "99+" : naoLidos}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Negociações do IAGO</p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregar} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {avisos.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {loading ? "Carregando..." : "Nenhum aviso ainda."}
            </p>
          )}
          {avisos.map((a) => (
            <div key={a.id} className="border-b px-3 py-2 last:border-b-0">
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                {a.mensagem.replace(/\*/g, "")}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">{tempoRelativo(a.enviado_em)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
