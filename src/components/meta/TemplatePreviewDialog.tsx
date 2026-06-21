import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Reply, ExternalLink, Phone, Loader2, Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Template = {
  id: string;
  nome_template: string;
  body_text: string | null;
  categoria: string | null;
  idioma: string;
  status: string;
  variaveis: any;
};

interface Props {
  template: Template | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

const SAMPLE = "Rodrigo";

function renderBodyWithVars(text: string) {
  // troca {{var}} ou {{1}} por sample destacado
  const parts: (string | JSX.Element)[] = [];
  const regex = /\{\{\s*([a-zA-Z_0-9]+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={`v-${i++}`} className="bg-yellow-200/70 dark:bg-yellow-500/30 px-1 rounded text-xs font-medium">
        {SAMPLE}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function TemplatePreviewDialog({ template, open, onOpenChange, onSaved }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) setImageUrl(template.variaveis?._header_image_url || "");
  }, [template]);

  if (!template) return null;

  const components: any[] = Array.isArray(template.variaveis?._components) ? template.variaveis._components : [];
  const header = components.find((c) => c?.type === "HEADER");
  const body = components.find((c) => c?.type === "BODY");
  const footer = components.find((c) => c?.type === "FOOTER");
  const buttonsComp = components.find((c) => c?.type === "BUTTONS");
  const buttons: any[] = Array.isArray(buttonsComp?.buttons) ? buttonsComp.buttons : [];

  const headerFormat = String(header?.format || template.variaveis?._header_format || "").toUpperCase();
  const headerText = header?.format === "TEXT" ? header?.text : null;

  const salvarImagem = async () => {
    setSaving(true);
    const newVars = { ...(template.variaveis || {}), _header_image_url: imageUrl.trim() };
    const { error } = await supabase
      .from("meta_whatsapp_templates")
      .update({ variaveis: newVars })
      .eq("id", template.id);
    setSaving(false);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Imagem do header salva");
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template.nome_template}
            <Badge variant={template.status === "approved" ? "default" : "secondary"} className="text-[10px]">
              {template.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {template.categoria} · {template.idioma}
          </DialogDescription>
        </DialogHeader>

        {/* WhatsApp-like preview */}
        <div
          className="rounded-lg p-4 border"
          style={{
            background:
              "url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg') center/200px",
            backgroundColor: "#e5ddd5",
          }}
        >
          <div className="bg-white dark:bg-zinc-100 rounded-lg shadow-md overflow-hidden max-w-[320px] mx-auto text-zinc-900">
            {/* Header */}
            {headerFormat === "IMAGE" && (
              <div className="bg-zinc-200 aspect-square w-full">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="header"
                    className="w-full h-full object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 p-4 text-center">
                    Sem imagem configurada — cadastre uma URL abaixo
                  </div>
                )}
              </div>
            )}
            {headerFormat === "TEXT" && headerText && (
              <div className="px-3 pt-2 font-bold text-sm">{renderBodyWithVars(headerText)}</div>
            )}
            {(headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
              <div className="bg-zinc-300 aspect-video flex items-center justify-center text-xs text-zinc-700">
                Header {headerFormat}
              </div>
            )}

            {/* Body */}
            <div className="px-3 py-2 text-sm whitespace-pre-wrap leading-snug">
              {renderBodyWithVars(body?.text || template.body_text || "")}
            </div>

            {/* Footer */}
            {footer?.text && <div className="px-3 pb-1 text-[11px] text-zinc-500">ⓘ {footer.text}</div>}

            {/* Timestamp */}
            <div className="px-3 pb-2 text-[10px] text-zinc-400 text-right">
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>

            {/* Buttons */}
            {buttons.length > 0 && (
              <div className="border-t border-zinc-200">
                {buttons.map((b, i) => (
                  <button
                    key={i}
                    className="w-full px-3 py-2.5 text-center text-sm text-[#00a5f4] font-medium border-t border-zinc-200 first:border-t-0 flex items-center justify-center gap-2 hover:bg-zinc-50"
                  >
                    {b.type === "URL" ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : b.type === "PHONE_NUMBER" ? (
                      <Phone className="h-4 w-4" />
                    ) : (
                      <Reply className="h-4 w-4" />
                    )}
                    {b.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Edit header image */}
        {headerFormat === "IMAGE" && (
          <div className="space-y-2 mt-2">
            <Label className="text-xs">URL da imagem do header (deve ser idêntica à cadastrada na Meta)</Label>
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs font-mono"
              />
              <Button onClick={salvarImagem} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A Meta exige que a imagem enviada seja visualmente igual ao sample aprovado. URL deve ser pública e direta (sem redirect).
            </p>
          </div>
        )}

        {/* Variáveis */}
        {template.variaveis && Object.keys(template.variaveis).filter(k => !k.startsWith("_")).length > 0 && (
          <div className="text-xs">
            <Label className="text-xs">Variáveis</Label>
            <div className="flex gap-1 flex-wrap mt-1">
              {Object.keys(template.variaveis).filter(k => !k.startsWith("_")).map(k => (
                <Badge key={k} variant="outline" className="font-mono text-[10px]">{`{{${k}}}`}</Badge>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
