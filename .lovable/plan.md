# Confirmação obrigatória do telefone e emissão do termo

## Resultado esperado

Ao criar qualquer acordo, o usuário seguirá um fluxo obrigatório em três etapas:

1. **Revisar o acordo** — o sistema valida os dados já preenchidos.
2. **Confirmar o telefone real** — antes de gravar, abre uma janela mostrando o número do cliente, permitindo corrigi-lo e exigindo a confirmação explícita: “Confirmo que falei com este cliente neste telefone”.
3. **Emitir o termo** — depois que o acordo e as parcelas forem salvos, o PDF é gerado automaticamente e a janela só será concluída quando o usuário escolher uma destas ações:
   - **Enviar no WhatsApp Oficial** da conversa usada na negociação; ou
   - **Baixar o PDF** para enviar posteriormente.

Cancelar na confirmação do telefone volta ao formulário sem criar o acordo. Após o acordo ser criado, a etapa do termo não poderá ser simplesmente fechada; se a página for interrompida, ela reaparecerá até que o PDF seja enviado ou baixado.

## Confirmação do telefone

- Mostrar nome do cliente e telefone formatado em destaque.
- Permitir corrigir o número dentro da própria janela antes de continuar.
- Exigir número válido e a marcação da confirmação de contato real.
- Registrar no acordo o telefone confirmado, quem confirmou e quando confirmou.
- Aplicar a mesma validação de telefone aos lançamentos de operador e administrador.
- Se o telefone confirmado for alterado posteriormente, a formalização volta a ficar pendente e exige nova confirmação e nova emissão do termo.

## Emissão e entrega do termo

- Reutilizar o termo em PDF já existente para Novo Mundo e UME, sempre com as parcelas recém-criadas e o número definitivo do acordo.
- Adaptar o mesmo padrão de documento para os acordos criados dentro da ficha do devedor, usando nome, CPF, credor, telefone confirmado e parcelas daquele cadastro.
- Gerar o PDF apenas uma vez por tentativa e reaproveitar o mesmo arquivo tanto no download quanto no envio.
- Registrar a conclusão como **baixado** ou **enviado no WhatsApp**, com data, usuário e destino quando houver envio.
- Manter os botões atuais de baixar novamente o termo nos cards e na página de detalhes.

## WhatsApp Oficial

- Quando o acordo for iniciado a partir da Inbox Meta Oficial, preservar a conversa e a instância usadas na negociação e selecioná-las automaticamente.
- Acrescentar na conversa um acesso para iniciar o lançamento do acordo já com nome, telefone e contexto da conversa.
- Quando o acordo for iniciado por outra tela, localizar as conversas pelo telefone confirmado, usando o padrão de comparação pelos últimos 8 dígitos:
  - se houver uma única conversa acessível, selecioná-la;
  - se houver mais de uma, pedir ao usuário que escolha;
  - se não houver conversa acessível, manter disponível o download obrigatório.
- O envio direto só será liberado quando a conversa oficial estiver acessível ao usuário e dentro da janela permitida pelo WhatsApp. Se a janela estiver fechada, explicar o bloqueio e permitir concluir por download.
- Reutilizar o envio seguro de documentos já usado na Inbox, incluindo validação de acesso à conversa, armazenamento privado e registro da mensagem no histórico.

## Abrangência

Aplicar o fluxo aos três caminhos atuais de criação:

- **Novo Acordo** do operador;
- **Novo Acordo** lançado pelo administrador para um funcionário;
- **Novo Acordo** dentro da ficha do devedor.

A edição de acordos existentes não iniciará o processo por si só, exceto quando o telefone confirmado for modificado.

## Persistência e segurança

- Acrescentar aos registros dos dois tipos de acordo os campos de confirmação do telefone e de conclusão do termo.
- Acordos antigos permanecerão como históricos e não serão bloqueados retroativamente.
- Novos acordos serão salvos com formalização pendente e só mudarão para concluída depois de envio ou download confirmado.
- Preservar as permissões atuais: o administrador pode lançar para terceiros; o operador só formaliza acordos aos quais já tem acesso; o envio respeita o acesso à caixa e à conversa.
- Não criar agendamento, polling, canal em tempo real ou automação de mensagens.

## Validação

- Testar os três caminhos de criação, inclusive submissão pelo teclado.
- Confirmar que cancelar o primeiro passo não grava acordo nem parcelas.
- Confirmar que telefone inválido ou caixa de confirmação desmarcada bloqueiam o avanço.
- Confirmar que interrupção após salvar reabre a emissão obrigatória.
- Testar download e envio direto em conversa única, múltiplas conversas, conversa sem acesso e janela de 24 horas fechada.
- Verificar que o PDF baixado e o enviado são idênticos, com nome, CPF, credor, valores e parcelas corretos.
- Inspecionar visualmente PDFs de Novo Mundo, UME e ficha do devedor, com uma e várias páginas.
- Validar em desktop e celular, sem sobreposição, e conferir compilação e erros da tela.

## Detalhes técnicos

- Criar um diálogo compartilhado de formalização com estados explícitos: confirmação do telefone, geração do PDF e escolha de entrega.
- Generalizar o gerador atual para produzir um `Blob` reutilizável sem disparar download automático.
- Reutilizar `inbox-media` e `send-whatsapp-meta-media` para o envio; nenhuma nova função recorrente será criada.
- Persistir o vínculo da conversa Meta de origem quando o lançamento começar pela Inbox e usar busca por sufixo como alternativa.
- Implementar migração com campos de auditoria e status nos registros de acordo, mantendo as políticas de acesso existentes.

## Impacto de custo

**Alerta de custo Lovable Cloud:** haverá somente alguns campos pequenos e uma atualização adicional por novo acordo, além do upload do PDF quando enviado pelo WhatsApp. O impacto estimado é muito baixo e proporcional ao número de acordos; não haverá cron, polling ou execução contínua.
