import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, BellOff, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const [nome, setNome] = useState<string | null>(null);
  const navigate = useNavigate();
  useToque(!!chamada && !silenciado);

  // cada nova chamada volta a tocar
  useEffect(() => { if (chamada) setSilenciado(false); }, [chamada?.id]);

  // busca o nome do cliente para o atendente saber quem está ligando
  useEffect(() => {
    setNome(null);
    if (!chamada) return;
    let vivo = true;
    void (async () => {
      const tel = String(chamada.telefone || '').replace(/\D/g, '');
      let q = supabase.from('meta_whatsapp_contatos').select('nome').limit(1);
      q = chamada.contato_id
        ? q.eq('id', chamada.contato_id)
        : q.eq('instancia_id', chamada.instancia_id).like('telefone', `%${tel.slice(-8)}`);
      const { data } = await q.maybeSingle();
      if (vivo && data?.nome) setNome(data.nome);
    })();
    return () => { vivo = false; };
  }, [chamada?.id]);

  const abrirConversa = () => {
    if (!chamada) return;
    const tel = String(chamada.telefone || '').replace(/\D/g, '');
    navigate(
      `/admin/inbox-meta?contato=${chamada.contato_id ?? ''}&telefone=${tel}&instancia=${chamada.instancia_id}`,
    );
  };

  return (
    <Dialog open={!!chamada} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-xs z-[200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 animate-pulse">
              <Phone className="h-4 w-4" />
            </span>
            Chamada recebida
          </DialogTitle>
          <DialogDescription>
            {chamada?.telefone
              ? `${nome ? `${nome} — ` : ''}${chamada.telefone} está ligando pelo WhatsApp.`
              : 'Chamada de voz pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => chamada && void onAtender(chamada)}>
            <Phone className="h-4 w-4 mr-1" /> Atender
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => { setSilenciado(true); if (chamada) void onRejeitar(chamada); }}
          >
            <PhoneOff className="h-4 w-4 mr-1" /> Rejeitar
          </Button>
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={abrirConversa}>
          <MessageSquare className="h-4 w-4 mr-1" /> Abrir conversa
        </Button>

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
