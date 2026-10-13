import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { montarLinkWhatsappRedirect } from "@/lib/whatsappRedirectLink";

export function WhatsappLinkGenerator({ onGerar }: { onGerar: (link: string) => void }) {
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const link = montarLinkWhatsappRedirect(telefone, mensagem);

  return (
    <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
      <p className="text-xs font-medium">Gerar link para WhatsApp</p>
      <div className="space-y-1">
        <Label htmlFor="wa-gerador-tel" className="text-[11px]">WhatsApp de destino</Label>
        <Input id="wa-gerador-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)}
          placeholder="(62) 98181-0202" className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wa-gerador-msg" className="text-[11px]">Mensagem predefinida</Label>
        <Textarea id="wa-gerador-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value)}
          placeholder="Olá! Tenho interesse em saber mais informações..." className="text-xs min-h-[60px]" />
      </div>
      {telefone && !link && <p className="text-[11px] text-destructive">Informe DDD + número completo.</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-8 text-xs" disabled={!link}
          onClick={() => { if (link) { onGerar(link); toast.success("Link gerado no campo acima. Clique em Salvar link."); } }}>
          Usar no botão
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!link}
          onClick={() => link && window.open(link.replace(/^https:\/\/meusacordos\.com\.br\//, ""), "_blank", "noopener")}>
          Testar no WhatsApp
        </Button>
      </div>
    </div>
  );
}
