# Voltar o número do site para (62) 98218-3144

## O que muda
1. **Site/portal**: cabeçalho, rodapé, Central de Atendimento e botão flutuante do WhatsApp passam a mostrar (62) 98218-3144 (Novo Mundo, UME, Odres e domínio principal). O subdomínio do Luiz Carlos continua com o número dele.
2. **Link do boleto** (página que abre o WhatsApp com mensagem pronta) passa a levar ao 62 98218-3144.
3. **Respostas automáticas do robô e da IA** que citam o telefone de contato passam a mostrar o novo número.

## Observação
O link "verificar proposta Odres" (61 98253-5396) não é alterado. Os cadastros de domínio salvos no banco também serão conferidos e atualizados se tiverem o número antigo.

## Detalhes técnicos
- `src/lib/contatoPorDominio.ts`, `src/lib/credorConfig.ts`: `5562982183144` / `(62) 98218-3144`.
- `src/pages/RedirectBoleto.tsx`: wa.me para 5562982183144.
- `src/components/ChatbotTemplatesTab.tsx`, `supabase/functions/whatsapp-chatbot/index.ts`, `supabase/functions/meta-ia-atendimento/index.ts`: substituir texto e reimplantar.
- Atualizar linhas de `portal_dominios` com telefone 5562981746479.
