## Causa

A chamada `supabase.functions.invoke('notify-cpf-consulta', ...)` em `src/pages/ConsultaResultado.tsx` está dentro do `if (debitosResult.data.length > 0)` (linha 85). Quando a pessoa consulta um CPF que não tem débito no sistema, o bloco inteiro é ignorado — inclusive a notificação. Nos últimos testes você usou CPFs aleatórios, então a função nunca foi chamada. A edge function `notify-cpf-consulta` continua funcional; o problema é só o gate no frontend.

## Correção

Em `src/pages/ConsultaResultado.tsx` (dentro do `useEffect` que carrega os débitos), disparar `notify-cpf-consulta` **sempre** que a consulta ocorre, independente de haver débitos:

- Extrair a chamada para fora do `if (debitos.length > 0)`.
- Quando não há débitos, enviar `cpf` vindo do `useParams`, `nome: null`, `totalDebitos: 0` e `credor` a partir do `config?.nome || creditor`.
- Quando há débitos, manter o payload atual (nome e cpf normalizados do resultado).
- Manter o `.catch(() => {})` (fire-and-forget) para não impactar a UI.

Nenhuma outra lógica de negócio, template da mensagem ou edge function é alterada — a `notify-cpf-consulta` já formata o CPF, busca telefones e monta a mensagem para o 62 99167-2674 corretamente.

## Verificação

Após aplicar: consultar um CPF sem débito no portal e confirmar que a mensagem chega no WhatsApp do admin com `Débitos encontrados: 0`.
