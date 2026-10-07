# Corrigir abertura de Instâncias do disparo

## Causa identificada no código
O botão alterna corretamente a abertura, mas um efeito também redefine o painel para o estado inicial sempre que a função de carregar instâncias muda. Essa função depende da lista de campanhas, que é atualizada durante o acompanhamento. Assim, as atualizações podem fechar novamente o painel que o usuário acabou de abrir.

## Correção
- Separar a abertura escolhida pelo usuário do carregamento e das atualizações da campanha.
- Aplicar o estado inicial somente ao trocar de campanha ou quando houver um pedido explícito de abertura, nunca por uma atualização dos contadores.
- Manter a lista aberta enquanto os dados são atualizados; fechar somente pelo clique do usuário.
- Preservar o carregamento, os estados de espera e a lista de instâncias ativas e ignoradas.
- Manter os acessos atuais: convidados podem abrir e consultar; reativação e demais controles continuam restritos aos responsáveis autorizados.

## Detalhes técnicos
- Ajustar o efeito e as dependências de `CampanhaInstanciasPanel`, sem alterar regras de acesso ou envio.
- Preservar a atualização ao vivo existente, sem adicionar consultas periódicas, canais ou agendamentos.
- Acrescentar indicação visual de expandir/recolher ao botão, mantendo sua identificação acessível.

## Validação
- Abrir o painel numa campanha em andamento e confirmar que permanece aberto após atualizações de progresso e dados.
- Fechar e abrir novamente, inclusive por teclado.
- Conferir a abertura inicialmente solicitada pelo diálogo e a troca entre campanhas.
- Verificar o acesso somente para visualização e garantir que abrir a lista não reative instâncias nem envie mensagens.
- Validar sem pausar, retomar ou alterar a campanha real.