## Problema

A Meta bloqueia botões de template que apontam diretamente para `wa.me` / `api.whatsapp.com`. Precisamos de uma URL "neutra" que, ao ser clicada, redirecione o cliente para o WhatsApp já com o número e a mensagem pré-preenchida.

## Solução proposta

Criar uma rota de redirecionamento no próprio domínio do app (`meusacordos.com.br`), que a Meta aceita normalmente por ser um domínio próprio (não é `wa.me`).

### Link final que você vai colar no botão da Meta

```
https://meusacordos.com.br/ir/boleto
```

Quando o cliente clicar, o navegador abre nossa página, que imediatamente executa `window.location.replace(...)` para:

```
https://wa.me/5562982183144?text=Ol%C3%A1!%20Recebi%20uma%20mensagem%20e%20quero%20solicitar%20meu%20boleto%20para%20pagamento.
```

Resultado: o WhatsApp abre com a conversa do 62 98218-3144 e a mensagem "Olá! Recebi uma mensagem e quero solicitar meu boleto para pagamento." já digitada.

### Implementação

1. **Novo arquivo `src/pages/RedirectBoleto.tsx`** — componente mínimo que, no `useEffect`, faz `window.location.replace` para o `wa.me`. Mostra um "Abrindo WhatsApp..." como fallback caso o redirect demore.

2. **`src/App.tsx`** — registrar a rota pública `/ir/boleto` apontando para o novo componente (fora de qualquer guarda de autenticação).

3. **(Opcional futuro)** deixar a rota parametrizável por slug (`/ir/:slug`) lendo destinos de uma tabela, caso queira criar outros links curtos depois. Não faz parte deste plano.

### Por que funciona com a Meta

O botão do template aponta para `https://meusacordos.com.br/ir/boleto` — um domínio próprio, categoria "URL do site". A Meta valida somente o domínio de destino do botão; o redirect subsequente para o WhatsApp acontece no navegador do cliente, exatamente como qualquer link encurtado (bit.ly, etc.).

### Alternativa sem código

Se preferir não publicar código agora, dá para usar um encurtador (bit.ly, tinyurl) apontando para o mesmo `wa.me`. Funciona, mas fica dependente de serviço externo — recomendo a rota própria acima.
