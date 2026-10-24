# Credor errado na mensagem "Gostaria de consultar meu débito com..."

## O que encontrei
- O cliente Wellington (CPF 035.236.964-70) **não tem nenhum débito Novo Mundo nem UME** no sistema. A consulta de hoje mostra a dívida dele **só na Odres Cred** (R$ 1.174,00) — o mesmo valor que o Rodrigo ofereceu.
- A frase "Gostaria de consultar meu débito com Novo Mundo" é escrita automaticamente pelo portal quando o cliente aperta o botão **"Falar sobre [credor]"**.
- Esse botão aparece também nas carteiras em que a consulta **falhou** ("Consulta temporariamente indisponível") — por exemplo quando o portal demora ou quando o cliente consulta várias vezes seguidas. Nesse caso aparecem botões Novo Mundo, UME e Odres, e Novo Mundo vem primeiro. O cliente aperta o primeiro e a mensagem sai com o credor errado.
- Na última semana chegaram 6 mensagens desse tipo dizendo "Novo Mundo". Não dá para provar o que a tela mostrou para o Wellington ontem, mas é a única forma de a mensagem sair com Novo Mundo sem débito Novo Mundo.

## O que será feito
1. **Carteira que falhou não manda mais credor na mensagem.** Nela fica só "Tentar novamente" e um botão de atendimento com o texto neutro: "Olá! Meu CPF é ... Gostaria de consultar meus débitos." Assim o cliente não informa um credor que o sistema não confirmou.
2. **Só um botão de atendimento quando várias carteiras falham**, em vez de um por credor, para não confundir.
3. **Inbox confere o credor pelo CPF.** Quando chegar mensagem do portal com CPF, o sistema verifica em qual carteira o CPF realmente está (Novo Mundo, UME ou Odres Cred) e preenche o "Credor" do cabeçalho com o credor real. Se a mensagem disser outro credor, aparece um aviso: "Mensagem cita Novo Mundo, mas o CPF está na Odres Cred". Se o CPF não for encontrado, o cabeçalho fica "definir" como hoje.
4. Corrigir agora o cabeçalho da conversa do Wellington para **Odres Cred**.

Sem custo novo: a conferência é uma consulta rápida só quando chega a mensagem do portal, sem rotina agendada.

## Detalhes técnicos
- `PortalWalletSection.tsx`: botão "Falar sobre" só quando `estado` não é `error`; erro usa texto sem credor. `PublicPortalResults.tsx`: um único botão neutro quando há carteiras com erro.
- Webhook/Inbox Meta: ao detectar "Meu CPF é X" em entrada, resolver credor via `devedores` (credor) + `portal_odres_identificado`; gravar `meta_whatsapp_contatos.credor` apenas se estiver vazio; aviso visual quando divergir do texto.
- Atualizar o contato do telefone 5584987598096 para `odres_cred`.
- Teste: texto do botão de carteira com erro não contém nome de credor.
