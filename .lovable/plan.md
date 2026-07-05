## Plano

1. Ajustar o envio da notificação administrativa para tentar todas as instâncias ativas disponíveis, em round-robin, até encontrar uma que realmente envie a mensagem.
2. Corrigir o ponto provável da falha atual: hoje o helper para no primeiro erro que não reconhece como “desconectado”; vou ampliar a detecção para erros da UAZAPI como `WhatsApp disconnected`, `session is not reconnectable`, `not connected`, `unauthorized`, `invalid token`, `timeout` e similares, sem abortar a fila cedo demais.
3. Registrar no log qual instância foi tentada e manter o retorno HTTP 200 com `fallback:true` quando nenhuma instância conseguir enviar, para a tela não quebrar.
4. Manter a chamada da tela de consulta como está: ela já dispara para CPF com débito e sem débito.
5. Validar chamando a função `notify-cpf-consulta` com um CPF sem débito e outro com débito, verificando nos logs se houve tentativa em múltiplas instâncias e se alguma foi marcada como enviada.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/_shared/notificar-admin.ts`.
- A função `supabase/functions/notify-cpf-consulta/index.ts` já monta a mensagem corretamente e usa o helper compartilhado.
- A consulta no frontend (`src/pages/ConsultaResultado.tsx`) já chama a função sempre, inclusive quando `totalDebitos = 0`; o problema está no envio via WhatsApp, não no clique da consulta.
- Não vou alterar regras de débito/acordo nem custo de backend.