## Objetivo

Fazer com que a extração por IA (Novo Acordo > "Preencher com IA") leia as siglas do credor no print e selecione automaticamente o credor correto:

- **NM-AP** → UME | APORTE (`mundo_da_moda`)
- **NM-I** ou **NM-AP-I** / **NM-INAD** → UME | INADIMPLENTES (`ume_novo_mundo`)

Hoje a IA extrai os dados do cliente/parcelas, mas o credor sempre fica no padrão "UME | INADIMPLENTES" e o usuário precisa trocar manualmente.

## Mudanças

### 1. `supabase/functions/extract-acordo-data/index.ts`
- Acrescentar instrução no `systemPrompt` ensinando a IA a procurar pelas siglas (geralmente aparecem ao lado do número do contrato, ex.: "NM-AP - Atraso: 171" ou "NM-I - Atraso: 171") e mapeá-las:
  - `NM-AP` → `mundo_da_moda`
  - `NM-I` → `ume_novo_mundo`
  - Se não encontrar nenhuma sigla, retornar `null` (o front mantém o padrão atual).
- Adicionar o campo `empresa` no schema do tool call (`extract_acordo_data`) como string opcional com enum `["ume_novo_mundo", "mundo_da_moda"]`.

### 2. `src/components/ImageDataExtractor.tsx`
- Adicionar `empresa: 'ume_novo_mundo' | 'mundo_da_moda' | null` à interface `ExtractedData`.

### 3. `src/pages/NovoAcordo.tsx`
- No `handleDataExtracted`, se `data.empresa` vier preenchido, chamar `setEmpresa(data.empresa)` antes do `setForm`.
- Mostrar no toast qual credor foi detectado (ex.: "Credor detectado: UME | APORTE") para o usuário poder validar.

## Observações

- Não muda a UI: o seletor de credor continua manual e editável depois da extração.
- Não afeta acordos existentes nem a edição (que já permite trocar o credor).
- Não há custo adicional relevante na chamada de IA — apenas um campo a mais no mesmo tool call.
