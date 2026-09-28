# Ativar todas as instâncias permitidas no pool

## Objetivo
Adicionar no cabeçalho da janela **Instâncias**, dentro de **Envio Meta**, o botão **Ativar pool**.

## Comportamento
- Exibir o botão somente para administradores e Parceiros Meta, mantendo as permissões atuais.
- Ao clicar, pedir uma única confirmação antes da ativação em massa.
- Tentar ativar todas as instâncias que o usuário tem permissão para administrar, inclusive as retiradas manualmente.
- Nas retiradas manualmente, verificar primeiro a saúde atual na Meta, como já ocorre na ativação individual.
- Processar cada instância de forma independente: uma falha não interrompe as demais.
- Manter fora do pool qualquer instância recusada pelas regras atuais, como desconexão, qualidade inadequada, bloqueio, quarentena ou pausa ativa.
- Ao terminar, atualizar a lista e mostrar um resumo com quantas foram ativadas, quantas já estavam ativas e quantas falharam.
- Desabilitar o botão e mostrar carregamento enquanto o processamento estiver em andamento, evitando cliques duplicados.

## Detalhes técnicos
- Reutilizar a verificação de saúde e a operação segura já existentes para ativação individual, sem afrouxar as validações do banco.
- Para Parceiros Meta, limitar o lote às instâncias vinculadas ao próprio usuário; administradores podem processar todas as instâncias carregadas.
- Não criar rotina automática, consulta periódica ou novo agendamento; a ação ocorre somente ao clique, sem aumento recorrente de custo.
- Validar o resultado na janela de Instâncias e conferir a compilação da aplicação.
