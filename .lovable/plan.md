# Por que "Reativar" não envia nada

Investiguei o banco antes de propor qualquer alteração. O problema **não é bug do reativar** — é bloqueio real da Meta nas duas instâncias do job.

## Estado atual das duas instâncias do job `agende_a_videoconferncia`

| Instância | Estado | Motivo | Pendentes |
|---|---|---|---|
| **62 98147-5130** (`f46221b3`) | `estado_pool = restrita`, `pausa_automatica_ate = 23/07 17:36`, motivo **"Business Account locked" (#131031)** | Meta bloqueou a **Business Account** inteira | 424 |
| **62 98265-1759** (`f85424d0`) | Bloqueada no job (template pausado #132015) | Template pausado pela Meta | 0 |

Também há **3 itens pendentes com `instancia_id = NULL`** (órfãos da redistribuição anterior) e o job está com `status = 'erro'`.

## Por que o Reativar "não fez nada"

1. O botão até dispara o worker `envio-meta-massa-burst` para as duas instâncias (vi 4 boots recentes nos logs).
2. Ao entrar, o worker consulta a instância `f46221b3`, vê `estado_pool='restrita'` + `pausa_automatica_motivo` começando com "Business Account locked" — e **sai imediatamente** (comportamento correto: `restrita` = banimento/bloqueio real da Meta, não é apenas RED de qualidade).
3. A outra instância está bloqueada no job por template pausado, então também não envia.
4. Sem worker ativo, ninguém volta o `status` para `rodando`; ele permanece `erro`.

**#131031 "Business Account locked"** é um bloqueio administrativo aplicado pela Meta na Business Account (não no template, não na qualidade). Só a Meta desbloqueia — normalmente após revisão no Business Manager (Contas > Qualidade / Central de Contas).

## O que fazer

### 1. Ação obrigatória fora do sistema (você)
Entrar no **business.facebook.com > Central de Contas / Qualidade da conta** da CNPJ CERTIFICADORA, ver o motivo do lock e solicitar revisão. Enquanto a Business Account estiver *locked*, **nenhum código nosso consegue enviar por essas instâncias** — a Meta rejeita na origem.

### 2. Ação dentro do sistema (eu, quando aprovar)
Como as duas instâncias do job estão indisponíveis, o job precisa ser **encerrado com honestidade** (não faz sentido ficar em loop de retry). Proposta:

a. Marcar o job `ac33474f...` como `cancelado` com `status_motivo` explicando "Business Account bloqueada pela Meta (#131031) + template pausado (#132015)".
b. Devolver os 3 órfãos (`instancia_id = NULL`) ao status correto para não ficarem pendurados.
c. No `CampanhaDetalheDialog`, exibir um alerta vermelho dedicado quando `status_motivo` contiver "Business Account" — orientando abrir o Business Manager (hoje só temos aviso genérico de template pausado).
d. No worker `envio-meta-massa-burst`, quando **todas** as instâncias do job estiverem `restrita`/locked, encerrar o job como `erro` com `status_motivo` claro (hoje ele só faz isso na rota de template pausado, não na de conta bloqueada).

### 3. Depois que a Meta desbloquear a conta
Você me avisa, eu rodo um UPDATE para limpar `estado_pool`, `pausa_automatica_ate` e `pausa_automatica_motivo` da `f46221b3`, e criamos um **novo** job de rajada com os 424 contatos restantes (o job atual fica no histórico como cancelado).

## O que eu NÃO recomendo

- **Forçar `status='rodando'` e disparar o worker de novo:** já foi tentado implicitamente pelo Reativar; a Meta continuará devolvendo #131031 em cada request, gastando cota de API e potencialmente agravando o bloqueio.
- **Ignorar `estado_pool='restrita'` no modo rajada:** `restrita` significa banimento/lock real da Meta, diferente de qualidade RED (que já ignoramos no rajada). Ignorar isso pode levar a suspensão definitiva da BA.

## Aprovar para eu executar

Se você concordar, na próxima etapa eu:
1. Cancelo o job atual com motivo claro.
2. Ajusto o `CampanhaDetalheDialog` para mostrar o alerta específico de "Business Account bloqueada".
3. Ajusto o `envio-meta-massa-burst` para encerrar o job como `erro` explicando o motivo quando todas as instâncias estão locked.

**Nada disso destrava a Meta** — isso depende 100% da revisão no Business Manager. Confirma que posso seguir?
