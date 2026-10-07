export const TEMPLATE_CADASTRAL = 'fins_de_atualizacao_cadastral';
export const AGRADECIMENTO_CADASTRAL = 'Obrigado pela confirmação';
export const REPOSICAO_CADASTRAL = 100;
export const ORIGEM_CADASTRAL = 'recuperacao_cadastral';
export function nomeEmpresaValido(nome: unknown): string | null {
  const valor = String(nome || '').replace(/\s+/g, ' ').trim();
  if (valor.length < 3 || valor.length > 200 || /^(user-|inst[aâ]ncia|chip|ld\s*\d|thiago\s*\d|iphone|android|samsung|motorola|xiaomi|celular|teste)/i.test(valor)) return null;
  return valor;
}
export function valoresCadastrais(nome: unknown): [string, string] {
  const empresa = nomeEmpresaValido(nome);
  if (!empresa) throw new Error('Nome empresarial confiável obrigatório');
  return ['tudo bem?', empresa];
}
export function templateCadastralValido(tpl: { name?: string; categoria?: string; params?: { chaves: string[] }; body?: string } | null): boolean {
  return tpl?.name === TEMPLATE_CADASTRAL && tpl.categoria === 'UTILITY' && JSON.stringify(tpl.params?.chaves) === JSON.stringify(['1', '2']);
}
export function respostaCadastral(texto: unknown): 'confirmacao' | 'saida' | 'negativa' | 'outra' {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.,!]/g, '').replace(/\s+/g, ' ').trim();
  if (/^(sair|sair da lista|nao quero mais receber|pare de me enviar mensagens)$/.test(t)) return 'saida';
  if (/^(nao|nao confirmo|numero errado|nao e aqui)$/.test(t)) return 'negativa';
  if (/^(sim|sim confirmo|confirmo|sim somos nos|sim e aqui|isso mesmo|correto|exatamente)$/.test(t)) return 'confirmacao';
  return 'outra';
}