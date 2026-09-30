import { useMemo, useState } from "react";
import { Download, Loader2, RotateCcw, Search, UserRoundX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { exportarParaExcel } from "@/lib/exportExcel";
import { toast } from "sonner";

interface Linha {
  telefone_sufixo: string;
  telefone: string;
  contato_nome: string | null;
  caixa_nome: string | null;
  marcado_por_nome: string;
  marcado_em: string;
}

function formatarTelefone(valor: string) {
  const d = String(valor || "").replace(/\D/g, "");
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return d;
}

export function NaoClienteBell() {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["meta-nao-cliente"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_meta_contatos_nao_cliente");
      if (error) throw error;
      return (data || []) as Linha[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");
    return (data || []).filter((linha) => !termo
      || String(linha.contato_nome || "").toLowerCase().includes(termo)
      || String(linha.caixa_nome || "").toLowerCase().includes(termo)
      || String(linha.marcado_por_nome || "").toLowerCase().includes(termo)
      || (digitos.length >= 3 && linha.telefone.includes(digitos)));
  }, [busca, data]);

  const exportar = async () => {
    if (!filtradas.length) return toast.error("Nenhum número para baixar");
    await exportarParaExcel(
      filtradas.map((linha) => ({
        telefone: linha.telefone,
        nome: linha.contato_nome || "",
        caixa: linha.caixa_nome || "PADRÃO",
        marcado_por: linha.marcado_por_nome,
        data: new Date(linha.marcado_em).toLocaleString("pt-BR"),
      })),
      [
        { chave: "telefone", titulo: "Telefone" },
        { chave: "nome", titulo: "Nome" },
        { chave: "caixa", titulo: "Caixa" },
        { chave: "marcado_por", titulo: "Marcado por" },
        { chave: "data", titulo: "Data" },
      ],
      "nao-e-o-cliente",
    );
  };

  const desfazer = async (linha: Linha) => {
    if (!window.confirm(`Retirar ${formatarTelefone(linha.telefone)} da blacklist?`)) return;
    setRemovendo(linha.telefone_sufixo);
    const { error } = await (supabase as any).rpc("desfazer_meta_contato_nao_cliente", {
      _telefone_sufixo: linha.telefone_sufixo,
    });
    setRemovendo(null);
    if (error) return toast.error("Não foi possível desfazer a marcação");
    toast.success("Marcação desfeita e número retirado da blacklist");
    await refetch();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Não é o cliente">
          <UserRoundX className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle>Contatos marcados como “Não é o cliente”</DialogTitle>
          <DialogDescription>Estes números estão na blacklist e não entram em novos envios Meta.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar telefone, nome, caixa ou usuário" className="pl-9" />
          </div>
          <Button variant="outline" onClick={exportar} disabled={!filtradas.length}>
            <Download className="mr-2 h-4 w-4" /> Baixar Excel ({filtradas.length})
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
          <span>Contato</span><span>Caixa</span><span>Marcação</span><span>Ação</span>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {filtradas.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {isFetching ? "Carregando..." : "Nenhum contato marcado."}
            </p>
          )}
          {filtradas.map((linha) => (
            <div key={linha.telefone_sufixo} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.8fr)_auto] items-center gap-3 border-b px-4 py-3 text-xs last:border-b-0">
              <div className="min-w-0"><p className="truncate font-medium">{linha.contato_nome || "Sem nome"}</p><p className="text-muted-foreground">{formatarTelefone(linha.telefone)}</p></div>
              <span className="truncate">{linha.caixa_nome || "PADRÃO"}</span>
              <div className="min-w-0"><p className="truncate">{linha.marcado_por_nome}</p><p className="text-muted-foreground">{new Date(linha.marcado_em).toLocaleString("pt-BR")}</p></div>
              <Button variant="ghost" size="icon" title="Desfazer marcação" disabled={removendo === linha.telefone_sufixo} onClick={() => void desfazer(linha)}>
                {removendo === linha.telefone_sufixo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
