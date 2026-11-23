import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { primeiraLinhaCabecalhoNM, sugerirPapeisNM, type PapelColunaNM } from '@/lib/novoMundoContatos';

const ROTULOS: Record<PapelColunaNM, string> = { telefone: 'Telefone', nome: 'Nome', saudacao: 'Saudação {{1}}', ignorar: 'Ignorar' };
const letra = (i: number) => String.fromCharCode(65 + (i % 26));

type Props = { arquivo: string | null; rows: unknown[][] | null; carregando: boolean; onCancel: () => void; onConfirm: (papeis: PapelColunaNM[], temCabecalho: boolean) => void };

export function NovoMundoMapearColunasDialog({ arquivo, rows, carregando, onCancel, onConfirm }: Props) {
  const [temCabecalho, setTemCabecalho] = useState(false);
  const [papeis, setPapeis] = useState<PapelColunaNM[]>([]);
  useEffect(() => {
    if (!rows) return;
    const h = primeiraLinhaCabecalhoNM(rows);
    setTemCabecalho(h);
    setPapeis(sugerirPapeisNM(rows, h));
  }, [rows]);
  if (!rows) return null;
  const mudar = (i: number, p: PapelColunaNM) => setPapeis(atual => atual.map((x, j) => j === i ? p : (p !== 'ignorar' && x === p ? 'ignorar' : x)));
  const ok = papeis.includes('telefone') && papeis.includes('nome');
  const amostra = rows.slice(temCabecalho ? 1 : 0, temCabecalho ? 6 : 5);
  const total = rows.length - (temCabecalho ? 1 : 0);
  return <Dialog open onOpenChange={o => { if (!o && !carregando) onCancel(); }}>
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Escolher colunas</DialogTitle><DialogDescription>{arquivo} · {total.toLocaleString('pt-BR')} linhas. Indique qual coluna é o telefone e qual é o nome do cliente.</DialogDescription></DialogHeader>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={temCabecalho} onCheckedChange={v => setTemCabecalho(v === true)} />A primeira linha é cabeçalho</label>
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead><tr className="border-b text-left">{papeis.map((p, i) => <th key={i} className="p-2 align-top min-w-[140px]">
          <div className="mb-1 text-muted-foreground">Coluna {letra(i)}{temCabecalho && rows[0]?.[i] ? ` · ${String(rows[0][i])}` : ''}</div>
          <Select value={p} onValueChange={v => mudar(i, v as PapelColunaNM)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(ROTULOS) as PapelColunaNM[]).map(k => <SelectItem key={k} value={k}>{ROTULOS[k]}</SelectItem>)}</SelectContent></Select>
        </th>)}</tr></thead>
        <tbody>{amostra.map((r, ri) => <tr key={ri} className="border-b">{papeis.map((_, i) => <td key={i} className="p-2 break-words">{String(r[i] ?? '')}</td>)}</tr>)}</tbody>
      </table></div>
      {!papeis.includes('saudacao') && <p className="text-xs text-muted-foreground">Sem coluna de saudação: o sistema usará "tudo bem?" ou "como vai, tudo bem?". Telefones sem 55 recebem o 55 automaticamente.</p>}
      <DialogFooter><Button variant="outline" onClick={onCancel} disabled={carregando}>Cancelar</Button><Button disabled={!ok || carregando} onClick={() => onConfirm(papeis, temCabecalho)}>{carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Conferir contatos</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
