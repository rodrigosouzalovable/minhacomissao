import { Link } from 'react-router-dom';
import { Phone, Lock, ArrowUpRight, ShieldCheck, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { useContatoPortal } from '@/hooks/useContatoPortal';
import logoSouza from '@/assets/logo-souza-ribeiro.png';
import { CREDOR_MARCAS_LISTA } from '@/lib/credorMarcas';
import novoHome from '@/assets/logo-novo-mundo-portal.png.asset.json';
import umeHome from '@/assets/ume-home-white.jpg';
import odresHome from '@/assets/odres-home-white.png.asset.json';

const portalAssetUrl = (url: string) => new URL(url, 'https://meusacordos.com.br').href;
const homeLogos = { novo_mundo: portalAssetUrl(novoHome.url), ume: umeHome, odres_cred: portalAssetUrl(odresHome.url) };
const homeLinks = [['beneficios', 'Benefícios'], ['quem-somos', 'Quem somos'], ['como-funciona', 'Como funciona'], ['duvidas', 'Dúvidas']];

export function PortalBrands({ home = false }: { home?: boolean }) {
  return <div className="portal-brands" aria-label="Credores atendidos">{CREDOR_MARCAS_LISTA.map(m => <div key={m.slug} className={`portal-brand portal-brand-${m.slug}`}><img src={home ? homeLogos[m.slug] : m.logo} alt={m.nome} /><span>{m.nome}</span></div>)}</div>;
}

export function PortalShell({ children, home = false }: { children: React.ReactNode; home?: boolean }) {
  const contato = useContatoPortal();
  return <div className={`portal-public ${home ? 'portal-home' : ''} min-h-screen flex flex-col bg-background text-foreground`}>
    <header className="border-b bg-card"><div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
      <Link to="/novomundo" className="flex items-center gap-3 min-w-0"><img src={logoSouza} alt={home ? "Souza e Ribeiro Sociedade de Advogados" : ""} className={home ? "portal-home-office-logo" : "portal-office-logo"} />{!home && <span className="font-semibold text-base sm:text-lg leading-tight">Souza e Ribeiro<span className="block text-xs font-normal text-muted-foreground tracking-widest mt-1">ADVOGADOS</span></span>}</Link>
      <div className="flex items-center gap-2">
        {home && <><nav aria-label="Navegação do portal" className="hidden lg:flex items-center gap-1">{homeLinks.map(([id, label]) => <Button key={id} asChild variant="ghost" className="px-3 text-sm"><a href={`#${id}`}>{label}</a></Button>)}</nav><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu"><Menu className="w-5 h-5" /></Button></SheetTrigger><SheetContent><SheetTitle>Portal de Negociação</SheetTitle><SheetDescription className="sr-only">Navegação da página inicial</SheetDescription><nav className="flex flex-col gap-3 mt-8" aria-label="Navegação móvel">{homeLinks.map(([id, label]) => <SheetClose key={id} asChild><Button asChild variant="ghost" className="justify-start"><a href={`#${id}`}>{label}</a></Button></SheetClose>)}<Button asChild variant="ghost" className="justify-start text-primary"><a href={`https://wa.me/${contato.phone}`} target="_blank" rel="noopener noreferrer"><Phone className="w-4 h-4 mr-2" />{contato.phoneDisplay}</a></Button></nav></SheetContent></Sheet></>}
        <Button asChild variant="ghost" className={`hidden sm:inline-flex ${home ? 'text-primary px-2' : ''}`}><a href={`https://wa.me/${contato.phone}`} target="_blank" rel="noopener noreferrer"><Phone className="w-4 h-4 mr-2" />{contato.phoneDisplay}</a></Button><Button asChild variant="ghost" size="icon"><Link to="/auth" aria-label="Área restrita" title="Área restrita"><Lock className="w-4 h-4" /></Link></Button></div>
    </div></header>
    {children}
    <footer className="border-t bg-card mt-auto"><div className="max-w-6xl mx-auto px-5 sm:px-8 py-10"><div className="flex flex-col sm:flex-row justify-between gap-8"><div><p className="font-semibold">Souza e Ribeiro Advogados</p><p className="text-sm text-muted-foreground mt-2">Atendimento para Novo Mundo, UME e Odres Cred.</p><p className="text-xs text-muted-foreground mt-4">CNPJ: 05.950.717/0001-18</p></div><div className="space-y-2 text-sm"><a className="flex items-center gap-2 text-primary" href={`https://wa.me/${contato.phone}`} target="_blank" rel="noopener noreferrer">{contato.phoneDisplay}<ArrowUpRight className="w-4 h-4" /></a><a className="block text-muted-foreground break-all" href={`mailto:${contato.email}`}>{contato.email}</a><div className="flex gap-4 pt-2"><Link to="/politica-de-privacidade" className="text-muted-foreground hover:text-foreground">Privacidade</Link><Link to="/antifraude" className="text-muted-foreground hover:text-foreground">Antifraude</Link></div></div></div><div className="border-t mt-8 pt-5 flex flex-wrap gap-3 justify-between text-xs text-muted-foreground"><span>© {new Date().getFullYear()} Souza e Ribeiro Advogados</span><span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Atendimento pelos canais oficiais</span></div></div></footer>
  </div>;
}