# Inbox Meta — Persistência de conversas + Confirmação de envio de arquivo

## 1. Conversas respondidas somem? (resposta + verificação)

Analisei `src/pages/InboxMeta.tsx` (`fetchContatos`) e a listagem lateral. **Não existe nenhuma regra que esconda automaticamente conversas com resposta do cliente.**

A listagem só filtra por um campo: `arquivado`. Uma conversa só sai da aba "Conversas" se:
- Alguém clicar em **Arquivar** (individual ou em massa), OU
- O contato for excluído manualmente.

Ou seja: conversas iniciadas que receberam resposta **permanecem** na lista principal normalmente. Nada é apagado nem ocultado quando o cliente responde.

Não farei nenhuma alteração aqui — o comportamento já é o que você quer. Se em algum momento você viu uma conversa sumir, provavelmente foi arquivada (aba "Arquivados" no topo da lista) ou excluída. Posso investigar um caso específico se quiser me passar o telefone/CPF.

## 2. Confirmação antes de enviar arquivo (PDF/imagem)

Hoje, ao arrastar um arquivo para dentro da conversa (ou colar imagem, ou usar o clipe 📎), o sistema chama `enviarMidia(file)` **imediatamente**, sem pedir confirmação. Isso permite envios acidentais.

### Mudança

Adicionar um **diálogo de pré-visualização e confirmação** entre "usuário soltou o arquivo" e "envio para a Meta".

Fluxo novo:
1. Usuário arrasta um PDF ou imagem para a área da conversa.
2. Abre um dialog modal centralizado com:
   - **Pré-visualização**: miniatura da imagem OU ícone de PDF + nome do arquivo + tamanho (KB/MB).
   - Nome do contato / telefone de destino em destaque (para evitar mandar na conversa errada).
   - Campo opcional de **legenda** (imagem/PDF suportam caption na Meta).
   - Botão **Cancelar** (fecha, não envia).
   - Botão **Enviar** (dispara `enviarMidia` com o arquivo + caption).
3. Enquanto o envio acontece, o botão "Enviar" mostra spinner e bloqueia fechamento acidental.
4. Após sucesso ou erro, o dialog fecha e o toast normal aparece.

### Onde aplicar

Aplicar o dialog em **todas** as entradas de arquivo para consistência (não só drag), porque o risco de "envio acidental" é o mesmo:

- **Drop** na área da conversa (linha 830 de `InboxMeta.tsx`).
- **Drop** no rodapé/composer (linha 1026).
- **Paste** de imagem do clipboard (linha 580).
- **Clique no clipe 📎** (seletor de arquivo dentro do `MetaComposer`).

Se você preferir manter o clique no clipe 📎 com envio direto (fluxo mais rápido para quem já escolheu o arquivo num diálogo do SO) e aplicar a confirmação **só em drag + paste**, me avise no feedback deste plano.

### Detalhes técnicos

- Criar componente novo `src/components/inbox/meta/ConfirmarEnvioArquivoDialog.tsx` (dialog shadcn com preview + caption + botões).
- Em `InboxMeta.tsx`:
  - Novo state `arquivoParaConfirmar: { file: File } | null`.
  - Handlers de drop/paste passam a fazer `setArquivoParaConfirmar({ file })` em vez de chamar `enviarMidia` direto.
  - Renderizar `<ConfirmarEnvioArquivoDialog>` recebendo o arquivo, o nome do contato, callback `onConfirmar(file, caption)` que chama `enviarMidia(file, caption)`, e `onCancelar` que zera o state.
- Ajustar `enviarMidia` para aceitar `caption?: string` opcional e repassar ao invoke da edge `send-whatsapp-meta-media` (o backend já suporta `caption` — vi em `supabase/functions/send-whatsapp-meta-media/index.ts`).
- Para o clipe 📎 dentro de `MetaComposer`: expor via `MetaComposerHandle` ou emitir o `File` via prop `onArquivoSelecionado` para o pai abrir o mesmo dialog (evita duplicar UI).
- Validação de tipo (imagem/PDF) e tamanho continua acontecendo antes de abrir o dialog — arquivo inválido nem chega a mostrar a confirmação, mostra toast.
- Nada de mudança em edge function, RLS, migrations ou banco.

### Fora do escopo

- Não vou mexer em envio de áudio (gravação já tem seu próprio fluxo de revisão).
- Não vou mexer em texto.
- Não vou alterar a lógica de arquivar/desarquivar conversas.
