## Diagnóstico

O problema não é mais apenas formatação do telefone. O teste real mostrou dois eventos para a mesma ação:

- Conversa correta: instância `IPHONE B8`, telefone do cliente `5562982183144`, mensagem recebida `HELLO`.
- Conversa espelho indevida: instância `Novo Mundo 3144`, telefone `556281748929`, também com `HELLO`.

Isso acontece porque o número do cliente `62982183144` também está cadastrado como uma instância Meta oficial no sistema. Quando ele responde pelo WhatsApp Web, a Meta envia um evento de coexistência/eco nessa outra instância, e o webhook salva isso como se fosse uma nova conversa.

## Plano de correção

1. **Ajustar o webhook Meta para ignorar conversas entre instâncias próprias**
   - Antes de salvar uma mensagem recebida/echo, verificar se o “outro lado” também pertence a algum número oficial Meta cadastrado no sistema.
   - Se pertencer, não criar contato e não inserir mensagem no Inbox.
   - Isso evita que respostas feitas por um número que também é instância oficial virem uma segunda conversa.

2. **Fortalecer a detecção por sufixo de telefone**
   - Comparar os últimos 8 dígitos dos telefones, mantendo a regra já usada no projeto.
   - Funciona mesmo com variação com/sem nono dígito.

3. **Limpar a conversa espelho já criada nesse teste**
   - Remover apenas os registros indevidos do contato `556281748929` na instância `Novo Mundo 3144` referentes a esse eco.
   - Não apagar a conversa correta do cliente na instância `IPHONE B8`.

4. **Deploy da função corrigida**
   - Publicar a função `meta-whatsapp-webhook` atualizada.
   - Validar consultando o banco depois: deve sobrar uma única conversa para esse atendimento.

## Resultado esperado

Quando você enviar template para `629882183144` pela instância correta e responder pelo WhatsApp Web desse número, a resposta ficará dentro da mesma conversa do Inbox Meta, sem abrir uma segunda janela/conversa espelho.