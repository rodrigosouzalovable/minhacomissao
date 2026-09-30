# Corrigir progresso da importação diária Cobmais

## Diagnóstico confirmado
- O arquivo terminou a leitura e a validação: 530.893 linhas e 528.956 parcelas únicas.
- A importação está na etapa de prévia, sem alterar a carteira do portal.
- O painel mantém 90% e a estimativa antiga porque usa o mesmo indicador para duas etapas diferentes: preparar o arquivo e publicar a carteira.

## Alterações
1. Separar visualmente o preparo do arquivo da publicação final.
2. Ao terminar o envio temporário, mostrar **“Validação concluída — 100%”**, remover a estimativa restante e exibir a quantidade total recebida.
3. Destacar o botão **“Atualizar portal com esta planilha”** e informar claramente que a carteira ainda não foi alterada.
4. Ao clicar no botão, iniciar um novo progresso para a publicação, com mensagem própria e sem prometer uma estimativa imprecisa.
5. Registrar o avanço dos lotes no histórico da importação para permitir recuperação e diagnóstico se a aba for recarregada.
6. Tratar importações abandonadas: ao selecionar novamente o mesmo arquivo, limpar somente a área temporária daquela tentativa incompleta, sem tocar na carteira atual.

## Validação
- Confirmar que a prévia chega a 100% e não permanece com cronômetro antigo.
- Confirmar que nenhuma alteração ocorre antes do clique de publicação.
- Testar interrupção, nova tentativa e conclusão com arquivo grande.
