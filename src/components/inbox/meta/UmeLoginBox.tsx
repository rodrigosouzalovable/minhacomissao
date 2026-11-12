import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export interface SessaoUmeAtendente { usuario: string; expiraEm?: string | null }

/** Login do atendente no backoffice UME. A senha vai direto para a UME e não fica salva. */
export function UmeLoginBox({ open, sessao, onSessao }: { open: boolean; sessao: SessaoUmeAtendente | null; onSessao: (s: SessaoUmeAtendente | null) => void }) {
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setVerificando(true);
    supabase.functions.invoke('ume-login', { body: { acao: 'status' } })
      .then(({ data }) => { if (ativo) onSessao((data as any)?.ativo ? { usuario: (data as any).usuario, expiraEm: (data as any).expiraEm } : null); })
      .finally(() => { if (ativo) setVerificando(false); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const entrar = async () => {
    if (!usuario.trim() || !senha) { toast.error('Informe usuário e senha da UME'); return; }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('ume-login', { body: { acao: 'entrar', usuario: usuario.trim(), senha } });
      if (error) throw error;
      if (!(data as any)?.ativo) throw new Error((data as any)?.error || 'Login recusado pela UME');
      onSessao({ usuario: (data as any).usuario, expiraEm: (data as any).expiraEm });
      setSenha('');
      toast.success('Login UME ativo');
    } catch (e) {
      toast.error(String((e as Error)?.message || e));
    } finally {
      setEnviando(false);
    }
  };

  const sair = async () => {
    setEnviando(true);
    await supabase.functions.invoke('ume-login', { body: { acao: 'sair' } }).catch(() => null);
    onSessao(null);
    setEnviando(false);
  };

  if (verificando) {
    return <div className="flex items-center gap-2 rounded border p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando login UME…</div>;
  }
  if (sessao) {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-primary/30 bg-primary/5 p-2 text-sm">
        <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Login UME ativo: <b>{sessao.usuario}</b></span>
        <Button size="sm" variant="ghost" onClick={() => void sair()} disabled={enviando}><LogOut className="mr-1 h-4 w-4" /> Sair</Button>
      </div>
    );
  }
  return (
    <form className="space-y-2 rounded border border-destructive/40 bg-destructive/5 p-2" onSubmit={(e) => { e.preventDefault(); void entrar(); }}>
      <div className="text-sm font-medium">Login UME — necessário para enviar propostas, PIX e boletos</div>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-[200px]" placeholder="Usuário UME" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        <Input className="max-w-[180px]" type="password" placeholder="Senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Button size="sm" type="submit" disabled={enviando}>{enviando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogIn className="mr-1 h-4 w-4" />} Entrar</Button>
      </div>
    </form>
  );
}
