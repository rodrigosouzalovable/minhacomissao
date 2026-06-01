import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AtSign, Upload, Download, FileSpreadsheet, ClipboardPaste, CheckCircle2, XCircle, AlertCircle, Play } from "lucide-react";

type Status = "valido" | "invalido" | "duvidoso";
type Result = { email: string; status: Status; motivo: string; sugestao?: string };
type Row = Record<string, any> & { __email__: string; __status__?: Status; __motivo__?: string; __sugestao__?: string };

const BATCH_SIZE = 500;
const MAX_EMAILS = 100_000;

export default function ValidarEmails() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"planilha" | "texto">("planilha");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [textInput, setTextInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Row[] | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (json.length === 0) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }
      if (json.length > MAX_EMAILS) {
        toast({ title: `Limite excedido`, description: `Máximo ${MAX_EMAILS.toLocaleString()} linhas por importação.`, variant: "destructive" });
        return;
      }
      const cols = Object.keys(json[0]);
      setHeaders(cols);
      // tenta detectar coluna de e-mail
      const guess = cols.find(c => /e-?mail|email/i.test(c)) || cols[0];
      setEmailColumn(guess);
      setRows(json as Row[]);
      setResults(null);
      toast({ title: "Planilha carregada", description: `${json.length.toLocaleString()} linhas detectadas` });
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err?.message, variant: "destructive" });
    }
  };

  const prepareTextEmails = (): Row[] => {
    const lines = textInput.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
    if (lines.length > MAX_EMAILS) {
      toast({ title: "Limite excedido", description: `Máximo ${MAX_EMAILS.toLocaleString()} e-mails.`, variant: "destructive" });
      return [];
    }
    return lines.map(email => ({ email, __email__: email }));
  };

  const startValidation = async () => {
    let dataset: Row[] = [];
    if (mode === "planilha") {
      if (!rows.length || !emailColumn) {
        toast({ title: "Selecione a planilha e a coluna de e-mail", variant: "destructive" });
        return;
      }
      dataset = rows.map(r => ({ ...r, __email__: String(r[emailColumn] ?? "").trim() }));
    } else {
      dataset = prepareTextEmails();
      if (!dataset.length) return;
    }

    setProcessing(true);
    setProgress(0);

    const emails = dataset.map(r => r.__email__);
    const total = emails.length;
    const updated: Row[] = [...dataset];

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const slice = emails.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("validate-emails-batch", {
          body: { emails: slice },
        });
        if (error) throw new Error(error.message || "Erro na edge function");
        const batchResults: Result[] = data?.results || [];
        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          updated[i + j].__status__ = r.status;
          updated[i + j].__motivo__ = r.motivo;
          updated[i + j].__sugestao__ = r.sugestao;
        }
        setProgress(Math.round(((i + slice.length) / total) * 100));
      }
      setResults(updated);
      toast({ title: "Varredura concluída", description: `${total.toLocaleString()} e-mails analisados` });
    } catch (err: any) {
      toast({ title: "Erro na validação", description: err?.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const stats = useMemo(() => {
    if (!results) return null;
    return {
      total: results.length,
      validos: results.filter(r => r.__status__ === "valido").length,
      invalidos: results.filter(r => r.__status__ === "invalido").length,
      duvidosos: results.filter(r => r.__status__ === "duvidoso").length,
    };
  }, [results]);

  const downloadExcel = async (status: Status, fileSuffix: string) => {
    if (!results) return;
    const filtered = results.filter(r => r.__status__ === status);
    if (filtered.length === 0) {
      toast({ title: "Nada para exportar", description: `Nenhum e-mail ${fileSuffix}` });
      return;
    }
    const XLSX = await import("xlsx");
    // Preserva colunas originais + adiciona _motivo / _sugestao_typo
    const exportRows = filtered.map(r => {
      const { __email__, __status__, __motivo__, __sugestao__, ...rest } = r;
      if (mode === "texto") {
        return { email: __email__, _motivo: __motivo__ || "", _sugestao_typo: __sugestao__ || "" };
      }
      return { ...rest, _motivo: __motivo__ || "", _sugestao_typo: __sugestao__ || "" };
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fileSuffix);
    const base = fileName?.replace(/\.[^.]+$/, "") || "emails";
    XLSX.writeFile(wb, `${base}_${fileSuffix}.xlsx`);
  };

  const tabRows = (status: Status) => results?.filter(r => r.__status__ === status).slice(0, 500) || [];

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <AtSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Validar E-mails em Massa</h1>
            <p className="text-muted-foreground">Importe uma planilha e separe e-mails válidos de inválidos — 100% grátis</p>
          </div>
        </div>

        {!results && (
          <Card>
            <CardHeader><CardTitle>1. Importar lista</CardTitle></CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList>
                  <TabsTrigger value="planilha"><FileSpreadsheet className="h-4 w-4 mr-2" />Planilha (.xlsx / .csv)</TabsTrigger>
                  <TabsTrigger value="texto"><ClipboardPaste className="h-4 w-4 mr-2" />Colar lista</TabsTrigger>
                </TabsList>

                <TabsContent value="planilha" className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="file">Arquivo</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      disabled={processing}
                    />
                    {fileName && <p className="text-sm text-muted-foreground mt-1">📎 {fileName} — {rows.length.toLocaleString()} linhas</p>}
                  </div>
                  {headers.length > 0 && (
                    <div>
                      <Label>Coluna que contém o e-mail</Label>
                      <Select value={emailColumn} onValueChange={setEmailColumn}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="texto" className="pt-4">
                  <Label>E-mails (um por linha, ou separados por vírgula/ponto-e-vírgula)</Label>
                  <Textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="joao@gmail.com&#10;maria@empresa.com.br&#10;..."
                    rows={10}
                    disabled={processing}
                  />
                  <p className="text-sm text-muted-foreground mt-1">{textInput.split(/[\n,;]/).filter(s => s.trim()).length} e-mails</p>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end mt-6">
                <Button onClick={startValidation} disabled={processing} size="lg">
                  <Play className="h-4 w-4 mr-2" /> Iniciar varredura
                </Button>
              </div>

              {processing && (
                <div className="mt-4 space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">Validando... {progress}%</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {results && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total</div><div className="text-3xl font-bold">{stats.total.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-600" />Válidos</div><div className="text-3xl font-bold text-green-600">{stats.validos.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1"><XCircle className="h-4 w-4 text-red-600" />Inválidos</div><div className="text-3xl font-bold text-red-600">{stats.invalidos.toLocaleString()}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1"><AlertCircle className="h-4 w-4 text-amber-600" />Duvidosos</div><div className="text-3xl font-bold text-amber-600">{stats.duvidosos.toLocaleString()}</div></CardContent></Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadExcel("valido", "validos")} variant="default"><Download className="h-4 w-4 mr-2" />Baixar válidos</Button>
              <Button onClick={() => downloadExcel("invalido", "invalidos")} variant="destructive"><Download className="h-4 w-4 mr-2" />Baixar inválidos</Button>
              <Button onClick={() => downloadExcel("duvidoso", "duvidosos")} variant="outline"><Download className="h-4 w-4 mr-2" />Baixar duvidosos</Button>
              <Button onClick={() => { setResults(null); setProgress(0); }} variant="ghost" className="ml-auto"><Upload className="h-4 w-4 mr-2" />Nova varredura</Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="invalido">
                  <TabsList>
                    <TabsTrigger value="valido">Válidos ({stats.validos})</TabsTrigger>
                    <TabsTrigger value="invalido">Inválidos ({stats.invalidos})</TabsTrigger>
                    <TabsTrigger value="duvidoso">Duvidosos ({stats.duvidosos})</TabsTrigger>
                  </TabsList>
                  {(["valido","invalido","duvidoso"] as Status[]).map(s => (
                    <TabsContent key={s} value={s}>
                      <div className="text-xs text-muted-foreground mb-2">Mostrando até 500 linhas. O arquivo Excel contém todos.</div>
                      <Table>
                        <TableHeader><TableRow><TableHead>E-mail</TableHead><TableHead>Motivo</TableHead><TableHead>Sugestão</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {tabRows(s).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{r.__email__}</TableCell>
                              <TableCell><Badge variant={s==="valido"?"default":s==="invalido"?"destructive":"secondary"}>{r.__motivo__}</Badge></TableCell>
                              <TableCell className="font-mono text-sm text-green-700">{r.__sugestao__ || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
