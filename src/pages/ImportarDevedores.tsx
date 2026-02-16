import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileSpreadsheet, Trash2, Check, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';

interface DevedorRow {
  cpf: string;
  nascimento: string;
  nome: string;
  credor: string;
  contrato: string;
  atraso: string;
  valor_original: number;
  valor_atualizado: number;
}

export default function ImportarDevedores() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DevedorRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A' });

      // Skip first row (header)
      const dataRows = json.slice(1);

      const parseNum = (val: unknown) => {
        if (val === undefined || val === null) return 0;
        const raw = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(raw) || 0;
      };

      const parsed: DevedorRow[] = dataRows.map((row) => {
        const risco = parseNum(row['G']);
        return {
          cpf: String(row['A'] ?? '').replace(/\D/g, ''),
          nascimento: String(row['B'] ?? ''),
          nome: String(row['C'] ?? ''),
          credor: String(row['D'] ?? ''),
          contrato: String(row['E'] ?? ''),
          atraso: String(row['F'] ?? ''),
          valor_original: risco,
          valor_atualizado: risco,
        };
      }).filter(r => r.cpf.length >= 11);

      setRows(parsed);
    };
    reader.readAsBinaryString(f);
  }, []);

  const parseDate = (raw: string): string | null => {
    if (!raw) return null;
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      if (day && month && year && year.length === 4) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return null;
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);

    const records = rows.map(r => ({
      nome: r.nome,
      cpf: r.cpf,
      valor_original: r.valor_original,
      valor_atualizado: r.valor_atualizado,
      credor: r.credor || null,
      descricao: r.credor || null,
      contrato: r.contrato || null,
      data_vencimento: parseDate(r.nascimento),
      importado_por: user.id,
      arquivo_importacao: file?.name || 'unknown',
    }));

    const { error } = await supabase.from('devedores' as any).insert(records as any);

    if (error) {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Importação concluída', description: `${rows.length} registros importados com sucesso.` });
      setImported(true);
    }
    setImporting(false);
  };

  const handleClear = () => {
    setFile(null);
    setRows([]);
    setImported(false);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Importar Devedores</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              Envie uma planilha Excel (.xlsx) com as colunas: A = CPF/CNPJ, B = Nascimento, C = Cliente, D = Credor, E = Contrato, F = Atraso, G = Risco (valor devido)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="max-w-sm"
              />
              {file && (
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Preview ({rows.length} registros)
                  </CardTitle>
                  <CardDescription>{file?.name}</CardDescription>
                </div>
                {!imported ? (
                  <Button onClick={handleImport} disabled={importing} style={{ background: '#00a86b', color: '#fff' }}>
                    {importing ? 'Importando...' : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Confirmar Importação
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
                    <Check className="h-4 w-4" />
                    Importado com sucesso
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Credor</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead>Risco (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.cpf}</TableCell>
                        <TableCell>{row.nascimento || '-'}</TableCell>
                        <TableCell>{row.nome || <span className="text-destructive"><AlertCircle className="h-3 w-3 inline" /> Vazio</span>}</TableCell>
                        <TableCell>{row.credor || '-'}</TableCell>
                        <TableCell>{row.contrato || '-'}</TableCell>
                        <TableCell>{row.atraso || '-'}</TableCell>
                        <TableCell>{row.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Mostrando 50 de {rows.length} registros
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
