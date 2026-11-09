import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CampaignImagePicker, { type CampaignImage } from "@/components/meta/CampaignImagePicker";
import TemplateWhatsAppPreview from "@/components/meta/TemplateWhatsAppPreview";

type Props = {
  userId: string;
  templateKey: string;
  template: any;
  hasImage: boolean;
  instanceImageUrl?: string;
  masterMediaPath?: string | null;
  sampleVariables?: Record<string, string>;
  value: CampaignImage | null;
  onChange: (v: CampaignImage | null) => void;
  onBusyChange: (b: boolean) => void;
};

export default function CredorTemplatePreview(p: Props) {
  const [masterUrl, setMasterUrl] = useState<string | undefined>();
  useEffect(() => {
    let ativo = true;
    setMasterUrl(undefined);
    if (!p.hasImage || p.instanceImageUrl || !p.masterMediaPath) return;
    supabase.storage.from("meta-template-media").createSignedUrl(p.masterMediaPath, 3600)
      .then(({ data }) => { if (ativo) setMasterUrl(data?.signedUrl); });
    return () => { ativo = false; };
  }, [p.hasImage, p.instanceImageUrl, p.masterMediaPath]);

  return (
    <div className="mt-2 ml-0 sm:ml-28 space-y-2 rounded-md border bg-background p-2">
      {p.hasImage && (
        <CampaignImagePicker key={p.templateKey} userId={p.userId} templateKey={p.templateKey}
          value={p.value} onChange={p.onChange} onBusyChange={p.onBusyChange} />
      )}
      <TemplateWhatsAppPreview
        template={p.template}
        sampleVariables={p.sampleVariables}
        preserveEmptyPlaceholders
        imageUrlOverride={(p.value?.templateKey === p.templateKey ? p.value.url : undefined) || p.instanceImageUrl || masterUrl}
      />
    </div>
  );
}
