# Ajustar o aviso de parcelas atrasadas

## Objetivo
Fazer o pop-up aparecer somente duas vezes por dia, às **9h** e às **15h** (horário de Brasília), e permitir abrir diretamente o acordo de cada cliente listado.

## Implementação
1. **Controlar os dois avisos diários**
   - Remover a abertura vinculada a cada atualização de dados, que hoje faz o pop-up reaparecer repetidamente.
   - Criar as janelas de 9h e 15h no horário de Brasília.
   - Registrar por usuário, data e horário quando o aviso foi exibido, impedindo repetição ao atualizar a página, trocar de tela ou fechar o pop-up.
   - Se o usuário entrar depois de um horário, mostrar uma vez o aviso mais recente ainda não visto: entre 9h e 14h59, o das 9h; após 15h, o das 15h.
   - Se não houver parcelas atrasadas, não abrir o aviso.

2. **Atualizar os dados antes de avisar**
   - Ao chegar o horário ou ao usuário entrar depois dele, atualizar a lista para evitar mostrar parcelas já pagas ou acordos encerrados.
   - Manter a lista da tela Retornos atualizada, mas sem usar suas atualizações para reabrir o pop-up.

3. **Abrir o cliente pelo próprio card**
   - Transformar cada item do pop-up em uma opção clicável e acessível.
   - Ao clicar no cliente, fechar o aviso e abrir diretamente os detalhes do acordo correspondente.
   - Manter o botão geral **Ver parcelas atrasadas** para acessar a seção completa em Retornos.
   - Atualizar o texto do aviso para informar os horários de 9h e 15h, removendo a menção aos 10 minutos.

## Validação
- Confirmar que fechar, navegar ou atualizar a página não repete o aviso dentro do mesmo horário.
- Confirmar um aviso às 9h e outro às 15h, inclusive quando o usuário entra depois do horário.
- Confirmar que cada cliente abre o acordo correto.
- Confirmar que parcelas pagas e acordos encerrados não aparecem.
- Verificar o pop-up em computador e celular, sem sobreposição de conteúdo.
