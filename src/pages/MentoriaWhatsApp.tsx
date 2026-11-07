import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDown, GraduationCap } from "lucide-react";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DORES = [
  ["Mensalidades caras de plataformas", "Sistema próprio, sem mensalidade para intermediários."],
  ["Números bloqueados em APIs não oficiais", "Migração para a API Oficial da Meta com histórico preservado."],
  ["Travas na verificação da BM e limites de envio", "Passo a passo de verificação e escalada de tier (1k → 10k → 100k)."],
  ["Templates reprovados", "Modelos Utility que aprovam e custam menos."],
  ["Qualidade caindo (YELLOW/RED)", "Rodízio de números, teto diário e intervalos seguros."],
];

const SEMANAS = [
  ["Semana 1 — Fundação", "Criação/verificação da Business Manager, cadastro de números, cartão e domínio, ativação da API Oficial."],
  ["Semana 2 — Templates e custos", "Criação de templates Utility e Marketing, aprovação, tabela de custos por mensagem e estratégia de economia."],
  ["Semana 3 — Sistema de disparos", "Implantação do sistema próprio: campanhas, rodízio entre números, importação de planilhas e caixa de atendimento."],
  ["Semana 4 — Escala e proteção", "Saúde dos números, recuperação de qualidade, limites diários, automação de respostas e relatórios."],
];

const CHECKLIST = [
  "Business Manager verificada com CNPJ e domínio",
  "Forma de pagamento cadastrada na BM do cliente",
  "Números novos (sem WhatsApp comum) para a API Oficial",
  "Aplicativo Meta e token permanente configurados",
  "Webhook recebendo mensagens e status",
  "Templates Utility aprovados",
  "Sistema implantado na nuvem do próprio cliente",
  "Equipe treinada no Inbox e nas campanhas",
];

const SCRIPT = `Olá, [nome]! Vi que a [empresa] trabalha com alto volume de WhatsApp.
Hoje vocês pagam plataforma ou agência para disparar? Eu opero mais de 200 números na API Oficial e ensino sua equipe a fazer o mesmo, entregando um sistema próprio de disparos — sem mensalidade para intermediários.
Posso te mostrar em 15 minutos quanto vocês economizariam em 12 meses?`;

const PASSOS = [
  "Defina o público: cobrança, varejo, imobiliárias, consignado e infoprodutos.",
  "Monte 3 cases com números reais da sua operação (volume, custo, recuperação).",
  "Prospecte 10 empresas por dia via LinkedIn/WhatsApp com o script.",
  "Faça a reunião de 15 min mostrando a calculadora de economia.",
  "Envie a proposta em PDF no mesmo dia.",
  "Feche com contrato: escopo de 4 semanas + 30 dias de suporte.",
  "Implante o sistema na infraestrutura do cliente (custos de nuvem e Meta são dele).",
  "Colete depoimento e suba o preço após 3 cases.",
];

export default function MentoriaWhatsApp() {
  const [mensalAtual, setMensalAtual] = useState(2500);
  const [investimento, setInvestimento] = useState(6000);
  const [p, setP] = useState({
    empresa: "", responsavel: "", cnpj: "", telefone: "",
    valorVista: "5000", valorParcelado: "7000", parcelas: "10",
    pix: "", validade: "7", obs: "",
  });
  const set = (k: keyof typeof p) => (e: any) => setP({ ...p, [k]: e.target.value });

  const roi = useMemo(() => {
    const m = Math.max(0, mensalAtual);
    return {
      e6: m * 6 - investimento, e12: m * 12 - investimento, e24: m * 24 - investimento,
      payback: m > 0 ? investimento / m : 0,
    };
  }, [mensalAtual, investimento]);

  const gerarPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 18;
    let y = 0;
    const azul: [number, number, number] = [15, 76, 129];
    const novaPagina = () => { doc.addPage(); y = 20; };
    const garantir = (h: number) => { if (y + h > 280) novaPagina(); };
    const titulo = (t: string) => {
      garantir(14); y += 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...azul);
      doc.text(t, M, y); y += 2; doc.setDrawColor(...azul); doc.line(M, y, W - M, y); y += 6;
      doc.setTextColor(40); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    };
    const par = (t: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const linhas = doc.splitTextToSize(t, W - 2 * M);
      garantir(linhas.length * 5); doc.text(linhas, M, y); y += linhas.length * 5 + 1;
    };

    doc.setFillColor(...azul); doc.rect(0, 0, W, 42, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Proposta Comercial", M, 20);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text("Mentoria API Oficial do WhatsApp + Sistema Próprio de Disparos", M, 30);
    doc.setFontSize(9); doc.text(`Emitida em ${new Date().toLocaleDateString("pt-BR")} • Válida por ${p.validade} dias`, M, 37);
    y = 54; doc.setTextColor(40);

    titulo("Cliente");
    par(`Empresa: ${p.empresa || "-"}`); par(`Responsável: ${p.responsavel || "-"}`);
    par(`CNPJ: ${p.cnpj || "-"}    Telefone: ${p.telefone || "-"}`);

    titulo("O que você recebe");
    par("Liberdade operacional: sua equipe passa a operar a API Oficial da Meta e você recebe um sistema próprio de disparos, sem pagar mensalidade para agências ou plataformas intermediárias.");
    DORES.forEach(([d, s]) => par(`• ${d}: ${s}`));

    titulo("Cronograma de 4 semanas");
    SEMANAS.forEach(([t, d]) => { par(t, true); par(d); });

    titulo("Entregáveis");
    CHECKLIST.forEach(c => par(`• ${c}`));
    par("• 30 dias de suporte após a entrega.");

    titulo("Economia estimada");
    par(`Gasto mensal atual informado: ${brl(mensalAtual)}`);
    par(`Economia líquida em 12 meses: ${brl(roi.e12)}    Em 24 meses: ${brl(roi.e24)}`);
    par(`Retorno do investimento em aproximadamente ${roi.payback.toFixed(1)} meses.`);

    titulo("Investimento");
    par(`À vista: ${brl(Number(p.valorVista) || 0)}`, true);
    par(`Parcelado: ${brl(Number(p.valorParcelado) || 0)} em até ${p.parcelas}x de ${brl((Number(p.valorParcelado) || 0) / (Number(p.parcelas) || 1))}`, true);
    if (p.pix) par(`Chave PIX para fechamento: ${p.pix}`);

    titulo("Condições");
    par("• O custo por mensagem é cobrado diretamente pela Meta no cartão da Business Manager do cliente.");
    par("• O sistema é implantado na infraestrutura em nuvem do próprio cliente; custos de servidor são do cliente.");
    par("• Acompanhamento de 4 semanas + 30 dias de suporte. Suporte adicional mediante novo contrato.");
    if (p.obs) { titulo("Observações"); par(p.obs); }

    garantir(30); y += 16;
    doc.line(M, y, M + 70, y); doc.line(W - M - 70, y, W - M, y); y += 5;
    doc.setFontSize(9); doc.text("Contratante", M, y); doc.text("Contratada", W - M - 70, y);

    doc.save(`Proposta_Mentoria_${(p.empresa || "cliente").replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <AppLayout>
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Mentoria WhatsApp API Oficial</h1>
          <p className="text-sm text-muted-foreground">Playbook, calculadora de economia e gerador de proposta</p>
        </div>
      </div>

      <Tabs defaultValue="playbook">
        <TabsList>
          <TabsTrigger value="playbook">Passo a passo</TabsTrigger>
          <TabsTrigger value="roi">Calculadora</TabsTrigger>
          <TabsTrigger value="proposta">Proposta PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="playbook" className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Como começar a vender</CardTitle></CardHeader>
            <CardContent><ol className="list-decimal space-y-2 pl-5 text-sm">{PASSOS.map(s => <li key={s}>{s}</li>)}</ol></CardContent></Card>
          <Card><CardHeader><CardTitle>Script de abordagem</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-line text-sm">{SCRIPT}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigator.clipboard.writeText(SCRIPT)}>Copiar</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Dores e como resolver</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{DORES.map(([d, s]) => <p key={d}><strong>{d}:</strong> {s}</p>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Cronograma da mentoria</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{SEMANAS.map(([t, d]) => <p key={t}><strong>{t}:</strong> {d}</p>)}</CardContent></Card>
          <Card className="md:col-span-2"><CardHeader><CardTitle>Checklist de implantação</CardTitle></CardHeader>
            <CardContent><ul className="grid list-disc gap-1 pl-5 text-sm md:grid-cols-2">{CHECKLIST.map(c => <li key={c}>{c}</li>)}</ul></CardContent></Card>
        </TabsContent>

        <TabsContent value="roi">
          <Card><CardHeader><CardTitle>Economia do cliente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Quanto o cliente paga hoje por mês (plataforma/agência)</Label>
                  <Input type="number" value={mensalAtual} onChange={e => setMensalAtual(Number(e.target.value))} /></div>
                <div><Label>Valor da mentoria</Label>
                  <Input type="number" value={investimento} onChange={e => setInvestimento(Number(e.target.value))} /></div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {[["6 meses", roi.e6], ["12 meses", roi.e12], ["24 meses", roi.e24]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Economia em {l}</p><p className="text-lg font-bold">{brl(v as number)}</p></div>
                ))}
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Retorno em</p><p className="text-lg font-bold">{roi.payback.toFixed(1)} meses</p></div>
              </div>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="proposta">
          <Card><CardHeader><CardTitle>Dados da proposta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Empresa</Label><Input value={p.empresa} onChange={set("empresa")} /></div>
                <div><Label>Responsável</Label><Input value={p.responsavel} onChange={set("responsavel")} /></div>
                <div><Label>CNPJ</Label><Input value={p.cnpj} onChange={set("cnpj")} /></div>
                <div><Label>Telefone</Label><Input value={p.telefone} onChange={set("telefone")} /></div>
                <div><Label>Valor à vista (R$)</Label><Input type="number" value={p.valorVista} onChange={set("valorVista")} /></div>
                <div><Label>Valor parcelado (R$)</Label><Input type="number" value={p.valorParcelado} onChange={set("valorParcelado")} /></div>
                <div><Label>Nº de parcelas</Label><Input type="number" value={p.parcelas} onChange={set("parcelas")} /></div>
                <div><Label>Validade (dias)</Label><Input type="number" value={p.validade} onChange={set("validade")} /></div>
                <div className="md:col-span-2"><Label>Chave PIX</Label><Input value={p.pix} onChange={set("pix")} /></div>
                <div className="md:col-span-2"><Label>Observações</Label><Textarea value={p.obs} onChange={set("obs")} /></div>
              </div>
              <p className="text-xs text-muted-foreground">A economia da aba Calculadora entra automaticamente na proposta.</p>
              <Button onClick={gerarPdf}><FileDown className="mr-2 h-4 w-4" />Gerar proposta PDF</Button>
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}
