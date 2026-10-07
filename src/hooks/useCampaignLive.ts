import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldRefreshCampaign } from '@/lib/metaCampaignLive';

// Reference-counted per-job listeners: page and dialog share the same channel.
const listeners = new Map<string, { callbacks: Set<() => void>; dispose: () => void }>();

function listen(jobId: string, callback: () => void) {
  let entry = listeners.get(jobId);
  if (!entry) {
    const callbacks = new Set<() => void>();
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const emit = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = undefined;
        if (!shouldRefreshCampaign(document.visibilityState === 'visible', Date.now() - last, 2000)) return;
        last = Date.now();
        callbacks.forEach(fn => fn());
      }, Math.max(0, 2000 - (Date.now() - last)));
    };
    const connect = () => {
      if (channel || document.visibilityState !== 'visible') return;
      channel = supabase.channel(`campaign-live-${jobId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'envio_meta_job', filter: `id=eq.${jobId}` }, emit)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'envio_meta_job_item', filter: `job_id=eq.${jobId}` }, emit)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'envio_meta_job_resultado', filter: `job_id=eq.${jobId}` }, emit)
        .subscribe(status => { if (status === 'SUBSCRIBED') emit(); });
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible') {
        if (channel) void supabase.removeChannel(channel);
        channel = undefined;
      } else { connect(); emit(); }
    };
    // Bounded recovery and access recheck, including revocation and delivery changes.
    const timer = setInterval(emit, 15000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', visibility);
    connect();
    entry = { callbacks, dispose: () => {
      clearInterval(timer);
      if (pending) clearTimeout(pending);
      if (channel) void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', visibility);
    } };
    listeners.set(jobId, entry);
  }
  entry.callbacks.add(callback);
  return () => {
    entry.callbacks.delete(callback);
    if (!entry.callbacks.size) { entry.dispose(); listeners.delete(jobId); }
  };
}

export function useCampaignLive(ids: string[], refresh: () => void) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    if (!key) return;
    const remove = key.split(',').map(id => listen(id, () => callback.current()));
    return () => remove.forEach(fn => fn());
  }, [key]);
}