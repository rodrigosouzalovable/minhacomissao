import { Reply, ExternalLink, Phone } from "lucide-react";

type Template = {
  id?: string;
  nome_template?: string;
  body_text?: string | null;
  variaveis?: any;
};

const DEFAULT_SAMPLE = "Rodrigo";

function renderBodyWithVars(text: string, sample: string = DEFAULT_SAMPLE) {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\{\{\s*([a-zA-Z_0-9]+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={`v-${i++}`}
        className="bg-yellow-200/70 dark:bg-yellow-500/30 px-1 rounded text-xs font-medium"
      >
        {sample}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}


export default function TemplateWhatsAppPreview({
  template,
  imageUrlOverride,
  sampleName,
}: {
  template: Template;
  imageUrlOverride?: string;
  sampleName?: string;
}) {
  const sample = (sampleName && sampleName.trim()) || DEFAULT_SAMPLE;

  const components: any[] = Array.isArray(template.variaveis?._components)
    ? template.variaveis._components
    : [];
  const header = components.find((c) => c?.type === "HEADER");
  const body = components.find((c) => c?.type === "BODY");
  const footer = components.find((c) => c?.type === "FOOTER");
  const buttonsComp = components.find((c) => c?.type === "BUTTONS");
  const buttons: any[] = Array.isArray(buttonsComp?.buttons) ? buttonsComp.buttons : [];

  const headerFormat = String(
    header?.format || template.variaveis?._header_format || ""
  ).toUpperCase();
  const headerText = header?.format === "TEXT" ? header?.text : null;
  const imageUrl = imageUrlOverride ?? template.variaveis?._header_image_url ?? "";

  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background:
          "url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg') center/200px",
        backgroundColor: "#e5ddd5",
      }}
    >
      <div className="bg-white dark:bg-zinc-100 rounded-lg shadow-md overflow-hidden max-w-[320px] mx-auto text-zinc-900">
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
                Sem imagem configurada — cadastre em "Templates HSM"
              </div>
            )}
          </div>
        )}
        {headerFormat === "TEXT" && headerText && (
          <div className="px-3 pt-2 font-bold text-sm">{renderBodyWithVars(headerText, sample)}</div>
        )}
        {(headerFormat === "VIDEO" || headerFormat === "DOCUMENT") && (
          <div className="bg-zinc-300 aspect-video flex items-center justify-center text-xs text-zinc-700">
            Header {headerFormat}
          </div>
        )}

        <div className="px-3 py-2 text-sm whitespace-pre-wrap leading-snug">
          {renderBodyWithVars(body?.text || template.body_text || "")}
        </div>

        {footer?.text && (
          <div className="px-3 pb-1 text-[11px] text-zinc-500">ⓘ {footer.text}</div>
        )}

        <div className="px-3 pb-2 text-[10px] text-zinc-400 text-right">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>

        {buttons.length > 0 && (
          <div className="border-t border-zinc-200">
            {buttons.map((b, i) => (
              <div
                key={i}
                className="w-full px-3 py-2.5 text-center text-sm text-[#00a5f4] font-medium border-t border-zinc-200 first:border-t-0 flex items-center justify-center gap-2"
              >
                {b.type === "URL" ? (
                  <ExternalLink className="h-4 w-4" />
                ) : b.type === "PHONE_NUMBER" ? (
                  <Phone className="h-4 w-4" />
                ) : (
                  <Reply className="h-4 w-4" />
                )}
                {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
