# Trocar o número 62 98218-3144 por 62 98174-6479

Sim, as duas trocas são possíveis.

## O que muda
1. **Site/portal**: telefone exibido no cabeçalho, rodapé, Central de Atendimento e botão flutuante do WhatsApp passa a ser (62) 98174-6479 (Novo Mundo, UME e domínio principal). O subdomínio do Luiz Carlos continua com o número dele.
2. **Mensagem com link para o boleto/WhatsApp**: a página de redirecionamento que abre o WhatsApp com mensagem pronta passa a levar ao 62 98174-6479.
3. **Respostas automáticas do robô e da IA**: textos "entre em contato: (62) 98218-3144" passam a mostrar o novo número; a variável {telefone_contato} também.
4. **Aquecimento**: o número banido sai da lista de destinos fixos do aquecimento.

## Observação
Os modelos aprovados da Meta não contêm o número antigo (conferido). Se algum modelo usa um link curto do site, ele passa automaticamente a apontar para o novo número, sem nova aprovação.

## Detalhes técnicos
- `src/lib/contatoPorDominio.ts`, `src/lib/credorConfig.ts`: phone `5562981746479`, display `(62) 98174-6479`.
- `src/pages/RedirectBoleto.tsx`: wa.me para 5562981746479.
- `src/components/ChatbotTemplatesTab.tsx`, `supabase/functions/whatsapp-chatbot/index.ts`, `supabase/functions/meta-ia-atendimento/index.ts`: substituir texto; redeploy.
- `supabase/functions/aquecimento-envio-autosave/index.ts`: remover 5562982183144 da lista; redeploy.
- `src/pages/WhatsAppInbox.tsx` (lista de números próprios) mantém o antigo para histórico.
