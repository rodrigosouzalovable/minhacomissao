
# Notificacao WhatsApp ao Consultar CPF no Portal

## Objetivo
Enviar uma mensagem automatica via WhatsApp (Z-API) para o administrador toda vez que alguem consultar um CPF no portal publico de negociacao.

## Como funciona

1. Quando um visitante digita o CPF e clica em "Consultar", alem de buscar os debitos, o sistema chama uma nova funcao backend que envia uma notificacao via WhatsApp.
2. A mensagem contera: CPF consultado, nome do devedor (se encontrado), credor, quantidade de debitos e horario da consulta.
3. O envio sera feito de forma assincrona (nao bloqueia a experiencia do usuario).

## Mudancas

### 1. Nova Edge Function: `supabase/functions/notify-cpf-consulta/index.ts`
- Recebe: CPF, nome do devedor, credor, quantidade de debitos encontrados
- Formata uma mensagem informativa
- Envia via Z-API para o numero do administrador (62 99167-2674, mesmo do relatorio diario)
- Endpoint publico (sem JWT), pois o portal e acessado sem login

### 2. Arquivo: `src/pages/ConsultaResultado.tsx`
- Apos o `fetchDebitos` retornar os resultados, chamar `supabase.functions.invoke('notify-cpf-consulta', ...)` com os dados da consulta
- A chamada sera feita com `await` mas sem tratar erro (fire-and-forget), para nao impactar a experiencia do usuario

### 3. Arquivo: `supabase/config.toml`
- Adicionar configuracao `[functions.notify-cpf-consulta]` com `verify_jwt = false`

## Exemplo de mensagem enviada

```
CONSULTA NO PORTAL

CPF: 123.456.789-00
Nome: Joao da Silva
Credor: UME | NOVO MUNDO
Debitos encontrados: 3
Data/Hora: 23/02/2026 14:30

Portal de Acordos - Souza e Ribeiro
```

## Observacoes
- Utiliza as credenciais Z-API ja configuradas (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)
- O numero de destino sera fixo no codigo da edge function (62 99167-2674)
- Nao bloqueia nem atrasa a experiencia do visitante no portal
