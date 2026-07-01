import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import successSound from '@/assets/success-sound.mp3';

/**
 * Headless: para cada mensagem RECEBIDA no Inbox Meta, se o contato estiver
 * etiquetado como "Atendente: <nome do usuario logado>", toca um som suave.
 * Roda globalmente (montado no AppLayout).
 */
export function MetaAtendenteNotifier() {
  const { user } = useAuth();
  const etiquetaIdRef = useRef<string | null>(null);
  const lastPlayRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    (async () => {
      // 1. Nome do usuario logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();
      const nome = (profile as any)?.nome?.trim();
      if (!nome || cancelado) return;

      // 2. Etiqueta correspondente
      const { data: etiqs } = await supabase
        .from('meta_whatsapp_etiquetas')
        .select('id, nome')
        .ilike('nome', `Atendente: ${nome}%`);
      const match = (etiqs ?? []).find((e: any) =>
        (e.nome || '').toLowerCase() === `atendente: ${nome}`.toLowerCase()
      );
      if (!match || cancelado) return;
      etiquetaIdRef.current = (match as any).id;
    })();

    return () => { cancelado = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('meta-atendente-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meta_whatsapp_mensagens', filter: 'direcao=eq.recebida' },
        async (payload) => {
          const etiquetaId = etiquetaIdRef.current;
          if (!etiquetaId) return;
          const msg = payload.new as any;
          const contatoId = msg?.contato_id;
          if (!contatoId) return;

          // Debounce 2s por contato
          const now = Date.now();
          if ((lastPlayRef.current[contatoId] ?? 0) > now - 2000) return;

          const { data: rel } = await supabase
            .from('meta_whatsapp_contato_etiquetas')
            .select('etiqueta_id')
            .eq('contato_id', contatoId)
            .eq('etiqueta_id', etiquetaId)
            .maybeSingle();
          if (!rel) return;

          lastPlayRef.current[contatoId] = now;
          try {
            const audio = new Audio(successSound);
            audio.volume = 0.35;
            await audio.play();
          } catch {}
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return null;
}
