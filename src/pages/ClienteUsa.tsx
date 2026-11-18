import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Circle, QrCode, Bot, Send, MessageSquare, Clock } from 'lucide-react';

type Lang = 'en' | 'es' | 'pt';
const T = {
  en: { title: 'Your AI WhatsApp Assistant', trial: (d: string) => `Free trial — ${d} left`, expired: 'Your trial has ended', expiredTxt: 'Talk to us to keep your assistant running.', contact: 'Contact us', steps: ['Connect WhatsApp', 'Configure the AI', 'Test it'], wa: 'Connect your WhatsApp', connect: 'Connect WhatsApp', scan: 'Open WhatsApp on your phone › Linked devices › Link a device, and scan this code.', connected: 'Connected', disconnect: 'Disconnect', cfg: 'How should the AI answer your customers?', cfgHelp: 'Describe your business, services, prices, hours, tone and rules. Write in English, Spanish or Portuguese — the AI understands all of them.', templates: 'Start from a template', lang: 'Reply language', auto: 'Same as the customer', aiOn: 'AI answers automatically', save: 'Save', saved: 'Saved', test: 'Test your AI', testPh: 'Write as if you were a customer…', used: (u: number, l: number) => `${u} of ${l} AI replies used in the trial`, inbox: 'Open conversations', takeover: 'Tip: turn the AI off any time to answer customers yourself.' },
  es: { title: 'Tu asistente de WhatsApp con IA', trial: (d: string) => `Prueba gratis — quedan ${d}`, expired: 'Tu prueba terminó', expiredTxt: 'Contáctanos para mantener tu asistente activo.', contact: 'Contáctanos', steps: ['Conectar WhatsApp', 'Configurar la IA', 'Probar'], wa: 'Conecta tu WhatsApp', connect: 'Conectar WhatsApp', scan: 'Abre WhatsApp › Dispositivos vinculados › Vincular dispositivo y escanea el código.', connected: 'Conectado', disconnect: 'Desconectar', cfg: '¿Cómo debe responder la IA a tus clientes?', cfgHelp: 'Describe tu negocio, servicios, precios, horarios, tono y reglas. Escribe en inglés, español o portugués.', templates: 'Empieza con una plantilla', lang: 'Idioma de respuesta', auto: 'El mismo del cliente', aiOn: 'La IA responde automáticamente', save: 'Guardar', saved: 'Guardado', test: 'Prueba tu IA', testPh: 'Escribe como si fueras un cliente…', used: (u: number, l: number) => `${u} de ${l} respuestas de IA usadas en la prueba`, inbox: 'Abrir conversaciones', takeover: 'Consejo: apaga la IA cuando quieras responder tú mismo.' },
  pt: { title: 'Seu assistente de WhatsApp com IA', trial: (d: string) => `Teste grátis — faltam ${d}`, expired: 'Seu teste terminou', expiredTxt: 'Fale conosco para manter seu assistente ativo.', contact: 'Fale conosco', steps: ['Conectar WhatsApp', 'Configurar a IA', 'Testar'], wa: 'Conecte seu WhatsApp', connect: 'Conectar WhatsApp', scan: 'Abra o WhatsApp › Aparelhos conectados › Conectar aparelho e leia o código.', connected: 'Conectado', disconnect: 'Desconectar', cfg: 'Como a IA deve responder seus clientes?', cfgHelp: 'Descreva seu negócio, serviços, preços, horários, tom e regras. Escreva em inglês, espanhol ou português.', templates: 'Comece por um modelo', lang: 'Idioma da resposta', auto: 'O mesmo do cliente', aiOn: 'IA responde automaticamente', save: 'Salvar', saved: 'Salvo', test: 'Teste sua IA', testPh: 'Escreva como se fosse um cliente…', used: (u: number, l: number) => `${u} de ${l} respostas da IA usadas no teste`, inbox: 'Abrir conversas', takeover: 'Dica: desligue a IA quando quiser responder você mesmo.' },
};
const MODELOS: Record<string, string> = {
  Salon: 'We are a beauty salon. Services: haircut $40, color from $90, nails $35. Open Tue–Sat 9am–7pm. Book appointments by asking name, service and preferred day/time, then say the team will confirm. Friendly and warm tone.',
  Restaurant: 'We are a Brazilian restaurant. Open daily 11am–10pm. We do takeout and delivery (Uber Eats). Share the menu link when asked. For reservations ask name, date, time and party size.',
  Clinic: 'We are a dental clinic. Cleanings, whitening and implants. Open Mon–Fri 8am–6pm. Never give medical advice; collect name, phone and reason to schedule an evaluation.',
  'Real estate': 'We are a real estate agency in Florida. Help buyers and renters: ask budget, city, bedrooms and move-in date, then say an agent will contact them today.',
};

function restante(ate: string) {
  const ms = new Date(ate).getTime() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
}

export default function ClienteUsa() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('cliente-usa-lang') as Lang) || 'en');
  const t = T[lang];
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['cliente-usa-config', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('cliente_usa_config').select('*').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [prompt, setPrompt] = useState('');
  const [idioma, setIdioma] = useState('auto');
  const [iaAtiva, setIaAtiva] = useState(false);
  useEffect(() => { if (cfg) { setPrompt(cfg.prompt_ia); setIdioma(cfg.idioma); setIaAtiva(cfg.ia_ativa); if (cfg.idioma_interface) { setLang(cfg.idioma_interface as Lang); localStorage.setItem('cliente-usa-lang', cfg.idioma_interface); } } }, [cfg]);

  // WhatsApp
  const [wa, setWa] = useState<{ connected: boolean; phone?: string | null; exists: boolean } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<number | null>(null);
  const callQr = async (action: string) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-qr', { body: { action } });
    if (error) throw error;
    return data;
  };
  const checar = async () => {
    try {
      const d = await callQr('status');
      setWa({ connected: !!d?.connected, phone: d?.phone, exists: true });
      return !!d?.connected;
    } catch { setWa({ connected: false, exists: false }); return false; }
  };
  useEffect(() => { if (user) checar(); return () => { if (poll.current) window.clearInterval(poll.current); }; }, [user]);

  const conectar = async () => {
    setBusy(true);
    try {
      if (!wa?.exists) {
        const c = await callQr('create-instance');
        if (!c?.ok) throw new Error(c?.error || 'Error');
      }
      const d = await callQr('qr');
      if (d?.connected) { await checar(); return; }
      setQr(d?.qr || null);
      if (poll.current) window.clearInterval(poll.current);
      let n = 0;
      // Só consulta enquanto o QR está aberto, no máximo 2 minutos.
      poll.current = window.setInterval(async () => {
        n++;
        if (document.hidden) return;
        const ok = await checar();
        if (ok || n > 40) { window.clearInterval(poll.current!); poll.current = null; setQr(null); if (ok) callQr('setup-webhook').catch(() => {}); }
      }, 3000);
    } catch (e) {
      toast({ title: 'WhatsApp', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const desconectar = async () => {
    setBusy(true);
    try { await callQr('disconnect'); await checar(); } finally { setBusy(false); }
  };

  const salvar = async () => {
    const { error } = await supabase.from('cliente_usa_config').update({ prompt_ia: prompt, idioma, ia_ativa: iaAtiva }).eq('user_id', user!.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: t.saved });
    qc.invalidateQueries({ queryKey: ['cliente-usa-config'] });
  };

  // Teste
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [testando, setTestando] = useState(false);
  const testar = async () => {
    if (!msg.trim()) return;
    const novo = [...chat, { role: 'user' as const, content: msg.trim() }];
    setChat(novo); setMsg(''); setTestando(true);
    const { data, error } = await supabase.functions.invoke('cliente-usa-ia', { body: { mensagens: novo, prompt, idioma } });
    setTestando(false);
    if (error || data?.error) return toast({ title: 'AI', description: data?.error || error?.message, variant: 'destructive' });
    setChat([...novo, { role: 'assistant', content: data.resposta }]);
  };

  const trocarLang = (l: Lang) => { setLang(l); localStorage.setItem('cliente-usa-lang', l); setIdioma(l); if (user) supabase.from('cliente_usa_config').update({ idioma_interface: l, idioma: l }).eq('user_id', user.id).then(() => qc.invalidateQueries({ queryKey: ['cliente-usa-lang', user.id] })); };
  const expirado = !!cfg?.teste_ate && new Date(cfg.teste_ate).getTime() < Date.now();
  const passos = [!!wa?.connected, !!cfg?.prompt_ia?.trim(), chat.length > 1];

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <div className="flex gap-1">
        {(['en', 'es', 'pt'] as Lang[]).map(l => (
          <Button key={l} size="sm" variant={lang === l ? 'default' : 'outline'} onClick={() => trocarLang(l)}>{l.toUpperCase()}</Button>
        ))}
      </div>
    </div>
  );

  if (isLoading) return <AppLayout><div className="p-6">…</div></AppLayout>;
  if (!cfg?.usa_b2b || expirado) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto p-6 space-y-4">
          {header}
          <Card><CardContent className="p-6 space-y-3 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold">{t.expired}</p>
            <p className="text-muted-foreground">{t.expiredTxt}</p>
            <Button asChild><a href="https://wa.me/5562991672674" target="_blank" rel="noreferrer">{t.contact}</a></Button>
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        {header}
        {cfg.teste_ate && (
          <div className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium flex flex-wrap justify-between gap-2">
            <span>{t.trial(restante(cfg.teste_ate))}</span>
            <span>{t.used(cfg.respostas_usadas, cfg.limite_respostas)}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {t.steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              {passos[i] ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span>{i + 1}. {s}</span>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />{t.wa}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {wa?.connected ? (
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{t.connected}</Badge>
                {wa.phone && <span className="text-sm">+{wa.phone}</span>}
                <Button size="sm" variant="outline" disabled={busy} onClick={desconectar}>{t.disconnect}</Button>
                <Button size="sm" asChild><Link to="/inbox"><MessageSquare className="h-4 w-4 mr-1" />{t.inbox}</Link></Button>
              </div>
            ) : (
              <>
                <Button disabled={busy} onClick={conectar}>{t.connect}</Button>
                {qr && (
                  <div className="space-y-2">
                    <img src={qr} alt="QR Code" className="w-64 h-64 rounded-md border bg-background" />
                    <p className="text-sm text-muted-foreground">{t.scan}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />{t.cfg}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.cfgHelp}</p>
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-xs text-muted-foreground mr-1">{t.templates}:</span>
                {Object.keys(MODELOS).map(k => (
                  <Button key={k} size="sm" variant="outline" className="h-7" onClick={() => setPrompt(MODELOS[k])}>{k}</Button>
                ))}
              </div>
              <Textarea rows={10} maxLength={8000} value={prompt} onChange={e => setPrompt(e.target.value)} />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">{t.lang}</span>
                <Select value={idioma} onValueChange={setIdioma}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t.auto}</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={iaAtiva} onCheckedChange={setIaAtiva} />{t.aiOn}</label>
              <p className="text-xs text-muted-foreground">{t.takeover}</p>
              <Button onClick={salvar}>{t.save}</Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader><CardTitle>{t.test}</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <div className="flex-1 min-h-64 max-h-96 overflow-y-auto space-y-2 rounded-md border p-3">
                {chat.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm' : 'max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm'}>{m.content}</div>
                ))}
                {testando && <div className="text-sm text-muted-foreground">…</div>}
              </div>
              <div className="flex gap-2">
                <Input value={msg} placeholder={t.testPh} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && testar()} />
                <Button size="icon" disabled={testando} onClick={testar}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
