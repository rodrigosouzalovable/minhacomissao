# Relatórios parciais no grupo: usar sempre um WhatsApp conectado

## O que eu verifiquei (dados reais)

- Últimos envios com sucesso: **14/08 às 13h e 16h**. Depois disso, só erros.
- Todos os envios de 13/08 e 14/08 que funcionaram saíram pela instância **MEMU 37**, que **não existe mais** na lista de instâncias (foi removida).
- O grupo **UME | Souza e Ribeiro** está com envio "fixado" nessa instância removida (registro em destinos aponta para um ID que não existe mais).
- Erros registrados:
  - 17/08 às 13h e 16h: `nenhuma_instancia_conectada` — porém, testando agora, **as 5 instâncias ativas respondem "connected"** (3 WORK N1, 3 B2, MEMU 25, 3 N2, 3 N1). A checagem de conexão usa timeout de apenas 2,5s e desiste; quando a Uazapi demora, o sistema conclui erradamente que nada está conectado e cancela o relatório.
  - 17/08 às 20h: `MEMU 25: 405 Method Not Allowed` nos 3 destinos. Esse 405 é **falso**: o endpoint correto (`/send/text`) funciona; o 405 vem de dois endpoints antigos testados depois, e a mensagem real do erro é sobrescrita pelo 405. Ou seja, hoje não é possível saber o motivo verdadeiro da falha pelo log.

## O que vou corrigir

1. **Nunca depender de uma instância fixa**: se a instância fixada no destino não existir mais ou não estiver conectada, o sistema ignora a fixação e percorre todas as instâncias ativas conectadas até uma conseguir enviar. Quando uma consegue enviar no grupo, ela passa a ser gravada como a instância do grupo (auto-cura do cadastro).
2. **Checagem de conexão mais tolerante**: timeout maior (8s) com uma segunda tentativa. E se nenhuma instância responder à checagem, o sistema **tenta enviar mesmo assim** pelas instâncias ativas em vez de abortar o relatório — abortar só depois que todas as tentativas reais de envio falharem.
3. **Erro real no log**: enviar apenas pelo endpoint válido `/send/text` e registrar a mensagem de erro verdadeira de cada instância (ex.: número fora do WhatsApp, instância fora do grupo, token inválido), sem mascarar com o 405 dos endpoints legados.
4. **Rotação em caso de banimento/queda**: instância que falhar com erro de sessão/token/desconexão é descartada para os demais destinos daquele envio e o próximo destino já começa por outra conectada.
5. **Aviso quando o relatório não sair**: se nenhum destino receber, disparar um alerta curto para os números de admin (por outra instância conectada) informando o motivo — assim a falha não passa dias sem ser notada.
6. **Na tela de Relatórios (Destinos)**: mostrar a instância realmente usada no último envio e o status de conexão de cada instância ativa, além do botão de teste já existente.

Depois de aplicar, faço um envio de teste no grupo para confirmar na hora.

## Detalhes técnicos

- `supabase/functions/_shared/notificar-numeros.ts`: `checkConnected` com timeout 8s + retry; fallback para "tentar todas as ativas" quando a lista de conectadas vier vazia; lista de endpoints reduzida a `/send/text`; `ultimoErro` preservando o primeiro erro real por instância; blacklist local de instâncias com erro de sessão dentro da mesma execução; retorno passa a incluir `instanciaUsadaPorDestino`.
- `supabase/functions/relatorio-acionamentos-sync/index.ts`: validar `relatorio_destinos.instancia_id` contra `user_whatsapp_instances` (ativa + conectada) antes de usar como fixação; após sucesso, `update` do `instancia_id` do destino com a instância que funcionou; se `enviados === 0`, chamar aviso de falha para os números admin.
- `src/components/relatorios/DestinosRelatorioDialog.tsx`: coluna com a instância do último envio e indicador de conexão.
- Sem novo cron, sem novo polling e sem canal Realtime — custo no Lovable Cloud permanece o mesmo.
