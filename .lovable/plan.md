
# Dashboard Executivo para o Credor

## Visao Geral

Criar uma nova pagina publica (sem necessidade de login) acessivel por uma rota dedicada como `/credor/novomundo/dashboard` que exibe KPIs de recuperacao de credito em modo read-only. O credor podera acompanhar o desempenho da operacao sem ter acesso ao sistema interno.

Para garantir seguranca, o acesso sera protegido por um token simples configuravel por credor, passado como query parameter (`?token=abc123`). Isso evita a necessidade de criar contas de usuario para credores.

## Funcionalidades do Dashboard

1. **Valor Total Recuperado** -- soma de todas as parcelas pagas dos acordos do credor
2. **Taxa de Conversao do Portal** -- percentual de CPFs consultados no portal que geraram acordos
3. **Acordos Fechados no Mes** -- quantidade e valor total de acordos criados no mes atual
4. **Ticket Medio** -- valor medio por acordo fechado
5. **Comparativo Mensal** -- grafico de barras comparando os ultimos 6 meses (valor recuperado por mes)
6. **Cards com variacao percentual** -- indicadores de crescimento/queda em relacao ao mes anterior

## Arquitetura Tecnica

### 1. Backend -- Edge Function `credor-dashboard-data`

Uma edge function que recebe o slug do credor e o token de acesso, valida o token, e retorna os KPIs agregados diretamente do banco de dados usando service_role_key (bypassa RLS).

Dados retornados:
- Total recuperado (all-time e mes atual)
- Total recuperado mes anterior (para calculo de variacao)
- Quantidade de acordos (mes atual e anterior)
- Ticket medio (mes atual)
- Serie temporal dos ultimos 6 meses
- Contagem de consultas no portal (baseada em logs ou devedores consultados)

### 2. Tabela `credor_tokens`

Nova tabela para armazenar tokens de acesso por credor:

```text
credor_tokens
- id (uuid, PK)
- credor_slug (text, unique)
- token (text)
- ativo (boolean, default true)
- criado_em (timestamptz)
```

RLS: apenas admins podem gerenciar. A edge function usa service_role para validar.

### 3. Frontend -- Nova pagina `src/pages/CredorDashboard.tsx`

Pagina standalone (sem AppLayout) com branding do credor, contendo:
- Header com logo do credor e logo Souza e Ribeiro
- 4 cards de KPI no topo (Valor Recuperado, Acordos no Mes, Ticket Medio, Taxa Conversao)
- Cada card com indicador de variacao vs mes anterior (seta verde/vermelha + percentual)
- Grafico de barras com comparativo dos ultimos 6 meses (valor recuperado)
- Rodape institucional

### 4. Rota

Nova rota publica em `App.tsx`:
```text
/credor/:slug/dashboard  -->  CredorDashboard
```

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `supabase/functions/credor-dashboard-data/index.ts` | Criar -- edge function que agrega KPIs |
| `src/pages/CredorDashboard.tsx` | Criar -- pagina do dashboard executivo |
| `src/App.tsx` | Modificar -- adicionar rota publica |
| Migration SQL | Criar tabela `credor_tokens` com RLS |

## Fluxo de Acesso

1. Admin configura o token do credor na tabela `credor_tokens` (pode ser feito via SQL inicialmente)
2. Admin compartilha o link com o credor: `https://minhacomissao.lovable.app/credor/novomundo/dashboard?token=TOKEN_AQUI`
3. A pagina carrega, chama a edge function com slug + token
4. Edge function valida o token, busca dados agregados, retorna JSON
5. Frontend renderiza os KPIs em cards visuais e grafico

## Design Visual

- Fundo escuro (gradiente similar ao portal publico)
- Cards com fundo semi-transparente branco
- Cores: verde para crescimento, vermelho para queda
- Grafico em tons de azul/verde
- Logo do credor no header
- Responsivo para mobile e desktop
