# Importação Cobmais persistente e com conclusão explícita

## Situação confirmada

- A importação atual **não foi concluída no portal**.
- O arquivo foi totalmente preparado: **530.893 linhas** e **528.956 parcelas únicas** já chegaram à área temporária.
- O registro ainda está como **“enviando”**, sem horário de conclusão, e nenhuma parcela foi publicada pelo novo fluxo.
- Hoje a leitura do Excel e o envio dos lotes rodam na página; trocar de tela encerra esse trabalho. A tela também não restaura corretamente uma importação pronta ou concluída.

## O que será alterado

1. **Enviar primeiro o arquivo para uma área privada**
   - Após o arquivo terminar de subir, ele ficará temporariamente protegido no servidor.
   - A partir desse momento, será seguro trocar de aba ou fechar a página.

2. **Processar no servidor com retomada segura**
   - O servidor validará o Excel e gravará as parcelas em lotes controlados.
   - Cada lote terá avanço persistido, evitando começar tudo novamente após interrupção.
   - Não haverá agenda nem consulta contínua: o processamento começa somente após um envio real.
   - Uma importação por vez, com proteção contra execução duplicada.

3. **Separar claramente as etapas**
   - “Enviando arquivo”
   - “Validando no servidor”
   - “Pronta para atualizar o portal”
   - “Atualizando o portal”
   - “Concluída” ou “Erro”

4. **Mostrar resultado persistente ao voltar à página**
   - Nome do arquivo, percentual real, quantidade processada e horário da última atualização.
   - Ao chegar a 100%, exibir claramente: **“Validação concluída — portal ainda não atualizado”**.
   - Depois da confirmação e publicação, exibir: **“Portal atualizado com sucesso”**, com novas, atualizadas, pagas e ausentes baixadas.
   - Manter um pequeno histórico das últimas importações e seus resultados.

5. **Recuperar a importação atual**
   - Reconhecer as 528.956 parcelas já recebidas como validação completa.
   - Não publicar automaticamente nem alterar a carteira atual.
   - Liberar o botão de confirmação para atualizar o portal com segurança.

6. **Limpeza e falhas**
   - Apagar o Excel temporário e as linhas de preparação após publicação concluída.
   - Em erro, manter a carteira anterior intacta e mostrar a causa e a opção de retomar/reiniciar.

## Validação

- Testar com o arquivo real de 530 mil linhas.
- Trocar de página durante o processamento e confirmar que ele continua.
- Voltar à tela e verificar que percentual e estado são recuperados.
- Confirmar que somente a ação “Atualizar portal” troca a carteira.
- Conferir os totais publicados e a limpeza dos dados temporários.

## Impacto de uso

O processamento pesado ocorrerá apenas uma vez por arquivo enviado. Não será criado cron, polling frequente ou rotina permanente, reduzindo o custo ao período da importação diária.
