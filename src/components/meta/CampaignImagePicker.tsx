import { useEffect, useRef, useState } from 'react';
import { Upload, Undo2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CAMPAIGN_IMAGE_BUCKET, validateCampaignImageFile } from '../../../supabase/functions/_shared/meta-campaign-image';

export type CampaignImage = { path: string; url: string; templateKey: string };

export default function CampaignImagePicker({ userId, templateKey, value, onChange, onBusyChange }: {
  userId: string; templateKey: string; value: CampaignImage | null;
  onChange: (value: CampaignImage | null) => void; onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { generation.current++; }, []);

  const upload = async (file: File) => {
    const invalid = validateCampaignImageFile(file.type, file.size);
    if (invalid) { toast.error(invalid); return; }
    const current = generation.current;
    setBusy(true); onBusyChange(true);
    try {
      // Verify the actual encoding, rather than trusting the extension.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const path = `${userId}/campaign-images/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
      const storage = supabase.storage.from(CAMPAIGN_IMAGE_BUCKET);
      const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data, error: signError } = await storage.createSignedUrl(path, 3600);
      if (signError || !data?.signedUrl) throw signError || new Error('Não foi possível abrir a imagem.');
      if (generation.current === current) onChange({ path, url: data.signedUrl, templateKey });
    } catch {
      if (generation.current === current) toast.error('Não foi possível carregar a imagem. Confira o formato e seu acesso ao Envio Meta.');
    } finally {
      if (generation.current === current) { setBusy(false); onBusyChange(false); }
      if (input.current) input.current.value = '';
    }
  };

  return <div className="flex flex-wrap items-center gap-2 mb-3">
    <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Imagem desta campanha" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
    <Button type="button" size="sm" variant="outline" disabled={busy || !userId} onClick={() => input.current?.click()}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} {busy ? 'Carregando imagem…' : 'Trocar imagem'}
    </Button>
    {value && <><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onChange(null)}><Undo2 className="h-4 w-4 mr-2" />Usar imagem original</Button><span className="text-xs text-muted-foreground">Imagem desta campanha</span></>}
  </div>;
}