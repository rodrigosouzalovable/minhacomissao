import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Loader2 } from 'lucide-react';

// Extrai valor e nome do recebedor do payload EMV (best-effort)
function lerPayload(codigo: string) {
  const valor = codigo.match(/54\d{2}(\d+\.\d{2})/)?.[1];
  const nome = codigo.match(/59(\d{2})/) ? (() => {
    const m = codigo.match(/59(\d{2})/);
    if (!m) return undefined;
    const idx = (m.index || 0) + 4;
    const len = parseInt(m[1], 10);
    return codigo.slice(idx, idx + len).trim();
  })() : undefined;
  return { valor, nome };
}

export default function PixPublico() {
  const { id } = useParams<{ id: string }>();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    document.title = 'Pagar com Pix';
    (async () => {
      if (!id) { setCarregando(false); return; }
      const { data } = await supabase.rpc('get_pix_link' as any, { p_id: id });
      const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
      setCodigo(row?.codigo || null);
      setCarregando(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!codigo) return;
    QRCode.toDataURL(codigo, { width: 480, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [codigo]);

  const info = useMemo(() => (codigo ? lerPayload(codigo) : { valor: undefined, nome: undefined }), [codigo]);

  const copiar = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = codigo;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Pagar com Pix</h1>
          <p className="text-sm text-muted-foreground">
            Copie o código abaixo ou escaneie o QR Code no app do seu banco.
          </p>
        </header>

        <Card>
          <CardContent className="p-5 space-y-4">
            {carregando ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !codigo ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                Este link de Pix não está mais disponível. Solicite um novo código ao atendente.
              </p>
            ) : (
              <>
                {(info.valor || info.nome) && (
                  <div className="text-center space-y-1">
                    {info.valor && (
                      <p className="text-3xl font-bold">
                        {Number(info.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    )}
                    {info.nome && <p className="text-sm text-muted-foreground">{info.nome}</p>}
                  </div>
                )}

                {qr && (
                  <img
                    src={qr}
                    alt="QR Code do pagamento Pix"
                    className="mx-auto w-56 h-56 rounded-lg border"
                    loading="lazy"
                  />
                )}

                <Button className="w-full h-12 text-base" onClick={copiar}>
                  {copiado ? <Check className="mr-2 h-5 w-5" /> : <Copy className="mr-2 h-5 w-5" />}
                  {copiado ? 'Código copiado!' : 'Copiar código Pix'}
                </Button>

                <div className="rounded-md bg-muted p-3">
                  <p className="text-[11px] leading-relaxed break-all font-mono text-muted-foreground">
                    {codigo}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
