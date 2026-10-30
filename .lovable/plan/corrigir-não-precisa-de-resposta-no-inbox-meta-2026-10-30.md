# Corrigir "Não precisa de resposta" no Inbox Meta

## O que encontrei
- O clique grava a dispensa da conversa, mas o contador de não lidas volta a subir depois. No banco há conversas dispensadas ontem, sem nenhuma mensagem nova do cliente desde então, que continuam com 1, 2 e até 10 não lidas.
- Ou seja, outro processo regrava o contador de não lidas depois da dispensa, e a conversa continua aparecendo na lista de não lidas.

## O que vou fazer
1. **Regra no banco (vale para todas as telas e processos):** enquanto a conversa estiver marcada como "não precisa de resposta" e o cliente não tiver mandado nada depois disso, o contador de não lidas fica sempre em zero, mesmo que outro processo tente aumentar.
2. **Nova mensagem do cliente reativa:** quando o cliente manda uma mensagem depois da dispensa, a conversa volta a ficar como não lida normalmente (o contador sobe e a bolinha verde aparece).
3. **Corrigir as conversas que já estão erradas:** zerar o contador das conversas dispensadas que não receberam mensagem nova depois disso (são 9 hoje).
4. **Tela:** depois de clicar, a conversa sai na hora da lista "Não lidas" e o contador da caixa é atualizado.

"Marcar como não lida" feito à mão continua funcionando: ele tira a dispensa antes de marcar.

## Detalhes técnicos
- Trigger `BEFORE INSERT OR UPDATE` em `meta_whatsapp_contatos`: se `sla_dispensado_em IS NOT NULL` e `sla_dispensado_em >= coalesce(ultima_msg_entrada_em, '-infinity')`, força `nao_lido = 0`. Uma entrada nova (`ultima_msg_entrada_em > sla_dispensado_em`) passa a contar normalmente. É uma comparação simples em cada linha, sem custo extra relevante.
- `handleMarcarNaoLida` limpa `sla_dispensado_em` junto com `nao_lido`, para o trigger não anular a marcação manual.
- Migração única: `update ... set nao_lido = 0` nas linhas que atendem a regra.
- Invalidar o cache de contagem de não lidas (`meta_inbox_nao_lidas_count`) depois de dispensar.
- Teste: dispensar → `nao_lido` 0; tentar aumentar sem entrada nova → continua 0; entrada nova → contador sobe.
