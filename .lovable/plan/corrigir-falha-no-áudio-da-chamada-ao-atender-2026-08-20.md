# Corrigir "Falha no áudio da chamada" ao atender

## O que está acontecendo

Ao atender uma chamada recebida, o áudio é negociado corretamente no navegador (oferta do cliente aplicada + resposta local criada). Em seguida, o backend grava **a nossa própria resposta de áudio** na coluna `sdp_answer` da chamada (`meta-call-action`, ação `accept`).

Isso dispara o listener de tempo real no app, que trata qualquer `sdp_answer` como se fosse resposta de um cliente numa chamada **de saída** e tenta aplicá-la novamente na conexão. A conexão já está negociada, então a operação falha e aparece o alerta vermelho "Falha no áudio da chamada" — mesmo quando a ligação foi atendida.

O mesmo listener também é acionado pelo webhook da Meta (evento de conexão) para chamadas de entrada, reproduzindo o erro.

## Correção

1. **Aplicar resposta de áudio somente em chamadas de saída**: no listener de tempo real, só aplicar `sdp_answer` quando a chamada for do tipo `saida` e a conexão estiver realmente aguardando resposta. Chamadas de entrada passam a ignorar esse campo.
2. **Não gravar a nossa resposta como se fosse do cliente**: na ação `accept`, parar de escrever o SDP local em `sdp_answer` (mantendo o restante da atualização: status `em_andamento`, atendente, horário).
3. **Silenciar falha inofensiva**: caso a aplicação da resposta falhe mas a chamada já esteja em andamento, registrar no console em vez de mostrar alerta de erro ao atendente.
4. **Estado consistente**: ao atender, marcar a chamada como em andamento apenas após o `accept` confirmado (comportamento atual) e evitar que o evento de tempo real reinicie o cronômetro.

## Detalhes técnicos

- `src/contexts/MetaCallContext.tsx`: guardar a direção da chamada ativa em um ref; no handler de `postgres_changes`, condicionar o bloco de `sdp_answer` a `direção === 'saida'` e `pc.signalingState === 'have-local-offer'`; trocar o toast destrutivo por log quando o estado já for `em_andamento`.
- `supabase/functions/meta-call-action/index.ts`: remover `patch.sdp_answer = sdp` do fluxo `accept` e fazer o deploy da função.
- Sem mudanças de banco, custo ou novos agendamentos.
