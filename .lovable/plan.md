O erro atual não é mais o anterior de quantidade/formato; agora o log mostra: `(#100) Invalid parameter`.

Isso indica que a função passou a tentar um payload que a Meta considera inválido, provavelmente por enviar parâmetros nomeados/posicionais de forma incompatível com o template real salvo na Meta ou por tentar um fallback com `parameter_name` incorreto.

Plano de correção:

1. **Melhorar o diagnóstico no backend**
   - Registrar no log interno o código, mensagem e detalhes retornados pela Meta.
   - Salvar no histórico de envio uma mensagem de erro mais completa, não só `Invalid parameter`.
   - Assim a tela passa a mostrar o motivo real quando a Meta recusar.

2. **Corrigir a montagem dos parâmetros do template**
   - Para template com `{{name}}`, enviar parâmetro nomeado somente como `{ type: 'text', parameter_name: 'name', text: 'Rodrigo' }`.
   - Para template com `{{1}}`, enviar parâmetro posicional somente como `{ type: 'text', text: 'Rodrigo' }`.
   - Remover tentativa inválida que transforma placeholder nomeado em posicional usando `resolveNamedVar('1')`, pois isso pode mandar texto errado ou payload inválido.

3. **Sincronizar corretamente templates duplicados**
   - Existem templates duplicados com o mesmo nome `atualizacao` e formatos diferentes no banco.
   - Ajustar a seleção/listagem para diferenciar melhor ou priorizar o registro correto por instância/idioma/sincronização.
   - Evitar disparar usando um registro antigo/desalinhado com o template real da Meta.

4. **Melhorar a resposta visual na tela de Envio Meta**
   - Após o disparo, se houver erro, buscar o último erro salvo e exibir a mensagem completa.
   - Isso evita ficar apenas “1 erros” sem explicar o motivo.

5. **Depois da alteração**
   - Reimplantar a função `send-whatsapp-meta`.
   - Fazer um teste controlado com 1 contato.

Você **não precisa alterar nada na Meta agora**. Primeiro precisamos corrigir o payload e expor o erro detalhado; se depois disso a Meta ainda acusar incompatibilidade, aí sim será possível saber exatamente se o template foi criado como variável nomeada ou posicional.