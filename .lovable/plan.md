# Corrigir "cliente não autorizou" após o cliente aceitar a chamada

## O que está acontecendo (verificado)

- No banco, a permissão do seu número **já está como aceita** (`meta_call_permissions`: telefone 556291672674, instância SOUZA 62 8268, status `accepted`, válida até 27/08). O webhook gravou corretamente quando você tocou em "Permitir".
- A tela não sabe disso: a tabela `meta_call_permissions` **não está no publication de Realtime** (só `whatsapp_chamadas` está). O Inbox carrega as permissões uma única vez ao montar e o canal de tempo real nunca recebe o evento — por isso o botão continua no modo "pedir permissão".
- Ao clicar de novo, o sistema reenvia o convite e a Meta responde "limit for call permission requests has exceeded for this business-consumer pair" (já existe permissão/convite ativo), aparecendo como erro de "não autorizou".

## Correções

1. **Tempo real na permissão**: incluir `meta_call_permissions` na publicação de Realtime com replica identity completa, para que o botão libere na hora que o cliente aceita.
2. **Revalidação antes de agir**: no clique do telefone, reconsultar a permissão daquele par (instância + telefone) antes de decidir entre "ligar" e "pedir permissão". Se estiver aceita, liga direto — sem reenviar convite.
3. **Fallback do erro de limite**: quando a Meta responder que o limite de pedidos foi excedido, tratar como "permissão já solicitada/ativa": recarregar as permissões e, se estiver aceita, prosseguir para a chamada; caso contrário, mostrar aviso claro ("o convite já foi enviado, aguarde o cliente aceitar") em vez de erro vermelho de não autorização.
4. **Segurança extra no início da chamada**: em `meta-call-start`, aceitar também a permissão registrada pelo sufixo de 8 dígitos do telefone (padrão do projeto), evitando falso negativo por formatação do número.

## Detalhes técnicos

- Migração: `ALTER TABLE public.meta_call_permissions REPLICA IDENTITY FULL;` + `ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_call_permissions;`
- `src/contexts/MetaCallContext.tsx`: nova função `revalidarPermissao(instancia_id, telefone)` consultando a tabela; usada em `ligar` e `pedirPermissao`; tratamento do erro de limite (code 138010 / mensagem "limit ... call permission").
- `src/pages/InboxMeta.tsx`: o clique passa a chamar um único handler que revalida e decide ligar vs. pedir permissão.
- `supabase/functions/meta-call-start/index.ts`: consulta da permissão por telefone exato com fallback por sufixo de 8 dígitos.
- Sem novos crons, polling ou queries recorrentes — o Realtime já está aberto para chamadas, apenas uma tabela a mais no mesmo canal.
