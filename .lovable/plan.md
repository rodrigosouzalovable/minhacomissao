## Diagnóstico encontrado

- O número **62 98172-7082** está cadastrado como a instância **IPHONE B7**.
- O webhook responde corretamente no teste de verificação.
- Após o clique em **Assinar todas as instâncias ativas**, o backend registrou chamadas para a função de assinatura.
- Porém, **não existe nenhum POST chegando no webhook `meta-whatsapp-webhook`** e as tabelas do Inbox Meta continuam sem mensagens.

Conclusão: o problema ainda está antes do Inbox. A Meta não está entregando eventos `messages` para o nosso webhook, mesmo a tela mostrando “assinado”. Precisamos melhorar a assinatura para forçar o callback correto e criar um diagnóstico que mostre exatamente se o campo `messages` está ativo para cada WABA.

## Plano de correção

1. **Corrigir a função de assinatura das WABAs**
   - Atualizar `meta-subscribe-waba` para enviar também:
     - `override_callback_uri` com o webhook oficial do sistema.
     - `verify_token` compartilhado salvo no sistema.
   - Isso força a WABA a usar o endpoint correto mesmo se o app Meta estiver com outro callback configurado.

2. **Remover ação arriscada de registro com PIN fixo**
   - A função hoje tenta chamar `/phone_number_id/register` com PIN `000000`.
   - Isso não é necessário para receber webhook e pode gerar erro/confusão em números já conectados pela HookCloud/Meta.
   - Vou remover essa etapa da assinatura automática.

3. **Criar diagnóstico real por instância**
   - A resposta do botão vai mostrar, para cada número:
     - Se a assinatura da WABA deu certo.
     - Se a Meta aceitou o callback do nosso webhook.
     - A lista de apps inscritos retornada pela Meta.
     - Qual erro bruto a Meta retornou, se houver.

4. **Melhorar a tela “API Oficial Meta WhatsApp”**
   - Exibir um status mais claro: “Assinado e callback confirmado” ou “Assinado, mas verifique o campo messages no painel Meta”.
   - Adicionar orientação visual para o caso em que o subscribe está OK, mas o campo **messages** não está marcado no app da Meta.

5. **Testar o fluxo após a correção**
   - Revalidar o GET do webhook.
   - Rodar novamente a assinatura das 3 instâncias.
   - Conferir nos logs se, após você mandar nova mensagem para **62 98172-7082**, aparece POST no webhook e o contato entra no Inbox.

## Arquivos envolvidos

- `supabase/functions/meta-subscribe-waba/index.ts`
- `src/pages/ConfigurarMeta.tsx`

## Observação importante

Se depois disso ainda não chegar POST, o único ponto restante será no painel da Meta: o campo **messages** precisa estar marcado nos Webhook Fields do produto WhatsApp. O sistema vai passar a mostrar essa suspeita claramente em vez de apenas exibir o check verde genérico.