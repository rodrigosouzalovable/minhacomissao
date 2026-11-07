import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const EVT = 'meta-atendente-som-change';
const chave = (uid?: string) => `meta-atendente-som-ativo:${uid ?? 'anon'}`;

export function somConversasAtivo(uid?: string) {
  try { return localStorage.getItem(chave(uid)) !== '0'; } catch { return true; }
}

export function SomConversasToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    const sync = () => setAtivo(somConversasAtivo(user?.id));
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, [user?.id]);

  if (!user) return null;
  const alternar = () => {
    const novo = !ativo;
    try { localStorage.setItem(chave(user.id), novo ? '1' : '0'); } catch {}
    window.dispatchEvent(new Event(EVT));
    toast(novo ? 'Som das conversas ativado' : 'Som das conversas desativado');
  };

  return (
    <Button variant="ghost" size="icon" onClick={alternar} className={className}
      aria-label={ativo ? 'Desativar som das conversas' : 'Ativar som das conversas'}
      title={ativo ? 'Som ligado — clique para desativar' : 'Som desligado — clique para ativar'}>
      {ativo ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
    </Button>
  );
}
