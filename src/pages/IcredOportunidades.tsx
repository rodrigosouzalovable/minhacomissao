import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Landmark, Loader2, Upload } from "lucide-react";
import { IcredAtendimentoPanel } from "@/components/meta/IcredAtendimentoPanel";

const STATUS = ["NOVO", "CONTATADO", "INTERESSADO", "PROPOSTA_DIGITADA", "PAGO", "DESINTERESSE"];
const STATUS_L: Record<string, string> = {
  NOVO: "Novo", CONTATADO: "Contatado", INTERESSADO: "Interessado",
  PROPOSTA_DIGITADA: "Proposta digitada", PAGO: "Pago", DESINTERESSE: "Sem interesse",
};

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const achar = (linha: Record<string, unknown>, chaves: string[]) => {
  const k = Object.keys(linha).find((c) => chaves.some((x) => c.toLowerCase().includes(x)));
  return k ? linha[k] : undefined;
};
const numero = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export default function IcredOportunidades() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [filtro, setFiltro] = useState("todos");

  const lista = useQuery({
    queryKey: ["icred_oportunidades", filtro], staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from("icred_oportunidades").select("*").order("created_at", { ascending: false }).limit(500);
      if (filtro !== "todos") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const importar = async (file: File) => {
    setImportando(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const lote = `${file.name} ${new Date().toLocaleDateString("pt-BR")}`;
      const vistos = new Set<string>();
      const regs = linhas.map((l) => {
        const cpf = soDigitos(achar(l, ["cpf"])).padStart(11, "0");
        let cel = soDigitos(achar(l, ["celular", "telefone", "fone", "whats"]));
        if (cel && cel.length <= 11) cel = "55" + cel;
        return {
          cpf, nome: String(achar(l, ["nome"]) ?? "").trim() || null, celular: cel || null,
          produto: String(achar(l, ["produto", "tabela"]) ?? "FGTS").trim().toUpperCase() || "FGTS",
          valor_liberado: numero(achar(l, ["valor", "liberado", "saldo"])), lote,
        };
      }).filter((r) => {
        const k = r.cpf + r.produto;
        if (!/^\d{11}$/.test(r.cpf) || r.cpf === "00000000000" || vistos.has(k)) return false;
        vistos.add(k); return true;
      });
      if (!regs.length) { toast.error("Nenhuma linha com CPF válido. A planilha precisa de uma coluna CPF."); return; }
      for (let i = 0; i < regs.length; i += 500) {
        const { error } = await supabase.from("icred_oportunidades")
          .upsert(regs.slice(i, i + 500), { onConflict: "cpf,produto", ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`${regs.length} oportunidades importadas (repetidas foram ignoradas).`);
      qc.invalidateQueries({ queryKey: ["icred_oportunidades"] });
    } catch (e: any) {
      toast.error("Falha ao importar: " + (e?.message || e));
    } finally {
      setImportando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("icred_oportunidades").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["icred_oportunidades"] });
  };

  const dados = lista.data || [];
  const total = dados.reduce((s: number, r: any) => s + Number(r.valor_liberado || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Oportunidades iCred</h1>
            <p className="text-sm text-muted-foreground">FGTS e consignado da Única Promotora — importação, funil e acompanhamento.</p>
          </div>
        </div>

        <IcredAtendimentoPanel />

        <Card>
          <CardHeader>
            <CardTitle>Importar planilha</CardTitle>
            <CardDescription>
              Excel ou CSV exportado da iCred. Colunas reconhecidas: <b>CPF</b> (obrigatória), Nome, Celular/Telefone, Produto, Valor liberado.
              Celular sem 55 recebe o 55 automaticamente; CPF repetido no mesmo produto é ignorado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
            <Button onClick={() => inputRef.current?.click()} disabled={importando}>
              {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar Excel/CSV
            </Button>
            <Badge variant="secondary">Credencial iCred configurada</Badge>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS.map((s) => (
            <Card key={s}><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{STATUS_L[s]}</div>
              <div className="text-xl font-bold">{dados.filter((r: any) => r.status === s).length}</div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Oportunidades</CardTitle>
              <CardDescription>{dados.length} na lista · {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} liberáveis</CardDescription>
            </div>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_L[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {lista.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : dados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade ainda. Importe a planilha da iCred.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Nome</th><th>CPF</th><th>Celular</th><th>Produto</th><th>Valor</th><th>Situação</th>
                </tr></thead>
                <tbody>
                  {dados.map((r: any) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{r.nome || "—"}</td>
                      <td>{r.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</td>
                      <td>{r.celular || "—"}</td>
                      <td>{r.produto}</td>
                      <td>{r.valor_liberado != null ? Number(r.valor_liberado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                      <td>
                        <Select value={r.status} onValueChange={(v) => mudarStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_L[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
