import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PORTAL_CREDORES, validPortalCpf, type PortalCredor, type PortalWallet } from '@/lib/portalNegotiation';
import { PortalShell } from './PortalShell';
import PortalWalletSection from './PortalWalletSection';

const initialWallet = (credor: PortalCredor): PortalWallet => ({credor,estado:'loading',nome:'',principal:null,principalValidado:false,debitos:[],acordos:[],faixas:[]});

export default function PublicPortalResults({ cpf }: { cpf: string }) {
  const valid = validPortalCpf(cpf);
  const [wallets,setWallets] = useState<PortalWallet[]>(()=>PORTAL_CREDORES.map(initialWallet));
  const load = useCallback(async (credor: PortalCredor, isCurrent: () => boolean = () => true) => {
    if(!valid) return;
    setWallets(prev=>prev.map(w=>w.credor===credor?initialWallet(credor):w));
    try {
      const { data,error } = await supabase.rpc('portal_consultar_carteira',{p_cpf:cpf,p_credor:credor});
      if(error) throw error;
      const result = data as unknown as PortalWallet;
      if(!result || result.credor!==credor || !Array.isArray(result.debitos) || !Array.isArray(result.acordos)) throw new Error('invalid_response');
      // Public live UME lookup remains disabled until its separate cost authorization.
      if(credor==='ume' && result.acordos.length===0) {
        result.estado='pending'; result.principalValidado=false; result.principal=null;
        result.mensagem='Para conferir o principal sem juros e as condições atualizadas da UME, fale com nossa equipe pelo WhatsApp.';
      }
      if(credor==='odres_cred' && result.debitos.length>0 && result.acordos.length===0) {
        result.principalValidado=false;
        result.mensagem='A equipe precisa confirmar o principal sem juros desta carteira antes de apresentar uma proposta. Fale conosco para conferir os valores.';
      }
      if(isCurrent())setWallets(prev=>prev.map(w=>w.credor===credor?result:w));
    } catch {
      if(isCurrent())setWallets(prev=>prev.map(w=>w.credor===credor?{...initialWallet(credor),estado:'error',mensagem:'Não foi possível consultar esta carteira agora. Tente novamente ou fale com nossa equipe. Isso não significa que não existe dívida.'}:w));
    }
  },[cpf,valid]);
  useEffect(()=>{let current=true;PORTAL_CREDORES.forEach(c=>{void load(c,()=>current);});return()=>{current=false;};},[load]);
  return <PortalShell><main className="max-w-4xl mx-auto w-full px-5 sm:px-8 pt-8 pb-16"><Button asChild variant="ghost" className="px-0 mb-8 text-primary"><Link to="/novomundo"><ArrowLeft className="w-4 h-4 mr-2" />Voltar à consulta</Link></Button><p className="portal-eyebrow mb-3">SUA CONSULTA</p><h1 className="text-3xl sm:text-4xl font-semibold">Débitos por credor</h1><p className="text-muted-foreground mt-3 text-sm">CPF {cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4')}</p>{!valid ? <p className="text-destructive mt-8">O CPF informado é inválido. Volte à consulta e confira o número.</p> : <><p className="text-muted-foreground mt-5 text-sm leading-relaxed max-w-xl">Confira cada carteira separadamente. Uma negociação em um credor não altera seus débitos nos outros.</p><div className="mt-5">{wallets.map(wallet=><PortalWalletSection key={`${cpf}-${wallet.credor}`} wallet={wallet} cpf={cpf} retry={()=>void load(wallet.credor)} />)}</div></>}</main></PortalShell>;
}