# Webhook da 3C Plus (eventos de ligação em tempo real)

Objetivo: gerar a URL de webhook que a 3C Plus pede na tela "Novo webhook", mostrar essa URL pronta para copiar dentro do painel "3C Plus" na aba Relatórios, e receber automaticamente os eventos `call-was-connected` e `call-history-was-created` para alimentar as colunas de Tentativas, Alô, CPC e CPC-A hora a hora — sem depender de sincronização manual.

## O que você vai ver na tela

No diálogo "3C Plus" (aba Relatórios), um novo bloco no topo: **Webhook da 3C Plus**

- Campo somente leitura com a URL completa do webhook + botão **Copiar**.
- Lista dos dois eventos que devem ser marcados na 3C: `call-was-connected` e `call-history-was-created`.
- Selo de status: "Nenhum evento recebido ainda" ou "Último evento recebido às HH:MM (tipo)".
- Passo a passo curto: colar a URL na 3C, marcar os dois eventos, salvar, e voltar aqui para confirmar o recebimento.

## Como vai funcionar

1. Você cola a URL na 3C e marca os dois eventos.
2. A cada ligação conectada e a cada histórico criado, a 3C chama nosso endpoint.
3. O sistema grava/atualiza a ligação no cache (`tresc_ligacoes`), pelo `id` da ligação — evento repetido não duplica.
4. O `call-history-was-created` traz a qualificação final, então é ele que define CPC / CPC-A conforme o mapeamento que você já configura no mesmo diálogo.
5. O relatório por hora continua sendo consolidado pela rotina existente, agora com dados que chegam em tempo real.

O botão "Sincronizar ligações de hoje" continua existindo como rede de segurança (caso a 3C fique fora do ar e perca eventos).

## Sobre o token

O token de gestor da 3C não vem pelo webhook — é gerado no painel deles (perfil do gestor → tokens de API). Ele é necessário só para as consultas ativas (listar campanhas, importar qualificações e a sincronização de segurança). Quando você tiver esse token, eu abro o formulário seguro para você salvá-lo; o webhook já funciona antes disso.

## Detalhes técnicos

- Nova função `tresc-webhook`, pública (`verify_jwt = false`, exigido pela 3C), com CORS e resposta 200 rápida.
- Segurança: um segredo aleatório é gerado pelo sistema e incluído na própria URL como query (`?k=...`); requisições sem a chave correta são rejeitadas com 401. Assim a URL pode ser colada na 3C sem expor credenciais do projeto.
- Payload tratado de forma tolerante: aceita `call`, `data` ou o objeto na raiz; extrai `id`, `number`, `campaign(_id)`, `agent`, `status_id`, `readable_status_text`, `qualification(_id)`, `speaking_with_agent_time`, `mode`, `call_date_rfc3339`. Telefone normalizado por sufixo de 8 dígitos e hora calculada em BRT (mesmas funções já usadas em `relatorio-3c-sync`).
- Upsert em `tresc_ligacoes` com `onConflict: call_id`; `atendida` recalculada pela mesma regra da função de sync.
- Nova coluna `ultimo_webhook_em` e `ultimo_webhook_tipo` em `tresc_config` para o selo de status na tela (migração com GRANT/RLS já no padrão da tabela).
- Frontend: bloco novo em `src/components/relatorios/Config3CPlusDialog.tsx` (URL + copiar + status), reaproveitando `CopyButton`. Nenhuma alteração de layout fora do diálogo.
- Alerta de custo (Lovable Cloud): o webhook é orientado a evento, sem cron novo e sem polling no cliente — o custo acompanha o volume de ligações (1 chamada curta + 1 upsert por evento). Nada de canal Realtime novo.
