
Diagnóstico confirmado: o teste manual realmente disparou as 2 mensagens entre essas instâncias, mas a IA não entrou no fluxo.

O que encontrei:
- `whatsapp-aquecimento` enviou com sucesso:
  - `62982197615 10 B1 03/04 → 62982115479 MEMU 37 03/04`
  - `62982115479 MEMU 37 03/04 → 62982197615 10 B1 03/04`
- As duas mensagens chegaram ao Inbox e foram salvas como `entrada`.
- Mesmo assim, não houve criação de registros em `whatsapp_conversas_ia`.
- Também não houve logs do `whatsapp-ia-responder`, então o `whatsapp-chatbot` nem chegou a chamar a IA.

Causa raiz
- O webhook está recebendo os números como:
  - `556282197615`
  - `556282115479`
- Mas as instâncias estão cadastradas como:
  - `62982197615 10 B1 03/04`
  - `62982115479 MEMU 37 03/04`
- Ou seja: o webhook trouxe um formato sem o nono dígito, enquanto a detecção da instância interna hoje depende de `nome.ilike` com o telefone completo.
- Resultado: o `senderInstance` não é encontrado, então a lógica de aquecimento/IA é ignorada.

Plano de correção
1. Fortalecer a identificação da instância interna em `whatsapp-chatbot`
- Parar de depender só de `nome.ilike`.
- Extrair e normalizar o bloco inicial numérico do `nome` da instância.
- Comparar números em formatos equivalentes:
  - com e sem `55`
  - com e sem o nono dígito
- Objetivo: mapear corretamente `556282115479` para `62982115479...` e `556282197615` para `62982197615...`.

2. Criar uma função única de normalização de telefone
- Centralizar a lógica para evitar divergência entre:
  - `whatsapp-aquecimento`
  - `whatsapp-chatbot`
  - `whatsapp-ia-responder`
- Essa função vai gerar chaves comparáveis para matching interno e para salvar no Inbox.

3. Ajustar o teste manual para usar o telefone normalizado do destino
- Hoje ele extrai o destino via regex simples do `nome`.
- Vou trocar por extração/normalização consistente, para reduzir variações no número enviado ao provedor.

4. Melhorar logs de diagnóstico
- Adicionar logs claros no `whatsapp-chatbot` para mostrar:
  - número recebido do webhook
  - candidatos internos encontrados
  - instância casada
  - motivo caso nenhuma seja encontrada
- Isso evita novo “silêncio” se algum formato diferente voltar a acontecer.

5. Validar o fluxo completo esperado
- Mensagem manual é enviada
- Webhook reconhece o remetente como instância interna
- `whatsapp_aquecimento_interacoes` vira `RESPONDIDO`
- `whatsapp-ia-responder` é chamado
- `whatsapp_conversas_ia` passa a registrar a conversa
- Resposta aparece também no Inbox

Arquivos a ajustar
- `supabase/functions/whatsapp-chatbot/index.ts`
- `supabase/functions/whatsapp-aquecimento/index.ts`
- possivelmente `supabase/functions/whatsapp-ia-responder/index.ts` apenas se eu precisar alinhar a mesma normalização no log/salvamento

Detalhe técnico
- O problema não é mais o disparo manual.
- O problema agora está na camada de reconhecimento do “número interno” após o webhook.
- O padrão atual baseado em string parcial no campo `nome` é frágil para diferenças de formatação de telefone, especialmente quando o provedor devolve números sem o nono dígito.

Resultado esperado após a correção
- Essas mesmas duas instâncias passarão a se reconhecer como internas mesmo com formatação divergente.
- A IA deverá responder no intervalo configurado.
- A conversa deverá ficar visível no Inbox e também em `whatsapp_conversas_ia`.
