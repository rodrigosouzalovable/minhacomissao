## Problema
A instância "LD 06 FERNANDA" retornou erro `#131042 Business eligibility payment issue` e o sistema continuou tentando enviar por ela, porque esse código não está na lista de "erros que restringem" em `send-whatsapp-meta/index.ts` (hoje só cobre 131031, 131049, 368, 130429 e palavras tipo "locked/banned").

## Correção (mínima, só em `supabase/functions/send-whatsapp-meta/index.ts`)

Ampliar o bloco `isRestricted` (linhas ~542–578) para cobrir também erros de **elegibilidade / pagamento / política / permissão** da Meta, que são causas permanentes de falha:

1. **Adicionar códigos** à lista `restrictedCodes`:
   - `131042` — Business eligibility payment issue (caso do usuário)
   - `131050` — Business not verified
   - `131056` — pair rate limit / política
   - `133000`, `133004`, `133005`, `133006`, `133008`, `133009`, `133010`, `133016` — família "Registration / Two-step / Number pin locked"
   - `190` — token inválido/expirado
   - `10`, `200`, `803` — permissões/objeto não acessível (o `Object with ID ... does not exist ... missing permissions` do log do usuário cai aqui)

2. **Adicionar palavras-chave** a `restrictedKeywords`:
   - `eligibility`, `payment`, `billing`, `not verified`, `permission`, `does not exist`, `cannot be loaded`, `two-step`, `pin locked`, `access token`

3. Ao detectar qualquer um desses, mantém o comportamento atual: `estado_pool='restrita'`, `pausa_automatica_ate = agora + 24h`, grava motivo, notifica admin, retorna `instance_restricted: true`.

## Efeito no envio em massa
O tick (`envio-meta-massa-tick`) já usa `pick-meta-instance`, que exclui instâncias com `estado_pool !== 'ativo'` e com `pausa_automatica_ate` no futuro. Ou seja, assim que a `LD 06 FERNANDA` cair para `restrita`, ela sai automaticamente do rodízio até o admin revisar — sem mais tentativas.

Além disso, o tick já detecta instâncias restritas durante o job e mostra aviso ao admin (linhas 79–110 do tick).

## Fora do escopo
- Não pausar em erros transitórios (timeout, 5xx da Meta, rate limit temporário) — isso continua tentando com outra instância no round-robin.
- Sem mudanças em UI, RLS, banco ou outras funções.
- Sem alterar `pick-meta-instance`, `envio-meta-massa-tick`, `EnvioMeta.tsx`.

## Arquivo alterado
- `supabase/functions/send-whatsapp-meta/index.ts` — apenas as duas listas (`restrictedCodes` e `restrictedKeywords`) no bloco de tratamento de erro do envio.
