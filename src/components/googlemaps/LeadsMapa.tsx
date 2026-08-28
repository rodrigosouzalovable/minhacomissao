import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Clipboard, MapPin, MessageCircle } from "lucide-react";

export interface LeadMapa {
  id: string;
  nome: string;
  telefone: string | null;
  telefone_internacional: string | null;
  endereco: string | null;
  avaliacao: number | null;
  total_avaliacoes: number | null;
  tem_whatsapp: boolean | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  siteTipo: "sem_site" | "rede_social" | "com_site";
}

const CORES: Record<LeadMapa["siteTipo"], string> = {
  sem_site: "hsl(0 72% 51%)",
  rede_social: "hsl(38 92% 50%)",
  com_site: "hsl(215 16% 47%)",
};

export function linkGoogleMaps(l: { place_id: string | null; nome: string; endereco: string | null }) {
  if (l.place_id) return `https://www.google.com/maps/place/?q=place_id:${l.place_id}`;
  const q = encodeURIComponent(`${l.nome} ${l.endereco ?? ""}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

interface Props {
  leads: LeadMapa[];
  onCopiarMensagem: (id: string) => void;
  onAbrirWhatsApp: (id: string) => void;
}

export function LeadsMapa({ leads, onCopiarMensagem, onAbrirWhatsApp }: Props) {
  const comCoord = useMemo(
    () => leads.filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number"),
    [leads],
  );
  const semCoord = leads.length - comCoord.length;

  const centro = useMemo<[number, number]>(() => {
    if (!comCoord.length) return [-16.6799, -49.255];
    const lat = comCoord.reduce((s, l) => s + (l.latitude as number), 0) / comCoord.length;
    const lng = comCoord.reduce((s, l) => s + (l.longitude as number), 0) / comCoord.length;
    return [lat, lng];
  }, [comCoord]);

  if (!comCoord.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhum lead com coordenadas para exibir no mapa.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.sem_site }} /> Sem site
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.rede_social }} /> Só rede social
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES.com_site }} /> Tem site
        </span>
        {semCoord > 0 && <span>• {semCoord} lead(s) sem coordenadas fora do mapa</span>}
      </div>

      <div className="h-[560px] w-full overflow-hidden rounded-md border">
        <MapContainer center={centro} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {comCoord.map((l) => (
            <CircleMarker
              key={l.id}
              center={[l.latitude as number, l.longitude as number]}
              radius={8}
              pathOptions={{ color: CORES[l.siteTipo], fillColor: CORES[l.siteTipo], fillOpacity: 0.8 }}
            >
              <Popup>
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-sm">{l.nome}</p>
                  {l.avaliacao && (
                    <p>
                      ⭐ {l.avaliacao} ({l.total_avaliacoes ?? 0} avaliações)
                    </p>
                  )}
                  <p className="font-mono">{l.telefone_internacional ?? l.telefone ?? "sem telefone"}</p>
                  {l.endereco && <p>{l.endereco}</p>}
                  <div className="flex items-center gap-1 pt-1">
                    <Button size="sm" variant="outline" onClick={() => onCopiarMensagem(l.id)}>
                      <Clipboard className="h-3 w-3 mr-1" /> Mensagem
                    </Button>
                    {l.tem_whatsapp === true && (
                      <Button size="sm" variant="outline" onClick={() => onAbrirWhatsApp(l.id)}>
                        <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                    )}
                    <a href={linkGoogleMaps(l)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost">
                        <MapPin className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
