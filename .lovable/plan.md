# Corrigir a aplicação de templates e explicar bloqueios da Meta

## Diagnóstico confirmado

- A tentativa registrada no momento da imagem corresponde à instância **SOUZA 62 8269-3372**.
- A Meta informa a WABA como **BLOCKED**, código **141006**: erro no método de pagamento, bloqueando conversas iniciadas pela empresa e a aplicação dos templates.
- Esse bloqueio vem da Meta e não deve ser contornado pelo sistema.
- A instância **SOUZA 62 8269-1277**, também visível na imagem, está normal: CONNECTED, WABA disponível e **16 de 16 templates aprovados**, sem itens pendentes ou com falha.

## Correção

1. Ao clicar em **Templates → Aplicar templates**, atualizar primeiro a saúde e as restrições da instância na Meta, evitando decidir com uma verificação antiga.
2. Quando a Meta retornar o código 141006, substituir o aviso genérico “envio bloqueado na WABA” por uma mensagem clara: problema no método de pagamento da conta, com orientação para revisar a cobrança no botão **Faturamento**.
3. Não criar fila enquanto o bloqueio real existir; preservar os limites e proteções atuais.
4. Depois que a Meta liberar a conta, o mesmo botão fará uma nova verificação e continuará a aplicação gradual dos templates Utility selecionados.
5. Quando a instância já estiver completa, como a 1277, mostrar **“Todos os templates selecionados já estão aplicados”** em vez de tratar a ausência de novos itens como erro.

## Validação

- Confirmar que a 3372 mostra o código e a causa reais, sem criar envios enquanto estiver bloqueada.
- Confirmar que a 1277 informa corretamente que seus 16 templates já estão aplicados.
- Simular uma instância liberada e verificar que a fila gradual continua funcionando sem duplicar templates.
- Validar que nenhum template ou mensagem real é submetido durante os testes.

## Custo

A correção usa somente a verificação manual já iniciada pelo clique, sem novo agendamento, polling ou rotina recorrente.
