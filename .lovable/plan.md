

## Corrigir salvamento de contatos na agenda do WhatsApp (Aquecimento)

### Diagnóstico
Investiguei os logs da edge function `whatsapp-ia-responder` e confirmei:
- A conversa entre MEMU 0 e MEMU 1 aconteceu normalmente (12 mensagens trocadas)
- **Nenhum log de salvamento de contato foi encontrado** ("📱 Contato salvo na agenda" ou "📇 Contato criado")
- O código de salvamento de contatos existe no source (linhas 331-377 da action `iniciar-conversa`), mas **não foi executado na versão deployed**

A causa mais provável é que a versão com o código de contact-saving **não foi deployada** após a última edição. Além disso, o endpoint UAZAPI pode estar incorreto.

### Correções

#### 1. Redeployar a edge function
- Fazer deploy da versão atual do `whatsapp-ia-responder` que já contém o código de salvamento

#### 2. Adicionar logs mais detalhados no salvamento de contatos
- Adicionar log antes de tentar salvar: `[IA] Tentando salvar contatos na agenda...`
- Logar os parâmetros (números, nomes, URLs) para debug
- Logar erros com mais detalhes caso a UAZAPI rejeite

#### 3. Testar o endpoint correto da UAZAPI para adicionar contatos
- Os endpoints atuais são `/contact/add` e `/contacts/add`
- Verificar se o endpoint correto não é outro (ex: `/contacts/upsert` ou `/contact/upsert`)
- Adicionar fallback com mais variações de endpoints

#### 4. Garantir salvamento também no `gerar-resposta` (backup)
- Atualmente, o salvamento só ocorre na action `iniciar-conversa`
- Se por algum motivo a parte de salvamento falhar na inicialização, nunca mais tenta
- Adicionar verificação no primeiro `gerar-resposta` de cada conversa: se os contatos ainda não existem na agenda, salvá-los

### Arquivos
1. **`supabase/functions/whatsapp-ia-responder/index.ts`** — logs detalhados + salvamento backup no gerar-resposta
2. **Deploy** da edge function

### Resultado
Os contatos serão salvos na agenda física do WhatsApp de ambos os dispositivos assim que a conversa for iniciada.

