import { supabase } from '@/integrations/supabase/client';
import { getEmpresaLabel, type EmpresaAcordo } from '@/lib/empresaLabels';

export type CredorCpfResultado =
  | { tipo: 'unico'; empresa: EmpresaAcordo; mensagem: string }
  | { tipo: 'ambiguo'; empresas: EmpresaAcordo[]; mensagem: string }
  | { tipo: 'nenhum'; mensagem: string };

const VALIDAS: EmpresaAcordo[] = ['ume_novo_mundo', 'mundo_da_moda', 'odres_cred'];

export function decidirCredor(lista: string[] | null | undefined): CredorCpfResultado {
  const empresas = VALIDAS.filter((e) => (lista || []).includes(e));
  if (empresas.length === 1) {
    return { tipo: 'unico', empresa: empresas[0], mensagem: `Credor identificado pela base SFTP: ${getEmpresaLabel(empresas[0])}` };
  }
  if (empresas.length > 1) {
    return { tipo: 'ambiguo', empresas, mensagem: `CPF encontrado em mais de um credor (${empresas.map(getEmpresaLabel).join(', ')}). Selecione o credor correto.` };
  }
  return { tipo: 'nenhum', mensagem: 'CPF não encontrado na base; selecione o credor.' };
}

export async function identificarCredorPorCpf(cpf: string): Promise<CredorCpfResultado | null> {
  const { data, error } = await supabase.rpc('identificar_credor_por_cpf' as any, { p_cpf: cpf });
  if (error) return null;
  return decidirCredor(data as string[]);
}

import { useEffect, useState } from 'react';

/** Consulta o credor ao completar o CPF e marca automaticamente se ainda não houver credor escolhido. */
export function useCredorPorCpf(
  cpf: string,
  empresa: EmpresaAcordo | null,
  setEmpresa: (e: EmpresaAcordo) => void,
) {
  const [resultado, setResultado] = useState<CredorCpfResultado | null>(null);
  const digitos = (cpf || '').replace(/\D/g, '');
  useEffect(() => {
    if (digitos.length !== 11) { setResultado(null); return; }
    let ativo = true;
    identificarCredorPorCpf(digitos).then((r) => {
      if (!ativo || !r) return;
      setResultado(r);
      if (r.tipo === 'unico' && !empresa) setEmpresa(r.empresa);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitos]);
  let aviso: { texto: string; tom: 'ok' | 'alerta' | 'info' } | null = null;
  if (resultado?.tipo === 'unico') {
    aviso = empresa && empresa !== resultado.empresa
      ? { texto: `${resultado.mensagem}. O credor selecionado é diferente — confira.`, tom: 'alerta' }
      : { texto: resultado.mensagem, tom: 'ok' };
  } else if (resultado?.tipo === 'ambiguo') aviso = { texto: resultado.mensagem, tom: 'alerta' };
  else if (resultado?.tipo === 'nenhum') aviso = { texto: resultado.mensagem, tom: 'info' };
  return aviso;
}
