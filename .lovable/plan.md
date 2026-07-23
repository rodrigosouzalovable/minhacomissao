
## Objetivo

Na aba **Envio Meta**, adicionar uma forma de visualizar (e reutilizar) os contatos que estão dentro da janela de 24h — os mesmos que aparecem com bolinha 🟢 (aberta) e 🟡 (fecha em <1h) no Inbox Meta. Hoje o Envio Meta só aceita telefones colados manualmente; não há ligação com a lista real de conversas ativas.

## O que será criado

### 1. Botão "Janela 24h" no bloco "3. Destinatários"

Ao lado do campo de colar destinatários (`EnvioMeta.tsx`, próximo aos botões atuais como "Baixar Excel"), um novo botão:

```
🟢 Janela 24h (N)
```

O número `N` é o total de contatos com janela aberta em todas as instâncias Meta ativas do usuário. Atualiza a cada 60s.

### 2. Dialog "Conversas na janela de 24h"

Ao clicar, abre um dialog com layout parecido com o filtro por etiqueta do Inbox:

- **Filtros no topo (chips)**:
  - `Todas (N)` — verdes + amarelas
  - `🟢 Aberta (N)` — mais de 1h restante
  - `🟡 Fecha em breve (N)` — menos de 1h
  - Seletor de instância (opcional, "Todas" por padrão)
  - Campo de busca por nome/telefone

- **Lista**: cada linha mostra
  - Bolinha 🟢/🟡
  - Nome + telefone
  - Instância de origem
  - "Fecha em Xh Ym" (countdown via `nowTick` a cada 30s, mesma lógica do Inbox)
  - Checkbox de seleção

- **Rodapé**:
  - `Selecionar todos` / `Limpar seleção`
  - Botão **"Importar para destinatários"** → concatena os telefones (`+ \n` no fim) no `recipientsRaw` existente e fecha o dialog, com toast `X contatos importados`.

### 3. Fonte de dados

Query em `meta_whatsapp_contatos`:

```
select id, instancia_id, telefone, nome, ultima_msg_entrada_em
where user_id = auth.uid()
  and arquivado = false
  and ultima_msg_entrada_em >= now() - interval '24 hours'
order by ultima_msg_entrada_em desc
limit 2000
```

Classificação verde/amarelo reutiliza a lógica de `computeJanela` já existente no `InboxMeta.tsx`:
- `msRestante > 1h` → aberta (verde)
- `0 < msRestante <= 1h` → alerta (amarelo)
- `<= 0` → filtrado fora (fechada, cinza)

Constantes `JANELA_24H_MS` e `ALERTA_1H_MS` importadas do mesmo local (ou duplicadas se não exportadas).

### 4. Integração com o fluxo de envio

- **Nenhuma** mudança no worker de disparo. Os telefones importados entram pelo mesmo caminho de `recipientsRaw` → `parseRecipients` → validação → envio, então as travas de qualidade, rajada, template etc. continuam iguais.
- Se o usuário importar contatos na janela 24h **e** selecionar um template MARKETING, o cálculo de custo já existente vai marcá-los como "Grátis (janela 24h)" automaticamente — nenhum ajuste extra necessário.

## Detalhes técnicos

- Arquivo principal: `src/pages/EnvioMeta.tsx` (adicionar estado `janelaDialogOpen`, contador, e o dialog).
- Novo componente: `src/components/meta/Janela24hDialog.tsx` (para não engordar ainda mais o `EnvioMeta.tsx`).
- Hook local `useContatosJanela24h(instanciaIds?: string[])`:
  - `useQuery` com `staleTime: 60s`
  - `refetchInterval: 60_000` apenas quando `document.visibilityState === "visible"` (respeita a regra de custo Cloud)
  - Retorna `{ contatos, verde: [], amarelo: [], loading }`

- Countdown por linha: `useState<number>(Date.now())` + `setInterval(30_000)` só quando o dialog está aberto.

- Nenhuma migração SQL, nenhum edge function novo, nenhuma alteração em backend.

## Fora do escopo

- Não altera o Inbox Meta.
- Não altera a lógica de envio, custo, rajada, guardrails.
- Não persiste seleção entre sessões.
