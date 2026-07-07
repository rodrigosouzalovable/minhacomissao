## Objetivo
Corrigir o fluxo “Nova conversa Meta” para qualquer usuário autenticado conseguir selecionar instância, ver apenas os templates aprovados daquela instância, pré-visualizar no mesmo formato da tela Envio Meta (massa) e enviar o template.

## Plano de implementação

1. **Permissões de leitura para funcionários**
   - Criar uma migração para permitir que usuários autenticados visualizem instâncias Meta ativas e templates aprovados de utilidade.
   - Manter alterações administrativas restritas aos donos/admins atuais.
   - Não liberar templates de marketing nesse fluxo, para preservar a trava de economia/custos.

2. **Diálogo “Nova conversa Meta”**
   - Ajustar a busca de templates para carregar somente templates `approved` + `UTILITY` + `instancia_id` da instância selecionada.
   - Adicionar estado de carregamento/erro para evitar o dropdown ficar vazio sem explicação.
   - Garantir que o botão “Enviar template” só dependa de: instância, telefone e template selecionados, sem restrição por cargo.

3. **Pré-visualização igual ao Envio Meta (massa)**
   - Reutilizar o componente visual `TemplateWhatsAppPreview` dentro do diálogo.
   - A prévia aparecerá após selecionar instância e template, mostrando header/imagem, texto, rodapé e botões exatamente como no preview da tela de envio em massa.
   - Substituir o preview simples em bloco cinza pelo card estilo WhatsApp.

4. **Consistência do envio**
   - Confirmar que o envio continua chamando a função com `template_id`, `instancia_id` e `cliente.telefone`.
   - Preservar nome digitado para preencher variáveis quando o template for enviado.

## Arquivos previstos
- `src/components/inbox/meta/MetaNovaConversaDialog.tsx`
- Nova migração SQL em `supabase/migrations/` para permissões de leitura autenticada em instâncias/templates Meta aprovados.

## Observação de custo
Essa mudança não cria infraestrutura nova nem aumenta custos por si só. O único custo segue sendo o envio real de mensagens Meta quando o usuário clicar em enviar.