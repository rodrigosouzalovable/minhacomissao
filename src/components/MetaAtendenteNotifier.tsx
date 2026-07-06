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

  // Destrava o áudio no primeiro gesto do usuário e toca 1x um som de teste
  // (uma vez por navegador). Necessário porque browsers bloqueiam autoplay
  // até o primeiro clique/tecla.
  useEffect(() => {
    if (!user) return;
    const TEST_KEY = 'meta-atendente-som-teste-v1';
    const unlock = async () => {
      try {
        const a = new Audio(successSound);
        const jaTestou = !!localStorage.getItem(TEST_KEY);
        a.volume = jaTestou ? 0 : 0.35;
        await a.play();
        if (!jaTestou) localStorage.setItem(TEST_KEY, String(Date.now()));
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('meta-atendente-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meta_whatsapp_mensagens', filter: 'direcao=eq.entrada' },
        async (payload) => {
          const etiquetaId = etiquetaIdRef.current;
          if (!etiquetaId) return;
          const msg = payload.new as any;
          const instanciaId = msg?.instancia_id;
          const telefone = msg?.telefone;
          if (!instanciaId || !telefone) return;

          // Localiza contato
          const { data: contato } = await supabase
            .from('meta_whatsapp_contatos')
            .select('id')
            .eq('instancia_id', instanciaId)
            .eq('telefone', telefone)
            .maybeSingle();
          const contatoId = (contato as any)?.id;
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
