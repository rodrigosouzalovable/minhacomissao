// Rótulo legível de uma instância Meta para uso em notificações.
// Evita expor o UUID interno quando existe nome/telefone cadastrado.
export function rotuloInstancia(inst: any): string {
  if (!inst) return 'desconhecida';
  const nome = (inst.nome || '').toString().trim();
  const verificado = (inst.meta_verified_name || '').toString().trim();
  const telefone = (inst.display_phone || '').toString().trim();
  const phoneId = (inst.phone_number_id || '').toString().trim();

  const principal = nome || telefone || verificado || (phoneId ? `Phone ID ${phoneId}` : '') || inst.id || 'desconhecida';
  const sufixo = verificado && verificado !== principal ? ` (${verificado})` : '';
  return `${principal}${sufixo}`;
}
