import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Clipboard, Loader2, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Objecao {
  id: string;
  objecao: string;
  resposta: string;
}

interface ScriptUsuarioRow {
  script_texto: string;
  objecoes: unknown;
}

export const SCRIPT_VENDAS_PADRAO = `ABERTURA
— Olá, bom dia! Meu nome é [SEU NOME]. Eu estava pesquisando empresas da sua região e encontrei a [EMPRESA]. Você pode falar por um minuto?

CONEXÃO
— Fiquei impressionado com a avaliação de vocês no Google: manter uma nota tão boa não é fácil. Parabéns pelo trabalho.

DESCOBERTA
— Quando fui conhecer melhor os serviços, não encontrei um site próprio da empresa. Hoje vocês usam apenas redes sociais ou já pensaram em ter uma página de apresentação?

[Ouça a resposta antes de apresentar a solução.]

APRESENTAÇÃO
— Entendi. Nós criamos sites profissionais para empresas que já têm uma boa reputação no Google, mas ainda não possuem uma página própria. O site pode apresentar os serviços, fotos, localização e um botão direto para o WhatsApp, facilitando para novos clientes encontrarem e confiarem na empresa.

CONDIÇÃO
— O investimento é de R$ 500,00, pago uma única vez. Não existe mensalidade obrigatória.

PRÓXIMO PASSO
— Posso preparar uma prévia e enviar em PDF neste WhatsApp para você visualizar sem compromisso. Se fizer sentido, também podemos marcar uma conversa rápida.

AGENDAMENTO
— Qual dia e horário ficam melhores para eu retornar?

[Confirme ao final: “Perfeito, ficou combinado para [DIA], às [HORÁRIO].”]`;

export const OBJECOES_PADRAO: Objecao[] = [
  { id: "instagram", objecao: "Já tenho Instagram e não preciso de site", resposta: "O Instagram é muito importante e continuará sendo usado. O site não substitui a rede social: ele organiza seus serviços, localização e contato em uma apresentação profissional que também pode fortalecer sua presença nas buscas do Google." },
  { id: "caro", objecao: "Está caro", resposta: "Entendo. O valor de R$ 500,00 é pago uma única vez, sem mensalidade obrigatória. A proposta é entregar uma página profissional que possa apresentar a empresa todos os dias e facilitar novos contatos. Posso primeiro mostrar a prévia para você avaliar o custo-benefício?" },
  { id: "sem-interesse", objecao: "Não tenho interesse", resposta: "Tudo bem, respeito sua decisão. Só para eu não insistir em algo que não ajuda: hoje o principal motivo é não ser uma prioridade ou você já usa outra solução para apresentar a empresa?" },
  { id: "pensar", objecao: "Preciso pensar", resposta: "Claro, é importante avaliar com calma. Posso enviar a prévia e combinar um retorno breve em um dia e horário que sejam bons para você? Assim você analisa sem compromisso." },
  { id: "material", objecao: "Mande o material primeiro", resposta: "Perfeito. Vou enviar a prévia neste WhatsApp para você conhecer a proposta. Depois disso, qual seria um bom dia e horário para eu ouvir sua opinião?" },
  { id: "sem-tempo", objecao: "Agora não tenho tempo", resposta: "Sem problema. Posso ser bem breve ou retornar em outro momento. Qual dia e horário são mais tranquilos para você?" },
  { id: "mensalidade", objecao: "Tem mensalidade ou manutenção?", resposta: "Não há mensalidade obrigatória. O investimento apresentado é de R$ 500,00, pago uma única vez. Qualquer serviço adicional futuro só será feito se você solicitar e aprovar antes." },
  { id: "socio", objecao: "Preciso falar com meu sócio", resposta: "Com certeza. Posso enviar a prévia para vocês avaliarem juntos e deixar um retorno combinado. Quando vocês conseguiriam conversar sobre isso?" },
  { id: "confianca", objecao: "Como sei que é confiável?", resposta: "É uma preocupação justa. Primeiro envio a prévia para você avaliar o trabalho sem compromisso. Também podemos marcar uma apresentação para esclarecer o que será entregue antes de qualquer decisão." },
  { id: "outro-dia", objecao: "Entre em contato outro dia", resposta: "Claro. Para eu respeitar sua rotina e não ligar em um momento ruim, qual dia e horário ficam melhores?" },
];

function copiar(texto: string, mensagem: string) {
  navigator.clipboard.writeText(texto);
  toast.success(mensagem);
}

function objecoesValidas(value: unknown): Objecao[] {
  if (!Array.isArray(value)) return OBJECOES_PADRAO.map((item) => ({ ...item }));
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<Objecao>;
    if (typeof candidate.objecao !== "string" || typeof candidate.resposta !== "string") return [];
    return [{ id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(), objecao: candidate.objecao, resposta: candidate.resposta }];
  });
}

export function ScriptVendasDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [script, setScript] = useState(SCRIPT_VENDAS_PADRAO);
  const [objecoes, setObjecoes] = useState<Objecao[]>(OBJECOES_PADRAO);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    let ativo = true;
    setCarregando(true);
    supabase
      .from("google_maps_scripts_usuario")
      .select("script_texto, objecoes")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        setCarregando(false);
        if (error) {
          toast.error("Não foi possível carregar seu script");
          return;
        }
        const row = data as ScriptUsuarioRow | null;
        setScript(row?.script_texto || SCRIPT_VENDAS_PADRAO);
        setObjecoes(row ? objecoesValidas(row.objecoes) : OBJECOES_PADRAO.map((item) => ({ ...item })));
      });
    return () => { ativo = false; };
  }, [open, user]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return objecoes.map((item, index) => ({ item, index }));
    return objecoes
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => `${item.objecao} ${item.resposta}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, objecoes]);

  function atualizarObjecao(index: number, campo: "objecao" | "resposta", valor: string) {
    setObjecoes((atuais) => atuais.map((item, itemIndex) => itemIndex === index ? { ...item, [campo]: valor } : item));
  }

  function adicionarObjecao() {
    setObjecoes((atuais) => [...atuais, { id: crypto.randomUUID(), objecao: "", resposta: "" }]);
  }

  async function salvar() {
    if (!user) return;
    const limpas = objecoes.filter((item) => item.objecao.trim() || item.resposta.trim());
    if (!script.trim()) {
      toast.error("O script não pode ficar vazio");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("google_maps_scripts_usuario").upsert({
      user_id: user.id,
      script_texto: script.trim(),
      objecoes: limpas as unknown as Json,
      atualizado_em: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar seu script");
      return;
    }
    setObjecoes(limpas);
    toast.success("Script e objeções salvos");
  }

  async function restaurar() {
    if (!user) return;
    setSalvando(true);
    const { error } = await supabase.from("google_maps_scripts_usuario").delete().eq("user_id", user.id);
    setSalvando(false);
    setConfirmarRestauracao(false);
    if (error) {
      toast.error("Não foi possível restaurar o padrão");
      return;
    }
    setScript(SCRIPT_VENDAS_PADRAO);
    setObjecoes(OBJECOES_PADRAO.map((item) => ({ ...item })));
    setBusca("");
    toast.success("Conteúdo padrão restaurado");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline"><BookOpenText className="mr-2 h-4 w-4" />Script</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Script de vendas</DialogTitle>
            <DialogDescription>Seu roteiro pessoal para ligações e respostas às objeções mais comuns.</DialogDescription>
          </DialogHeader>

          {carregando ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Tabs defaultValue="script">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="script">Script de ligação</TabsTrigger>
                <TabsTrigger value="objecoes">Objeções e respostas</TabsTrigger>
              </TabsList>
              <TabsContent value="script" className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="script-vendas-texto">Roteiro</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => copiar(script, "Script copiado")}>
                    <Clipboard className="mr-2 h-4 w-4" />Copiar
                  </Button>
                </div>
                <Textarea id="script-vendas-texto" value={script} onChange={(event) => setScript(event.target.value)} className="min-h-[430px] resize-y text-sm leading-relaxed" />
              </TabsContent>
              <TabsContent value="objecoes" className="space-y-4 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar objeção ou resposta" className="pl-9" />
                  </div>
                  <Button type="button" variant="outline" onClick={adicionarObjecao}><Plus className="mr-2 h-4 w-4" />Adicionar objeção</Button>
                </div>
                <div className="space-y-3">
                  {filtradas.map(({ item, index }) => (
                    <div key={item.id} className="space-y-3 rounded-md border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`objecao-${item.id}`}>Objeção do cliente</Label>
                          <Textarea id={`objecao-${item.id}`} value={item.objecao} onChange={(event) => atualizarObjecao(index, "objecao", event.target.value)} className="min-h-24" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`resposta-${item.id}`}>Resposta sugerida</Label>
                          <Textarea id={`resposta-${item.id}`} value={item.resposta} onChange={(event) => atualizarObjecao(index, "resposta", event.target.value)} className="min-h-24" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => copiar(item.resposta, "Resposta copiada")} disabled={!item.resposta.trim()}><Clipboard className="mr-2 h-4 w-4" />Copiar resposta</Button>
                        <Button type="button" size="icon" variant="ghost" title="Remover objeção" onClick={() => setObjecoes((atuais) => atuais.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {!filtradas.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma objeção encontrada.</p>}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setConfirmarRestauracao(true)} disabled={carregando || salvando}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button>
            <Button type="button" onClick={salvar} disabled={carregando || salvando}>{salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarRestauracao} onOpenChange={setConfirmarRestauracao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar o conteúdo padrão?</AlertDialogTitle>
            <AlertDialogDescription>Seu script personalizado e suas objeções serão substituídos pelo conteúdo original.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={restaurar}>Restaurar padrão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}