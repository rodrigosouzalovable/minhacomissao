## Filtro automático "tem WhatsApp" antes do disparo Meta

Adicionar uma etapa de validação de números via UAZAPI antes do disparo em massa pela Meta. Ao clicar em **Disparar**, o sistema valida todos os destinatários, mostra um resumo e envia apenas para os que têm WhatsApp.

### Mudanças na tela `Envio em massa — Meta WhatsApp` (`src/pages/EnvioMeta.tsx`)

1. **Novo seletor "Instância validadora (UAZAPI)"** abaixo do bloco de delay:
   - Carrega instâncias da tabela `user_whatsapp_instances` do usuário com `status = 'connected'`.
   - Mostra nome + telefone de cada instância.
   - Campo opcional: se vazio, pula a validação e dispara direto (comportamento atual).

2. **Fluxo no botão Disparar**:
   - Se a instância validadora estiver selecionada:
     1. Chama a edge function existente `check-whatsapp-numbers` passando todos os telefones, `server_url` e `instance_token` da instância escolhida.
     2. Exibe um `confirm()` com o resumo: `X com WhatsApp · Y sem WhatsApp · Z erros de validação · enviar para X?`
     3. Se confirmado, envia apenas os destinatários `valid` (mais os `errors`, opcionalmente — ver decisão abaixo) para `send-whatsapp-meta`.
   - Se a instância validadora não estiver selecionada: mantém o fluxo atual (envia para todos).

3. **Estado de loading**: durante a validação, mostrar spinner com texto "Validando WhatsApp..." no botão.

4. **Decisão de inclusão dos "erros"**: por padrão, **descartar também os erros** (mais seguro, evita gastar mensagem Meta em número que não pôde ser validado). O resumo deixa isso claro.

### Detalhes técnicos

- A edge function `check-whatsapp-numbers` já existe e processa em lotes de 15 com concorrência 3 e timeout/retry — sem alterações necessárias.
- Cada instância em `user_whatsapp_instances` tem `server_url` e `instance_token` (já usados por outras telas — replicar o padrão de busca).
- Nenhuma mudança em banco, edge function ou no cálculo de custo (`useMetaWhatsAppCusto`).
- O custo só é recalculado depois do envio bem-sucedido, como já está.

### Fora de escopo

- Não criar tela de gestão de "números sem WhatsApp" — apenas resumo no confirm.
- Não persistir resultado da validação (cada disparo revalida).
- Sem alteração no round-robin entre instâncias Meta.
