# Inbox Meta: abrir sempre na caixa Padrão

## Problema
Ao recarregar o Inbox Meta Oficial, a caixa selecionada aparece como AMARAL em vez da caixa Padrão.

## Causa
A tela já inicia com a caixa Padrão selecionada, mas a permissão de ver a caixa Padrão só é conhecida depois de uma consulta ao backend. Enquanto essa consulta não retorna, a permissão é tratada como "não pode ver Padrão", e uma regra de segurança troca automaticamente a seleção para a primeira caixa da lista (AMARAL, em ordem alfabética). Depois disso a seleção não volta sozinha.

## Correção
- Só aplicar a troca automática de caixa depois que a verificação de permissão terminar (marcar a permissão como "ainda carregando" até a resposta chegar).
- Manter a regra de segurança intacta: quem realmente não tem acesso à caixa Padrão continua caindo na primeira caixa permitida.
- Resultado: ao atualizar a página, quem tem acesso abre sempre na caixa Padrão.

## Detalhes técnicos
Em `src/pages/InboxMeta.tsx`: mudar `podeVerPadrao` para um estado com três situações (indefinido/true/false) ou adicionar um flag `padraoVerificado`, e sair antecipadamente do efeito de fallback (linhas ~452-461) enquanto a verificação não estiver concluída. Nenhuma mudança de banco de dados.
