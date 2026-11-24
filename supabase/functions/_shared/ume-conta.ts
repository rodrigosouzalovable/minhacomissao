// Qual conta UME cada operação usa. A conta padrão (Souza e Ribeiro) vale para todos,
// exceto parceiros Meta com conta própria: eles e os números deles usam só a conta deles.
import { THIAGO_NOGUEIRA_USER_ID } from './thiago-meta-override.ts';
import type { UmeAmbiente, UmeAlvo, UmeConta } from './ume-api.ts';
import { alvoConta } from './ume-api.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

export const CONTA_UME_POR_PARCEIRO: Record<string, UmeConta> = {
  [THIAGO_NOGUEIRA_USER_ID]: 'amaral',
};

/** Conta pelo usuário (atendente/parceiro). Sem mapeamento ou sem a tag parceiro => padrão. */
export async function contaUmeDoUsuario(db: Db, userId: string | null | undefined): Promise<UmeConta> {
  const conta = userId ? CONTA_UME_POR_PARCEIRO[userId] : undefined;
  if (!conta) return 'padrao';
  const { data } = await db.from('user_permissions').select('parceiro_meta').eq('user_id', userId).maybeSingle();
  return data?.parceiro_meta === true ? conta : 'padrao';
}

/** Conta pelo número que recebeu a conversa (IAGO): número de parceiro => conta do parceiro. */
export async function contaUmeDaInstancia(db: Db, instanciaId: string | null | undefined): Promise<UmeConta> {
  if (!instanciaId) return 'padrao';
  const parceiros = Object.keys(CONTA_UME_POR_PARCEIRO);
  const { data } = await db.from('meta_instance_parceiros').select('user_id')
    .eq('instancia_id', instanciaId).in('user_id', parceiros).limit(1);
  const dono = data?.[0]?.user_id as string | undefined;
  return dono ? contaUmeDoUsuario(db, dono) : 'padrao';
}

export const alvoUme = (amb: UmeAmbiente, conta: UmeConta, token?: string | null): UmeAlvo =>
  token ? { amb, token, conta } : alvoConta(amb, conta);
