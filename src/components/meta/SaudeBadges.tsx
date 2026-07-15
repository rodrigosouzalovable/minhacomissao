import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export function SaudeBadgeStatus({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  const variant: any =
    s === "CONNECTED"
      ? "default"
      : s === "FLAGGED" || s === "RESTRICTED" || s === "DISCONNECTED"
      ? "destructive"
      : "secondary";
  const cls = s === "CONNECTED" ? "bg-green-600 hover:bg-green-600 text-white" : "";
  return <Badge variant={variant} className={`text-[10px] px-1.5 py-0 ${cls}`}>{s}</Badge>;
}

export function SaudeBadgeQuality({ quality }: { quality?: string | null }) {
  if (!quality) return null;
  const q = quality.toUpperCase();
  const cls =
    q === "GREEN"
      ? "bg-green-600 text-white"
      : q === "YELLOW"
      ? "bg-yellow-500 text-white"
      : q === "RED"
      ? "bg-red-600 text-white"
      : "";
  return <Badge className={`text-[10px] px-1.5 py-0 ${cls}`}>QUALIDADE {q}</Badge>;
}

export interface MetaHealthFields {
  saude_status?: string | null;
  saude_quality?: string | null;
  saude_tier?: string | null;
  saude_ban_info?: any;
  saude_name_status?: string | null;
  saude_checked_at?: string | null;
}

export function MetaHealthStatusRow({
  inst,
  onDetalhes,
}: {
  inst: MetaHealthFields;
  onDetalhes?: () => void;
}) {
  const hasAny =
    inst.saude_status ||
    inst.saude_quality ||
    inst.saude_tier ||
    inst.saude_ban_info ||
    (inst.saude_name_status && ["FLAGGED", "PENDING_REVIEW", "REJECTED"].includes(String(inst.saude_name_status).toUpperCase()));
  if (!hasAny) return null;
  const banMotivo =
    inst.saude_ban_info && typeof inst.saude_ban_info === "object"
      ? (inst.saude_ban_info as any)?.reason || (inst.saude_ban_info as any)?.status || "restrição aplicada"
      : String(inst.saude_ban_info || "");
  const nameSt = String(inst.saude_name_status || "").toUpperCase();
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <SaudeBadgeStatus status={inst.saude_status} />
      <SaudeBadgeQuality quality={inst.saude_quality} />
      {inst.saude_tier && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {inst.saude_tier}
        </Badge>
      )}
      {inst.saude_ban_info && (
        <Badge
          variant="destructive"
          className="text-[10px] px-1.5 py-0 flex items-center gap-1"
          title={`Motivo: ${banMotivo}`}
        >
          <AlertTriangle className="h-3 w-3" /> BANIDO
        </Badge>
      )}
      {["FLAGGED", "PENDING_REVIEW", "REJECTED"].includes(nameSt) && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/60 text-amber-600">
          Nome: {nameSt}
        </Badge>
      )}
      {onDetalhes && (
        <button
          type="button"
          className="text-[10px] text-primary underline ml-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDetalhes();
          }}
        >
          detalhes
        </button>
      )}
      {inst.saude_checked_at && (
        <span className="text-[10px] text-muted-foreground ml-1">
          verificado {new Date(inst.saude_checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
