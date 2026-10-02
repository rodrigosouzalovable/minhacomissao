# Blacklist nos contatos do Aquecimento Meta

## Resultado
- Adicionar uma ação **Blacklist** em cada linha de “Contatos com resposta automática”.
- Pedir confirmação antes do bloqueio e identificar claramente o telefone e a empresa.
- Após confirmar, registrar o telefone na blacklist existente pelo sufixo dos últimos 8 dígitos, com a origem “Aquecimento Meta · Google Maps”.
- Remover imediatamente o contato dessa lista e impedir que ele seja escolhido em futuros envios.
- Manter o contato disponível na página administrativa de Blacklist, onde um administrador poderá reativá-lo.

## Segurança e validação
- Fazer o registro por uma função autenticada no banco, restrita a administradores, sem permitir que a tela grave campos arbitrários.
- Tornar a ação idempotente: clicar novamente no mesmo número não cria duplicidade.
- Confirmar que o telefone bloqueado é excluído tanto do reaproveitamento automático quanto das campanhas futuras.
- Validar o botão, a confirmação, a retirada da lista e o registro na Blacklist sem enviar mensagem real.

## Impacto
- Sem nova rotina, polling ou canal em tempo real; a ação só executa quando o usuário clicar.
