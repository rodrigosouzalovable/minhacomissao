# Nova Conversa Meta: template primeiro, instâncias compatíveis e prévia ao vivo

## Objetivo

Reorganizar o diálogo **Nova conversa Meta** para que a escolha comece pelo template. Depois disso, mostrar somente os números Meta nos quais esse mesmo template está **liberado e aprovado**, exigir o preenchimento de todas as variáveis e exibir a mensagem final em tempo real antes do envio.

## Fluxo da tela

1. **Selecionar o template**
   - Carregar os templates de utilidade disponíveis e agrupá-los por nome e idioma, sem repetir o mesmo template para cada instância.
   - Mostrar nome, idioma e texto do template para facilitar a escolha.

2. **Selecionar a instância compatível**
   - Após escolher o template, liberar o seletor de instância.
   - Exibir somente as instâncias que possuem aquele template com status aprovado.
   - Se nenhuma instância compatível estiver disponível, informar isso e manter o envio bloqueado.

3. **Preencher o destinatário e as variáveis**
   - Manter telefone e nome do contato.
   - Detectar todos os campos presentes no cabeçalho e no corpo do template.
   - Criar um campo obrigatório para cada variável, tanto numérica (`{{1}}`, `{{2}}`) quanto nomeada (`{{nome}}`).
   - Usar os exemplos salvos pela Meta como orientação quando existirem, sem preenchê-los como dados reais do cliente.

4. **Pré-visualizar antes de enviar**
   - Atualizar a prévia estilo WhatsApp imediatamente enquanto cada campo é digitado.
   - Preservar cabeçalho, corpo, rodapé, mídia e botões do template.
   - Manter os campos ainda vazios destacados na prévia e bloquear o envio enquanto faltar alguma variável.

5. **Enviar com a combinação correta**
   - Usar o registro aprovado do template correspondente à instância escolhida, evitando enviar o identificador de outra instância.
   - Limpar instância e variáveis quando o template for trocado.
   - Manter a caixa atual da Inbox, o atendente, os avisos de indisponibilidade e a abertura da conversa após o envio.

## Detalhes técnicos

- Ajustar o diálogo existente em `src/components/inbox/meta/MetaNovaConversaDialog.tsx`.
- Reaproveitar e ampliar `src/components/meta/TemplateWhatsAppPreview.tsx` para substituir variáveis numéricas e nomeadas em tempo real, inclusive no cabeçalho.
- Agrupar os registros de `meta_whatsapp_templates` por `nome_template + idioma`; cada grupo manterá o vínculo entre `instancia_id` e o `template_id` aprovado daquela instância.
- Reforçar `send-whatsapp-meta` para confirmar que o template enviado pertence à instância selecionada e continua aprovado antes de chamar a Meta.
- Não criar tabela, agendamento, polling ou consulta recorrente; a carga ocorrerá somente ao abrir o diálogo.

## Validação

- Testar template sem variável, com uma variável, com várias variáveis numéricas e com variáveis nomeadas.
- Confirmar que a lista mostra somente instâncias realmente aprovadas para o template escolhido.
- Confirmar troca de template, limpeza dos campos dependentes e bloqueio por campo vazio.
- Confirmar que a prévia acompanha cada edição e que o texto salvo na conversa coincide com o enviado.
- Validar envio, erros da Meta, visual em tela pequena e compilação completa.
