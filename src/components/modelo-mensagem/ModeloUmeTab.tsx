import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface LinhaUme {
  nome: string;
  telefone: string;
  atraso: string;
}

interface LinhaRemovida extends LinhaUme {
  motivo: string;
}

/**
 * Retorna o motivo da rejeição do nome, ou null se o nome estiver limpo.
 * Detecta acentos reais e "mojibake" (Josã©, Rosã¡Rio), símbolos e nomes incompletos.
 */
function motivoNomeInvalido(nomeRaw: string): string | null {
  const nome = (nomeRaw || '').trim();
  if (!nome) return 'Nome vazio';
  if (nome.replace(/\s/g, '').length < 2) return 'Nome muito curto';

  // Qualquer caractere fora de A-Z, espaço, apóstrofo ou hífen é suspeito
  // (inclui letras acentuadas, ©, ¡, Ã, �, dígitos e símbolos).
  const invalidos = Array.from(new Set(nome.split('').filter((c) => !/[A-Za-z \-']/.test(c))));
  if (invalidos.length > 0) return `Caracteres inválidos: ${invalidos.join(' ')}`;

  const palavras = nome.split(/\s+/).filter(Boolean);
  if (palavras.length < 2) return 'Sem sobrenome';

  return null;
}

export function ModeloUmeTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState('');
  const [total, setTotal] = useState(0);
  const [limpos, setLimpos] = useState<LinhaUme[]>([]);
  const [removidos, setRemovidos] = useState<LinhaRemovida[]>([]);

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('Planilha vazia');
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];

      const ok: LinhaUme[] = [];
      const bad: LinhaRemovida[] = [];
      const porTelefone = new Map<string, number>();
      let lidos = 0;

      for (const row of rows) {
        const nome = String(row?.[0] ?? '').trim();
        const telefone = String(row?.[1] ?? '').replace(/\D+/g, '');
        const atraso = String(row?.[2] ?? '').trim();

        // Cabeçalho / linha sem dados
        if (!nome && !telefone) continue;
        if (/nome/i.test(nome) && !/\d/.test(telefone)) continue;
        lidos++;

        if (telefone.replace(/^55/, '').length < 10) {
          bad.push({ nome, telefone, atraso, motivo: 'Telefone inválido' });
          continue;
        }

        const motivo = motivoNomeInvalido(nome);
        if (motivo) {
          bad.push({ nome, telefone, atraso, motivo });
          continue;
        }

        const jaExiste = porTelefone.get(telefone);
        if (jaExiste !== undefined) {
          const atual = ok[jaExiste];
          const novoAtrasoNum = Number(atraso) || Infinity;
          const atualNum = Number(atual.atraso) || Infinity;
          if (novoAtrasoNum < atualNum) ok[jaExiste] = { nome, telefone, atraso };
          continue;
        }
        porTelefone.set(telefone, ok.length);
        ok.push({ nome, telefone, atraso });
      }

      if (lidos === 0) throw new Error('Nenhuma linha encontrada (A=nome, B=telefone, C=atraso)');

      setTotal(lidos);
      setLimpos(ok);
      setRemovidos(bad);
      setArquivo(file.name);
      toast.success(`${ok.length} nomes válidos • ${bad.length} linhas removidas`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao ler a planilha');
    }
  }

  function baixar() {
    if (limpos.length === 0) return;
    const aoa = limpos.map((l) => [l.nome, l.telefone, l.atraso]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UME');
    XLSX.writeFile(wb, `modelo-ume-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function limpar() {
    setLimpos([]);
    setRemovidos([]);
    setArquivo('');
    setTotal(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Planilha UME (A: nome, B: telefone, C: tempo de atraso)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <Button variant="outline" onClick={baixar} disabled={limpos.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Baixar Excel limpo
            </Button>
            {(limpos.length > 0 || removidos.length > 0) && (
              <Button variant="ghost" onClick={limpar}>
                <Trash2 className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Upload className="h-3 w-3" />
            {arquivo
              ? `${arquivo} — ${total} linhas lidas • ${limpos.length} mantidas • ${removidos.length} removidas`
              : 'Remove automaticamente linhas com nomes acentuados, corrompidos ou com símbolos.'}
          </p>
        </CardContent>
      </Card>

      {limpos.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm font-medium">Nomes aprovados ({limpos.length})</p>
            <div className="max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Atraso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limpos.map((l, i) => (
                    <TableRow key={`${l.telefone}-${i}`}>
                      <TableCell className="whitespace-nowrap">{l.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.telefone}</TableCell>
                      <TableCell>{l.atraso}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {removidos.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Linhas removidas ({removidos.length})
            </p>
            <div className="max-h-[40vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {removidos.map((l, i) => (
                    <TableRow key={`rm-${l.telefone}-${i}`}>
                      <TableCell className="whitespace-nowrap">{l.nome || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.telefone || '—'}</TableCell>
                      <TableCell>{l.atraso || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.motivo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
