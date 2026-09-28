# Administrador completo da caixa AMARAL NM

## Resultado esperado

Bruno continuará sendo administrador somente da caixa **AMARAL NM** e poderá:

- adicionar ou retirar usuários dessa caixa;
- definir ou remover outros administradores da caixa;
- criar etiquetas para a AMARAL NM;
- editar nome, cor e visibilidade das etiquetas dentro da AMARAL NM;
- ocultar/remover uma etiqueta da AMARAL NM sem alterar as demais caixas.

## Ajustes

1. **Permissão por caixa**
   - Usar a marcação `Admin` já existente na AMARAL NM como fonte de autorização.
   - Manter administradores gerais e o dono da caixa com o mesmo acesso.
   - Não conceder ao Bruno poderes sobre outras caixas ou áreas administrativas do sistema.

2. **Etiquetas isoladas na AMARAL NM**
   - Adicionar uma configuração de etiqueta por caixa, protegida pelas regras de acesso da própria caixa.
   - Quando uma etiqueta compartilhada for alterada por Bruno, salvar nome/cor/visibilidade apenas para a AMARAL NM; a aparência nas outras caixas permanece igual.
   - Etiquetas criadas dentro da AMARAL NM ficam disponíveis somente nela.
   - Etiquetas automáticas de atendentes continuam funcionando; a personalização visual não altera o rodízio.

3. **Tela da Inbox**
   - Reconhecer o administrador da caixa ativa também na configuração de etiquetas, não apenas o administrador geral.
   - Mostrar no gerenciador somente as etiquetas aplicáveis à AMARAL NM e habilitar todas as ações permitidas nessa caixa.
   - Manter as ações globais disponíveis somente para administrador geral.

4. **Validação**
   - Entrar como Bruno e confirmar que ele consegue alterar uma cor e administrar os usuários da AMARAL NM.
   - Confirmar que a mesma etiqueta não muda em outra caixa.
   - Confirmar que Bruno não consegue administrar etiquetas nem usuários de outra caixa.

## Detalhes técnicos

- Criar vínculo/configuração entre caixa e etiqueta com índices, permissões para usuários autenticados e regras baseadas em `meta_inbox_folder_can_manage`.
- Resolver os valores personalizados ao carregar e exibir etiquetas da caixa ativa, sem nova atualização periódica.
- Preservar os identificadores originais das etiquetas para não afetar vínculos existentes, automações e distribuição de atendentes.
