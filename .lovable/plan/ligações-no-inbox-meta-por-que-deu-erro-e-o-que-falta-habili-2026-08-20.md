# Ligações no Inbox Meta: por que deu erro e o que falta habilitar

## Respondendo suas dúvidas

**1. O erro atual não é da Meta.** A mensagem completa é "Failed to send a request to the Edge Function": o navegador não conseguiu nem falar com a função de chamadas no backend. Nenhuma das quatro funções de chamada (`meta-call-start`, `meta-call-action`, `meta-call-permission-request`, `meta-call-settings`) aparece nos registros do backend, ou seja: o código existe no projeto, mas ainda não foi publicado no servidor. Enquanto isso não acontece, qualquer clique no telefone falha antes de chegar à Meta.

**2. Onde habilitar a chamada na instância — dois lugares:**
- No painel da Meta (WhatsApp Manager → o número → Calling / Chamadas de voz): esse é o pré-requisito obrigatório, feito uma vez por número. Sem isso a Meta recusa a sinalização.
- No nosso sistema: aba **API Oficial Meta** → card da instância → botão **"Chamadas OFF/ON"** (já criado). Ele chama a API da Meta e liga o recurso naquele número.

**3. Você NÃO precisa esperar o template `pedido_permissao_chamada` para o seu teste.** Dentro da janela de 24h (é o seu caso: a conversa está "Aberta · fecha em 24 horas") o pedido de permissão vai como mensagem interativa nativa, sem template. O template UTILITY só é necessário para pedir permissão a quem está com a janela fechada — aí sim ele precisa estar aprovado.

## O que será feito

1. **Publicar as quatro funções de chamada** no backend (`meta-call-start`, `meta-call-action`, `meta-call-permission-request`, `meta-call-settings`) e republicar o webhook que já foi atualizado para capturar eventos de chamada.
2. **Testar a função de permissão** de ponta a ponta com a instância Novo Mundo 3144 e o seu número, lendo a resposta real da Meta.
3. **Melhorar a mensagem de erro no botão de ligar**: hoje falhas de rede/deploy aparecem como "Não foi possível pedir a permissão" com um texto técnico. Passará a distinguir três casos, em português claro:
   - backend indisponível → "Recurso de chamadas ainda não publicado no servidor";
   - chamadas desligadas no número → "Ative as chamadas de voz neste número na aba API Oficial Meta";
   - recusa da Meta → texto humanizado do erro da Meta (ex.: número sem Calling habilitado no painel).
4. **Bloquear o botão quando o número não tem chamadas habilitadas**, com dica explicando onde ativar, em vez de deixar o usuário clicar e receber erro.
5. Se o teste do passo 2 mostrar que a Meta exige o Calling habilitado no painel dela para o número Novo Mundo 3144, informo exatamente qual passo você precisa fazer lá (é uma configuração de conta, não de código).

## Detalhes técnicos

- Deploy das funções em `supabase/functions/meta-call-*` e de `meta-whatsapp-webhook`.
- `src/contexts/MetaCallContext.tsx`: tratar `FunctionsFetchError`/`FunctionsHttpError` separadamente, ler `error.context.text()` e usar `data.error`/`data.details` para o texto exibido.
- `src/pages/InboxMeta.tsx`: usar `chamadas_habilitadas` da instância ativa para desabilitar o botão de ligar e ajustar o tooltip.
- Nenhuma tabela, cron, polling ou canal Realtime novo — custo de backend inalterado.
