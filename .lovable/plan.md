

## Verificação de números WhatsApp na importação (Acionamento + Campanhas de Voz)

### Objetivo
Ao importar planilha no Acionamento ou Campanhas de Voz, verificar automaticamente quais números possuem WhatsApp usando o endpoint `POST /chat/check` da UAZAPI e remover os que não têm.

### Como funciona o endpoint UAZAPI
- **URL**: `{server_url}/chat/check`
- **Header**: `token: {instance_token}`
- **Body**: `{ "numbers": ["5511999999999", "5562981034702"] }`
- Aceita array de números e retorna resultado para todos de uma vez
- Retorna se cada número está registrado no WhatsApp ou não

### Implementação

#### 1. Nova Edge Function `check-whatsapp-numbers`
- Recebe array de telefones + credenciais UAZAPI (server_url, instance_token)
- Formata números (adiciona 55 se necessário)
- Chama `POST {server_url}/chat/check` com `{ numbers: [...] }`
- Retorna lista separada: `{ valid: [...], invalid: [...] }`
- Divide em lotes de 50 números se necessário para evitar timeout

#### 2. Acionamento (`src/pages/Acionamento.tsx`)
- Após importar planilha e parsear os contatos, exibir botão "Verificar WhatsApp"
- Ao clicar, usa a primeira instância conectada para verificar todos os números
- Mostra progresso (verificando X de Y...)
- Remove automaticamente os sem WhatsApp e exibe resumo: "X válidos, Y removidos"
- Contatos removidos ficam visíveis em uma seção colapsável para referência

#### 3. Campanhas de Voz (`src/pages/CampanhasVoz.tsx`)
- Mesma lógica após importar contatos da planilha
- Botão "Verificar WhatsApp" aparece quando há contatos importados
- Remove inválidos antes de criar a campanha

#### 4. Config no `supabase/config.toml`
- Adicionar `[functions.check-whatsapp-numbers]` com `verify_jwt = false`

### Arquivos
1. **`supabase/functions/check-whatsapp-numbers/index.ts`** — nova edge function
2. **`src/pages/Acionamento.tsx`** — botão de verificação pós-importação
3. **`src/pages/CampanhasVoz.tsx`** — botão de verificação pós-importação
4. **`supabase/config.toml`** — registro da nova function

### Resultado
Toda planilha importada passará por verificação automática, garantindo que apenas números com WhatsApp ativo recebam mensagens, reduzindo erros e banimentos.

