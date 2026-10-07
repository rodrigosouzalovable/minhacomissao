import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ShieldCheck, MessageCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PortalBrands, PortalShell } from './PortalShell';
import { validPortalCpf } from '@/lib/portalNegotiation';

const faqs = [
  ['Quais dívidas posso consultar?', 'O portal reúne consultas de Novo Mundo, UME e Odres Cred atendidas pela Souza e Ribeiro Advogados. As informações e condições aparecem separadas por credor.'],
  ['As condições são iguais para todos os credores?', 'Não. Novo Mundo mantém as condições da sua carteira. Para UME e Odres Cred, quando o principal sem juros estiver confirmado, o pagamento à vista usa esse valor e o parcelamento acrescenta 10%, com até 18 parcelas de no mínimo R$ 100.'],
  ['Tenho dívidas com mais de um credor. Como negociar?', 'Cada carteira aparece separadamente. Escolha o credor e a condição desejada. Sua mensagem para o atendimento identifica qual dívida você quer negociar.'],
  ['Já tenho um acordo. Ele aparece na consulta?', 'Os acordos disponíveis são apresentados na carteira correspondente, com suas parcelas e situação de pagamento. Para informações ou alterações, fale com a equipe pelo canal oficial.'],
  ['A consulta gera um acordo automaticamente?', 'Não. A simulação permite solicitar atendimento pelo WhatsApp. A equipe confirma as condições e orienta a formalização do acordo e a emissão do boleto.'],
  ['Não encontrei minha dívida. O que fazer?', 'Entre em contato pelo canal oficial. Se uma consulta estiver temporariamente indisponível, o portal informa essa situação: indisponibilidade não significa ausência de dívida.'],
];

export default function PublicPortalHome() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Libre+Baskerville:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
  const [cpf, setCpf] = useState('');
  const [touched, setTouched] = useState(false);
  const navigate = useNavigate();
  const digits = cpf.replace(/\D/g, '').slice(0, 11);
  const valid = validPortalCpf(digits);
  const changeCpf = (value: string) => { const d = value.replace(/\D/g,'').slice(0,11); setCpf(d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4')); };
  return <PortalShell home><main>
    <section className="portal-home-consultation px-5 sm:px-8 text-center">
      <div className="max-w-3xl mx-auto">
        <p className="portal-eyebrow mb-5">PORTAL DE NEGOCIAÇÃO</p>
        <h1 className="text-3xl sm:text-5xl leading-tight">Consulte suas dívidas</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mt-5 leading-relaxed">Novo Mundo, UME e Odres Cred.<br />Suas dívidas organizadas em um só lugar, com atendimento da Souza e Ribeiro Advogados.</p>
        <div className="portal-home-creditors mx-auto mt-7"><PortalBrands /></div>
        <form className="max-w-xl mx-auto mt-7 text-left" onSubmit={e=>{e.preventDefault();setTouched(true);if(valid)navigate(`/consulta/novomundo/${digits}`);}}>
          <Label htmlFor="cpf" className="text-sm font-medium">Seu CPF</Label>
          <div className="flex flex-col sm:flex-row gap-3 mt-2"><Input id="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={e=>changeCpf(e.target.value)} onBlur={()=>setTouched(true)} aria-invalid={touched && !valid} aria-describedby="cpf-status" className="portal-home-cpf h-14 text-lg" /><Button type="submit" className="h-14 shrink-0 px-6 text-base" disabled={!valid}><Search className="w-4 h-4 mr-2" />Consultar dívidas</Button></div>
          <p id="cpf-status" className={`text-xs mt-3 text-center ${touched && digits.length > 0 && !valid ? 'text-destructive' : 'text-muted-foreground'}`}>{touched && digits.length > 0 && !valid ? 'Confira o CPF informado antes de consultar.' : 'Consulte somente seu CPF ou de pessoa que autorizou a consulta.'}</p>
        </form>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-5"><ShieldCheck className="w-4 h-4 text-primary shrink-0" />Atendimento pelos canais oficiais do escritório.</div>
      </div>
    </section>
    <section className="portal-home-light border-y bg-card"><div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid md:grid-cols-3 gap-8">{[{icon:Search,title:'Consulte seu CPF',text:'Confira as carteiras disponíveis para negociação.'},{icon:FileText,title:'Confira cada credor',text:'Veja valores, contratos e acordos sem misturar suas dívidas.'},{icon:MessageCircle,title:'Escolha sua proposta',text:'Converse com a equipe para confirmar as condições e solicitar o boleto.'}].map((s,i)=><div key={s.title} className="flex gap-4"><span className="text-primary font-semibold text-lg pt-1">0{i+1}</span><div><s.icon className="w-5 h-5 text-primary mb-3" /><h2 className="font-semibold">{s.title}</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.text}</p></div></div>)}</div></section>
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-14 grid md:grid-cols-[1fr_1.3fr] gap-8"><div><p className="portal-eyebrow mb-3">QUEM SOMOS</p><h2 className="text-2xl leading-relaxed">Souza e Ribeiro Advogados</h2></div><p className="text-muted-foreground leading-relaxed">A Souza e Ribeiro Advogados oferece atendimento para negociação de débitos de Novo Mundo, UME e Odres Cred. Consulte as informações disponíveis da sua carteira e escolha uma condição de pagamento para conversar com nossa equipe.</p></section>
    <section className="portal-home-light border-t"><div className="max-w-3xl mx-auto px-5 sm:px-8 py-14"><h2 className="text-2xl mb-6">Dúvidas frequentes</h2><Accordion type="single" collapsible>{faqs.map(([q,a],i)=><AccordionItem value={String(i)} key={q}><AccordionTrigger className="text-left">{q}</AccordionTrigger><AccordionContent className="text-muted-foreground leading-relaxed">{a}</AccordionContent></AccordionItem>)}</Accordion><Button variant="ghost" className="mt-6 px-0 text-primary" onClick={()=>{document.getElementById('cpf')?.focus();document.getElementById('cpf')?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>Consultar meu CPF<ArrowRight className="w-4 h-4 ml-2" /></Button></div></section>
  </main></PortalShell>;
}