# Liberar instâncias Meta sem bloquear pelo nome de exibição

## Resultado esperado

- Permitir ativar o pool de qualquer instância conectada mesmo quando o nome estiver `PENDING_REVIEW`, `NON_EXISTS`, `AVAILABLE_WITHOUT_REVIEW`, `REJECTED` ou sem status.
- A instância **Novo Mundo 3144** poderá sair de “Fora do pool manualmente” pelo botão **Ativar Pool**.
- O estado do nome continuará visível como informação, mas não impedirá seleção, campanha, aquecimento ou envio.
- Se a própria Meta recusar uma mensagem por causa do nome, a falha real será registrada normalmente.

## Diagnóstico confirmado

A **Novo Mundo 3144** está ativa, `CONNECTED` e com qualidade `GREEN`, mas está fora do pool manualmente. O botão **Ativar Pool** chama uma validação que exige o nome exatamente como `APPROVED`; o nome atual está como `NON_EXISTS`, por isso aparece o erro mostrado na imagem.

Além do botão, ainda existem filtros de envio que retiram instâncias com nome `REJECTED`. Para cumprir a regra solicitada em todas as instâncias, esses bloqueios internos por nome precisam ser removidos de todos os caminhos.

## Alterações

1. **Botão Ativar Pool**
   - Remover da validação a exigência de nome `APPROVED`.
   - Não interpretar uma limitação que mencione somente nome de exibição como impedimento para ativar o pool.
   - Manter a validação de conexão e das demais restrições reais.

2. **Seleção e início das campanhas**
   - Não retirar instâncias selecionadas por `REJECTED`, `PENDING_REVIEW`, `NON_EXISTS` ou outro estado do nome.
   - Manter o status visível apenas como alerta informativo.

3. **Envio manual, em massa e retomada automática**
   - Remover o nome de exibição como trava interna na escolha e reutilização das instâncias.
   - Garantir que uma instância não volte a ser marcada como restrita apenas por uma resposta de saúde que mencione o nome.

4. **Aquecimento Meta e leads Google Maps**
   - Permitir que instâncias sem nome aprovado participem quando atenderem às demais regras do aquecimento.
   - Continuar exigindo template UTILITY aprovado para o envio aos leads.

5. **Correção imediata da Novo Mundo 3144**
   - Aplicar a nova regra do botão e ativar a instância no pool.
   - Confirmar que ela aparece pronta para seleção e tentativa de envio.

## Proteções mantidas

- Retirada manual continua exigindo clique em **Ativar Pool** para retornar.
- Desconexão, desativação, banimento, `ACCOUNT_VIOLATION`, bloqueio comercial/pagamento, ausência de cota e quarentena real continuam bloqueando.
- Qualidade e demais regras operacionais permanecem como estão; esta mudança remove somente a trava do nome.
- Recusas reais devolvidas pela Meta, inclusive falhas causadas pelo nome, continuam registradas como falha — não serão convertidas em sucesso.
- Nenhum novo agendamento, consulta repetitiva ou processo contínuo será criado; sem aumento relevante de custo da nuvem.

## Validação

- Ativar a **Novo Mundo 3144** mesmo com nome `NON_EXISTS` e confirmar seu estado no pool.
- Testar seleção, início de campanha e tentativa de envio com nomes não aprovados.
- Confirmar que bloqueios comerciais, banimento, desconexão e retirada manual continuam funcionando.
- Confirmar que erros reais devolvidos pela Meta aparecem no histórico com o motivo correto.
