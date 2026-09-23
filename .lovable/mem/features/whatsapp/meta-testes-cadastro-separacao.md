---
name: Instâncias Meta de teste — cadastro e separação
description: Usuários autorizados na UAZAPI cadastram testes Meta; TESTE automático, configuração inicial e isolamento total dos fluxos comerciais
type: feature
---

- Usuários autorizados na aba UAZAPI podem cadastrar uma instância Meta de teste informando nome, Phone Number ID, WABA ID e token permanente.
- O sistema valida na Meta que o número pertence à WABA, nunca devolve o token e salva a instância vinculada ao usuário solicitante.
- O nome recebe o prefixo `TESTE` automaticamente.
- Após o cadastro, executar pontualmente webhook, chamadas, sincronização de perfil e diagnóstico de conexão.
- Na API Oficial Meta, separar visualmente `Números de clientes` e `Números de teste`.
- Instâncias de teste são exclusivas da caixa AQUECIMENTO e devem permanecer fora de campanhas, cobrança, seletores comerciais, pool comercial, evolução de tier e recuperação comercial.