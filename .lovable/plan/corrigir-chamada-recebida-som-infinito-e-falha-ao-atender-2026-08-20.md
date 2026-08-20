# Corrigir chamada recebida: som infinito e falha ao atender

## O que foi verificado

- A chamada de entrada de hoje (13:46, cliente 556282500724, instância 62 8268-4860) foi registrada com oferta de áudio e terminou como `concluida` às 13:47:24 — ou seja, a ligação acabou, mas o pop-up continuou tocando na sua tela.
- Motivo do som infinito (confirmado no código): no monitor de chamadas em tempo real, quando chega o evento de fim da chamada, o código sai antes da hora se não houver uma chamada "sua" ativa (`callIdRef` vazio — que é justamente o caso quando você ainda não atendeu). Assim o pop-up "Chamada recebida" nunca é fechado e o toque (bipe gerado no navegador, repetido a cada 1,6s) segue para sempre.
- Motivo do erro ao atender: **não confirmado**. Não há nenhum registro de falha na função de atender no servidor nesse horário, o que indica que o erro ocorreu no próprio navegador antes de chegar ao servidor (microfone/negociação de áudio) — ou a resposta de erro veio sem log. Por isso a primeira etapa é instrumentar e reproduzir, não adivinhar.

## Correções

### 1. Parar o toque e fechar o pop-up quando a chamada não está mais tocando
- No monitor em tempo real, tratar os eventos da chamada de entrada **antes** do filtro de chamada ativa: se o registro exibido no pop-up mudar para `concluida`, `perdida`, `rejeitada`, `erro` ou `em_andamento`, fechar o pop-up imediatamente.
- Limite de segurança: o pop-up e o toque se encerram automaticamente após 45 segundos sem resposta (uma chamada da Meta não fica tocando mais que isso), evitando qualquer chance de som preso.
- Garantir que o toque pare também quando o pop-up é fechado por erro: o oscilador de áudio é interrompido e o `AudioContext` encerrado no desmonte/mudança de estado.
- Botão de silenciar o toque no próprio pop-up (mantém a chamada tocando, mas sem som), como escape imediato.

### 2. Tornar o atendimento confiável e diagnosticável
- Pedir o microfone **antes** de fechar o pop-up e mostrar mensagem clara em português quando o navegador bloquear ("Permita o acesso ao microfone no navegador para atender"). Hoje qualquer falha aparece como texto técnico.
- Seguir o fluxo recomendado pela Meta para chamadas de entrada: enviar `pre_accept` com a resposta de áudio e, em seguida, `accept` (hoje só o `accept` é enviado), o que é a causa provável da recusa da conexão.
- Registrar no servidor a resposta completa da Meta em cada etapa (`pre_accept`/`accept`) para que, se ainda falhar, o motivo exato apareça nos registros.
- Mensagens de erro humanizadas no aviso da tela (mesmo tratamento já usado nas chamadas de saída), em vez do texto cru.

### 3. Validação
- Reproduzir uma ligação de entrada real do seu número e confirmar: o toque para ao encerrar/rejeitar, o pop-up fecha, e o atendimento conecta o áudio (estado "em andamento" com cronômetro). Se a Meta recusar, leio o registro da função e trato o código específico.

## Detalhes técnicos

- `src/contexts/MetaCallContext.tsx`: reordenar o handler de `whatsapp_chamadas` (tratar `entrando` antes do `return` por `callIdRef`), timeout de 45s no pop-up, `getUserMedia` antes de `setEntrando(null)`, erros via `erroLegivel`.
- `src/components/inbox/meta/ChamadaEntrandoDialog.tsx`: parada explícita do oscilador, botão "Silenciar toque".
- `supabase/functions/meta-call-action/index.ts`: sequência `pre_accept` → `accept` para a ação `accept`, com `console.log` das duas respostas da Meta.
- Sem novas tabelas, crons, polling ou canais Realtime — custo de backend inalterado.
