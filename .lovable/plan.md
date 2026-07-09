## Objetivo

Mostrar, na aba **Envio Meta em Massa**, uma **previsão de custo real** assim que houver template + instâncias + destinatários carregados, e **exigir confirmação explícita** do custo antes de disparar. Assim você nunca mais é surpreendido com cobranças de US$ 25 acumulando.

## Como o custo será calculado

Meta cobra por **conversa** (janela 24h), não por mensagem. Regras já usadas no projeto:

- **MARKETING**: US$ 0,0625 por conversa (BR, jul/2026)
- **UTILITY / AUTHENTICATION**: US$ 0,0068 por conversa
- **SERVICE / janela 24h aberta**: grátis
- Câmbio USD→BRL: mesmo `fxRate` usado no `meta-billing-sync` (fallback ~R$ 5,55)

Para cada destinatário da lista o sistema vai:

1. Verificar em `meta_whatsapp_contatos` se existe `ultima_msg_entrada_em` dentro das últimas 24h para aquele telefone em **qualquer** instância selecionada → conta como **grátis**.
2. Caso contrário, conta como **1 conversa cobrada** na categoria do template selecionado.

Total = (nº cobrados) × preço da categoria × fxRate.

## Onde vai aparecer

Novo card **"Custo estimado deste envio"** entre a seção *3. Destinatários* e *Agendamento multi-dia* em `src/pages/EnvioMeta.tsx`. Só aparece quando há template + ≥1 instância + ≥1 destinatário.

Layout:

```text
┌─────────────────────────────────────────────────────────┐
│ 💰 Custo estimado deste envio                           │
├─────────────────────────────────────────────────────────┤
│ 2.000 destinatários  ·  Categoria: MARKETING            │
│                                                         │
│ Cobrados:    1.847  →  US$ 115,44   ≈  R$ 640,69       │
│ Grátis (24h):  153  →  US$ 0,00     (janela aberta)    │
│                                                         │
│ ⚠️ Este valor SERÁ debitado no cartão da Meta.          │
│    Cada WABA cobra ao atingir US$ 25 acumulados.        │
└─────────────────────────────────────────────────────────┘
```

Se a categoria for MARKETING, o card fica em vermelho reforçando o alerta (já existe bloqueio, mas mostra o valor caso destravem).

## Fluxo de confirmação reforçado

O `confirm()` atual já mostra "Disparar para X contatos". Vai ser trocado por um **AlertDialog** com o custo estimado impresso e um campo onde você digita o valor em reais (ex.: `640,69`) para liberar o botão *Confirmar disparo*. Sem digitar o valor, não envia.

Limite duro adicional: se o custo estimado passar de um teto configurável (default **R$ 100** por envio, ajustável em `meta_billing_guardrail`), aparece **"Envio bloqueado — pedir liberação ao admin"** como já acontece com MARKETING.

## Implementação técnica

**Novo componente** `src/components/meta/CustoEstimadoEnvio.tsx`
- Recebe `recipients`, `instanciaIds`, `templateGroup` (categoria), fxRate.
- Faz `supabase.from('meta_whatsapp_contatos').select('telefone,ultima_msg_entrada_em').in('instancia_id', instanciaIds).in('telefone', lote)` em lotes de 500 para achar janelas 24h abertas.
- Calcula cobrados × preço × fx. Debounce de 400ms ao digitar destinatários.
- Query com `staleTime: 60_000` (custo memory: cost-awareness — consulta leve, sem cron/realtime novo).

**Edição em** `src/pages/EnvioMeta.tsx`
- Renderizar `<CustoEstimadoEnvio ... />` após o card de Destinatários.
- Substituir `if (!confirm(...))` do `handleEnviar` por um `AlertDialog` novo que exibe o custo e exige confirmação por digitação.
- Ler teto de `meta_billing_guardrail` (tabela já existe) e bloquear acima dele.

**Hook auxiliar** `src/hooks/useCustoEstimadoEnvio.ts`
- Encapsula: consulta janelas 24h, cálculo, memoização, retorna `{ cobrados, gratis, usd, brl, loading }`.

## Fora do escopo

- Nenhuma mudança em edge functions, webhooks, migrations, cron, realtime, tabelas, `client.ts`, `types.ts`, `.env`, `config.toml`.
- Não altera a lógica de disparo em si (`envio-meta-massa-iniciar`/`-tick`) — só antecipa e exige confirmação do custo no frontend.
- Não mexe no dialog de "Custos Detalhados" existente (esse mostra o passado; este novo mostra o futuro do envio).

## Por que isso resolve o susto

Hoje você seleciona planilha → clica enviar → só descobre o custo depois via cobrança da Meta. Com o card, **antes de qualquer envio** você vê "R$ 640" na tela, e o sistema te obriga a digitar o valor para confirmar. Combinado com o teto de R$ 100/envio, é impossível um envio grande passar despercebido.
