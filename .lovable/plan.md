# Exibir corretamente mensagens recebidas no Inbox Meta

A mensagem recebida hoje às **08:18**, do número **+44 79 7490-5007**, foi gravada com o tipo retornado pela própria Meta: `unsupported`. O sistema atual converte qualquer formato não reconhecido em `[tipo]`, por isso apareceu `[unsupported]`. O conteúdo original desse evento não foi preservado e não aparece nos registros disponíveis, então não é possível reconstruir com segurança o texto ou a mídia dessa mensagem específica.

## O que será corrigido

- Ampliar a leitura das mensagens oficiais para cobrir os formatos que hoje podem cair no tratamento genérico, incluindo localização, endereço, pedido/produto, referência de anúncio, respostas interativas, contatos, reações e demais formatos documentados que tragam conteúdo aproveitável.
- Preservar, para novas mensagens não reconhecidas, o tipo real e os dados úteis recebidos da Meta. Assim, novos formatos poderão ser corrigidos e recuperados sem perder a informação original.
- Substituir `[unsupported]` por um aviso claro quando a própria Meta não entregar o conteúdo, sem inventar texto nem mídia: **“Mensagem não disponibilizada pela Meta. Consulte o WhatsApp do número.”**
- Manter imagens, áudios, vídeos, documentos, figurinhas e contatos no formato visual já usado na conversa.
- Não alterar as regras de caixas, etiquetas, IAGO, permissões ou distribuição de atendentes.

## Tratamento das mensagens já existentes

- Revisar as **229 mensagens** atualmente gravadas como `[unsupported]`.
- Recuperar automaticamente apenas as que tiverem dados originais suficientes em registros disponíveis; as demais receberão o aviso claro, pois a Meta não oferece consulta retroativa do conteúdo pelo identificador da mensagem.
- A mensagem das 08:18 continuará vinculada à conversa correta e deixará de mostrar o texto técnico `[unsupported]`, mas o conteúdo original só poderá ser visto no WhatsApp do aparelho porque não foi entregue nem preservado pelo webhook.

## Validação

- Testar cada formato suportado com exemplos controlados, sem enviar mensagens para clientes reais.
- Confirmar que nenhuma entrada recebida fica vazia ou aparece como `[unsupported]`.
- Confirmar que grupos e status continuam bloqueados e que não há duplicação de mensagens.

## Detalhes técnicos

- Ajustar o parser do webhook oficial antes da gravação em `meta_whatsapp_mensagens`.
- Adicionar armazenamento restrito do fragmento necessário do evento original para diagnóstico e recuperação, sem guardar segredos ou dados desnecessários.
- Aplicar uma correção pontual às mensagens históricas e manter fallback seguro para tipos que a API oficial realmente não disponibiliza.
- Sem polling, cron ou chamadas recorrentes adicionais; impacto de custo desprezível.
