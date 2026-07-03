import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

type Guardrail = {
  bloquear_marketing: boolean;
  notificar_admin: boolean;
};

export default function MetaGuardrailCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [g, setG] = useState<Guardrail>({ bloquear_marketing: true, notificar_admin: true });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (uid) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
        }
        const { data } = await supabase
          .from("meta_billing_guardrail")
          .select("bloquear_marketing, notificar_admin")
          .eq("id", 1)
          .maybeSingle();
        if (data) setG(data as Guardrail);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const salvar = async (patch: Partial<Guardrail>) => {
    setSaving(true);
    const novo = { ...g, ...patch };
    setG(novo);
    const { error } = await supabase
      .from("meta_billing_guardrail")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração salva");
    }
  };

  return (
    <Card className="mb-6 border-red-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          Segurança de Custos Meta
        </CardTitle>
        <CardDescription>
          Trava que impede envios de templates categoria <strong>MARKETING</strong> (custo ~US$ 0,0625 por conversa).
          Templates de <strong>UTILIDADE</strong> continuam liberados normalmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Bloquear envios de templates MARKETING</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando ativo, o sistema recusa qualquer envio de template categoria MARKETING (Envio Meta Massa, Inbox, disparos automáticos).
                </p>
              </div>
              <Switch
                checked={g.bloquear_marketing}
                onCheckedChange={(v) => salvar({ bloquear_marketing: v })}
                disabled={saving || !isAdmin}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Notificar admin no WhatsApp quando bloquear</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Envia aviso ao número administrativo sempre que uma tentativa de envio MARKETING for bloqueada.
                </p>
              </div>
              <Switch
                checked={g.notificar_admin}
                onCheckedChange={(v) => salvar({ notificar_admin: v })}
                disabled={saving || !isAdmin}
              />
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground italic">Apenas admins podem alterar essas configurações.</p>
            )}
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <p><strong>Como funciona a cobrança da Meta hoje (jul/2025+):</strong></p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Utility dentro da janela de 24h (cliente respondeu): <strong>grátis</strong></li>
                <li>Utility fora da janela: ~US$ 0,008 por mensagem</li>
                <li>Marketing: ~US$ 0,0625 por conversa iniciada (~R$ 0,35 cada)</li>
                <li>Recarga automática de US$ 25 é acionada quando o saldo do WABA zera</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
