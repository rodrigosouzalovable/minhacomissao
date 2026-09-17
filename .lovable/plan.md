# Separar seleção da campanha e controle do pool

Na janela **Instâncias** do Envio Meta, marcar ou desmarcar uma caixa servirá somente para escolher quais números participarão da campanha atual. Essa ação não alterará mais o estado do pool.

## Comportamento

- **Checkbox da instância:** apenas adiciona ou remove o número da seleção da campanha, tanto para administrador quanto para Parceiro Meta.
- **Selecionar todas / Limpar seleção:** altera somente a seleção visível e nunca ativa ou desativa números no pool.
- **Botão por instância:** mostrar uma ação clara conforme o estado:
  - `Ativar Pool` quando estiver fora do pool, pausada ou aguardando ativação;
  - `Desativar Pool` quando estiver ativa.
- Ao desativar, a instância recebe o indicador **Fora do pool manualmente**, mas continua podendo ser marcada ou desmarcada normalmente na lista.
- Se uma campanha tentar iniciar com uma instância selecionada e fora do pool, a tela informará que ela precisa ser ativada antes do disparo, sem alterar a seleção do usuário.
- Instâncias que já ficaram com **Fora do pool manualmente** poderão ser recuperadas pelo novo botão `Ativar Pool`.

## Permissões e segurança

- Administradores poderão ativar ou desativar qualquer instância visível.
- Parceiros Meta poderão ativar ou desativar somente as instâncias vinculadas à própria conta.
- As permissões serão verificadas no banco; alterar o número da instância pela tela ou por chamada direta não permitirá controlar instâncias de outro parceiro.
- Ativar continuará respeitando a validação de saúde da Meta e bloqueios comerciais reais. Desativar será uma decisão manual e persistente até nova ativação.
- Usuários comuns continuarão sem acesso ao controle do pool.

## Implementação técnica

- Remover de `toggleInstancia` a chamada que hoje retira permanentemente a instância do pool ao desmarcar o checkbox.
- Manter `instanciaIds` como estado exclusivo da seleção da campanha, sem gravação no banco.
- Exibir o botão de pool nos dois estados para `isAdmin || parceiroMeta`, com confirmação antes de desativar.
- Criar uma operação protegida para desativação que aceite administrador ou Parceiro Meta proprietário, seguindo a mesma verificação de vínculo usada na ativação.
- Ajustar a ativação para permitir que o parceiro proprietário reverta a própria desativação manual após a validação saudável da Meta; o administrador mantém acesso global.
- Preservar o bloqueio para envio enquanto `pool_fora_manual = true`, sem bloquear a interação do checkbox.
- Validar os fluxos de administrador e parceiro: selecionar/desmarcar sem mudar o pool, desativar, reativar e iniciar campanha somente com números ativos.

## Custo do Cloud

Sem novo agendamento, repetição automática ou consulta periódica. A mudança usa apenas ações manuais e não deve gerar aumento relevante de custo.
