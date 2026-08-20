import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, BellOff } from 'lucide-react';
import type { ChamadaRow } from '@/contexts/MetaCallContext';

interface Props {
  chamada: ChamadaRow | null;
  onAtender: (c: ChamadaRow) => void | Promise<void>;
  onRejeitar: (c: ChamadaRow) => void | Promise<void>;
  onFechar: () => void;
}

/** Toque simples gerado no próprio navegador (sem arquivo de áudio). */
function useToque(ativo: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscsRef = useRef<OscillatorNode[]>([]);

  const pararTudo = useCallback(() => {
    for (const o of oscsRef.current) {
      try { o.stop(); } catch { /* já parado */ }
      try { o.disconnect(); } catch { /* noop */ }
    }
    oscsRef.current = [];
  }, []);

  useEffect(() => {
    if (!ativo) { pararTudo(); return; }
    let cancelado = false;
    const beep = () => {
      if (cancelado) return;
      try {
        const AC = window.AudioContext ?? (window as any).webkitAudioContext;
        const ctx = ctxRef.current ?? new AC();
        ctxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 620;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.onended = () => { oscsRef.current = oscsRef.current.filter(o => o !== osc); };
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        oscsRef.current.push(osc);
      } catch { /* navegador bloqueou áudio */ }
    };
    beep();
    const t = setInterval(beep, 1600);
    return () => { cancelado = true; clearInterval(t); pararTudo(); };
  }, [ativo, pararTudo]);

  useEffect(() => () => {
    pararTudo();
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  }, [pararTudo]);
}

export function ChamadaEntrandoDialog({ chamada, onAtender, onRejeitar, onFechar }: Props) {
  const [silenciado, setSilenciado] = useState(false);
  useToque(!!chamada && !silenciado);

  // cada nova chamada volta a tocar
  useEffect(() => { if (chamada) setSilenciado(false); }, [chamada?.id]);

  return (
    <Dialog open={!!chamada} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 animate-pulse">
              <Phone className="h-4 w-4" />
            </span>
            Chamada recebida
          </DialogTitle>
          <DialogDescription>
            {chamada?.telefone ? `Cliente ${chamada.telefone} está ligando pelo WhatsApp.` : 'Chamada de voz pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => chamada && void onAtender(chamada)}>
            <Phone className="h-4 w-4 mr-1" /> Atender
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => chamada && void onRejeitar(chamada)}>
            <PhoneOff className="h-4 w-4 mr-1" /> Rejeitar
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setSilenciado(true)}
          disabled={silenciado}
        >
          <BellOff className="h-4 w-4 mr-1" /> {silenciado ? 'Toque silenciado' : 'Silenciar toque'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
