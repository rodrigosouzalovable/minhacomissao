# Modelo de mensagem da Odres Cred

## Objetivo

Adicionar **Odres Cred** como terceiro modelo na aba **Modelo Mensagem**, funcionando igual ao modelo da **UME**, mas com a identificação e a marca da Odres Cred.

## O que será feito

1. **Nova aba “Layout Odres Cred”**
   - Exibir a nova opção ao lado de **Layout Novo Mundo** e **Layout UME**, tanto para administradores quanto para os demais usuários autorizados.
   - Manter o mesmo fluxo da UME: colar ou selecionar a imagem da tabela, extrair os valores, revisar os campos, gerar as opções de parcelamento e copiar a mensagem.

2. **Texto e identidade da Odres Cred**
   - Usar como modelo inicial a mesma mensagem da UME, trocando apenas “UME” por **“Odres Cred”**.
   - Exibir a logo oficial da Odres Cred já cadastrada no projeto.
   - Trocar os textos visíveis que mencionam UME pela identificação Odres Cred dentro dessa aba.

3. **Modelo editável independente**
   - Salvar o texto personalizado da Odres Cred separadamente por usuário.
   - Alterar o modelo da Odres Cred não modificará o modelo da UME, e vice-versa.
   - Preservar as mesmas variáveis disponíveis: nome do usuário, nome do cliente, primeiro nome, valor à vista e opções parceladas.

4. **Atalho dentro da conversa**
   - Incluir Odres Cred entre os credores disponíveis no botão **Modelo Mensagem** da conversa.
   - Quando a conversa estiver identificada como Odres Cred, abrir diretamente o novo layout e mostrar sua logo.
   - Preservar a abertura direta atual para Novo Mundo e UME.

## Detalhes técnicos

- Reaproveitar o cálculo da UME: opções de 2x, 4x, 6x, 8x, 12x e 18x, omitindo parcelas abaixo de R$ 100.
- Reaproveitar a leitura de imagem já usada pela UME; não criar processamento em segundo plano, agendamento ou consulta automática.
- Acrescentar um campo próprio para o modelo Odres Cred no cadastro de modelos, mantendo as permissões existentes.
- Registrar Odres Cred no conjunto de marcas reconhecidas pelo seletor de credor e usar o recurso oficial já armazenado.

## Validação

- Conferir as três abas no computador e no celular.
- Extrair a mesma tabela nos modelos UME e Odres Cred e confirmar valores e parcelamentos idênticos.
- Confirmar que a mensagem da Odres Cred menciona apenas “Odres Cred” e mostra sua logo.
- Editar os modelos UME e Odres Cred separadamente e confirmar que um não sobrescreve o outro.
- Abrir o modelo a partir de conversas dos três credores e confirmar que cada uma entra na aba correta.
