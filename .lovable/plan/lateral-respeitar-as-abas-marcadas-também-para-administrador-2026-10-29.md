# Lateral respeitar as abas marcadas também para administradores

## Problema
Hoje, quem é administrador vê todas as abas na lateral, sem olhar as caixas marcadas em Usuários > Permissões. Por isso as abas desmarcadas do seu login continuam aparecendo.

## O que muda
- A lateral passa a mostrar, também para administradores, somente as abas marcadas nas permissões do próprio login.
- A aba **Usuários** sempre continua visível para administradores, mesmo desmarcada, para você nunca ficar sem acesso para reativar as outras.
- Se o login de um administrador não tiver nenhuma lista de abas salva, continua vendo tudo (como hoje), para não esconder nada de quem nunca configurou.
- Nenhuma outra regra muda: os poderes de administrador (editar, excluir, ver equipe) continuam iguais; só a lista da lateral é afetada. Campanhas continua seguindo sua própria opção.

## Detalhes técnicos
- `src/components/layout/AppLayout.tsx`, `filteredNavItems`: trocar `if (isAdmin) return true` por: se `isAdmin` e `abasPermitidas` existir, retornar `abasPermitidas.includes(item.href) || item.href === '/admin/usuarios'`; caso sem lista, manter `true`.
- Confirmar o caminho exato da aba Usuários no `navItems` antes de editar.
