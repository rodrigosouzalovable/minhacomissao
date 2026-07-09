import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const OPCOES = [
  { value: "{nome}", label: "{nome} — nome completo do contato" },
  { value: "{primeiro_nome}", label: "{primeiro_nome} — apenas o primeiro nome" },
  { value: "{cpf}", label: "{cpf} — CPF ou CNPJ" },
  { value: "{atraso}", label: "{atraso} — dias em atraso" },
  { value: "{saldo}", label: "{saldo} — saldo devedor (R$)" },
  { value: "{avista}", label: "{avista} — 50% do saldo (à vista)" },
  { value: "{parcelado}", label: "{parcelado} — sugestão de parcelamento" },
];

type Template = {
  id: string;
  nome_template: string;
  body_text: string | null;
  variaveis: Record<string, any> | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: Template | null;
  onSaved?: () => void;
};

export default function EditarVariaveisTemplateDialog({ open, onOpenChange, template, onSaved }: Props) {
  const placeholders = useMemo(() => {
    if (!template?.body_text) return [] as string[];
    const set = new Set<string>();
    for (const m of template.body_text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) set.add(m[1]);
    return Array.from(set).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [template?.body_text]);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    const current = (template.variaveis || {}) as Record<string, any>;
    const init: Record<string, string> = {};
    for (const k of placeholders) {
      const v = current[k];
      init[k] = typeof v === "string" && v ? v : "{nome}";
    }
    setMapping(init);
  }, [open, template?.id, placeholders.join("|")]);

  const salvar = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const current = (template.variaveis || {}) as Record<string, any>;
      const merged: Record<string, any> = { ...current };
      // Substitui apenas as chaves de placeholders (preserva _format, _components, etc.)
      for (const k of placeholders) merged[k] = mapping[k] || "{nome}";
      const { error } = await supabase
        .from("meta_whatsapp_templates")
        .update({ variaveis: merged })
        .eq("id", template.id);
      if (error) throw error;
      toast.success("Variáveis atualizadas");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar variáveis do template</DialogTitle>
          <DialogDescription>
            Para cada placeholder do template, escolha qual variável do sistema será inserida no envio.
          </DialogDescription>
        </DialogHeader>

        {placeholders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este template não possui placeholders para mapear.</p>
        ) : (
          <div className="space-y-3">
            {placeholders.map((k) => (
              <div key={k} className="grid grid-cols-[80px_1fr] items-center gap-3">
                <Label className="font-mono text-sm">{`{{${k}}}`}</Label>
                <Select value={mapping[k] || "{nome}"} onValueChange={(v) => setMapping((prev) => ({ ...prev, [k]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPCOES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || placeholders.length === 0}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
