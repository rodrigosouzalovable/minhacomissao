import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Lightbulb, Loader2, RefreshCw, Copy, CornerDownLeft, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const OBJECAO_LABEL: Record<string, string> = {
  sem_condicoes: 'sem condições',
  caro: 'achou caro',
  vou_pensar: 'vou pensar',
  mes_que_vem: 'quer adiar',
  desconfianca: 'desconfiança',
  outro: 'objeção',
};

/** Detector local (sem IA) da objeção na última mensagem do cliente. */
export function detectarObjecaoLocal(texto: string): string | null {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t || t.length < 3) return null;
  if (/(nao tenho|sem) (condic|dinheiro|como pagar)|nao tenho como|estou desempregad|to desempregad|nao da pra pagar|nao consigo pagar|sem grana|apertad/.test(t)) return 'sem_condicoes';
  if (/(muito|ta|esta|e) car[oa]|nao vale|abusiv|absurd|valor alto|parcela alta|diminui|abaixa|desconto maior|melhor(a|e) (a|o) (proposta|valor)/.test(t)) return 'caro';
  if (/vou pensar|vou ver|depois eu|te (aviso|retorno)|analisar|pensar melhor|conversar com/.test(t)) return 'vou_pensar';
  if (/mes que vem|proximo mes|semana que vem|quando (eu )?receber|so no (dia|mes)|mais pra frente|salario/.test(t)) return 'mes_que_vem';
  if (/golpe|nao confio|isso e verdade|como (eu )?sei|nunca fiz|nao reconheco|nao devo|ja paguei/.test(t)) return 'desconfianca';
  return null;
}

interface Sugestao { texto: string; catalogo_id?: string | null }

interface Props {
  instanciaId: string;
  telefone: string;
  mensagemId: string;
  textoCliente: string;
  credor?: string | null;
  objecaoLocal?: string | null;
  onUsar: (texto: string) => void;
  onFechar: () => void;
}

export function SugestoesObjecaoPanel({
  instanciaId, telefone, mensagemId, textoCliente, credor, objecaoLocal, onUsar, onFechar,
}: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [objecao, setObjecao] = useState<string>(objecaoLocal || 'outro');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const buscadoRef = useRef<string>('');

  const buscar = useCallback(async (forcar = false) => {
    setCarregando(true);
    setErro(null);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('sugerir-resposta-objecao', {
        body: {
          instancia_id: instanciaId,
          telefone,
          mensagem_id: mensagemId,
          texto: textoCliente,
          credor: credor || null,
          usuario_id: sess?.user?.id ?? null,
          forcar,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível gerar sugestões');
      setSugestoes(Array.isArray(data.sugestoes) ? data.sugestoes : []);
      setObjecao(String(data.objecao || objecaoLocal || 'outro'));
      setLogId(data.log_id ?? null);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [instanciaId, telefone, mensagemId, textoCliente, credor, objecaoLocal]);

  useEffect(() => {
    const chave = `${instanciaId}|${telefone}|${mensagemId}`;
    if (buscadoRef.current === chave) return;
    buscadoRef.current = chave;
    void buscar(false);
  }, [instanciaId, telefone, mensagemId, buscar]);

  const usar = async (s: Sugestao, idx: number) => {
    onUsar(s.texto);
    if (logId) {
      await supabase.from('objecao_sugestoes_log').update({ usada_idx: idx }).eq('id', logId);
    }
  };

  return (
    <div className="absolute bottom-full right-4 mb-2 z-30 w-[330px] max-w-[calc(100%-2rem)] rounded-lg border bg-card/95 backdrop-blur shadow-lg animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium">Sugestões</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {OBJECAO_LABEL[objecao] || objecao}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Gerar outras"
            disabled={carregando} onClick={() => void buscar(true)}>
            <RefreshCw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title={minimizado ? 'Maximizar' : 'Minimizar'}
            onClick={() => setMinimizado(v => !v)}>
            {minimizado ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Fechar" onClick={onFechar}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!minimizado && <div className="p-2 space-y-2 max-h-[45vh] overflow-y-auto">
        {carregando && !sugestoes.length && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando a conversa...
          </div>
        )}
        {erro && !carregando && (
          <div className="text-xs text-destructive px-1 py-2">{erro}</div>
        )}
        {sugestoes.map((s, i) => (
          <div key={i} className="rounded-md border bg-background p-2">
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{s.texto}</p>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
                onClick={() => { void navigator.clipboard.writeText(s.texto); toast({ title: 'Copiado' }); }}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => void usar(s, i)}>
                <CornerDownLeft className="h-3 w-3 mr-1" /> Usar
              </Button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
