# Revalidar instâncias Meta somente ao iniciar campanhas

## Objetivo

Evitar que uma instância continue fora do pool por um bloqueio `Business Account Locked` que a Meta já removeu, sem manter consultas periódicas quando não existem campanhas.

## Alterações

1. **Remover a consulta geral automática**
   - Desativar o agendamento atual que consulta todas as instâncias a cada 2 horas.
   - Manter o botão **Revalidar na Meta** para conferência manual.

2. **Revalidar no início do envio**
   - Ao confirmar uma campanha em **Envio Meta**, consultar na Meta somente as instâncias selecionadas.
   - Aguardar o resultado antes de criar e liberar a campanha.
   - Mostrar ao usuário que os números estão sendo revalidados.

3. **Liberar bloqueios antigos já resolvidos**
   - Se a Meta retornar `CONNECTED`, sem bloqueio de envio e sem banimento, limpar a marca `Business Account Locked` e devolver a instância ao pool.
   - Fazer essa liberação antes da validação final da campanha, evitando que a tela rejeite antecipadamente um número saudável.

4. **Preservar bloqueios reais**
   - Se a Meta ainda confirmar bloqueio, banimento, pendência de pagamento ou restrição de envio, manter a instância fora da campanha.
   - Continuar excluindo YELLOW/RED conforme as regras atuais; UNKNOWN não será confundido com `Business Account Locked`.
   - Se algumas instâncias forem liberadas e outras continuarem bloqueadas, iniciar com as saudáveis e informar quais foram retiradas.

5. **Evitar consumo desnecessário**
   - Não criar nova verificação recorrente.
   - A consulta ocorrerá uma vez por instância selecionada, somente quando o usuário iniciar uma campanha.
   - Durante uma campanha ativa, manter apenas as verificações já necessárias para segurança do envio.

## Validação

- Testar uma instância marcada com `Business Account Locked` que a Meta já liberou: a marca deve desaparecer e ela deve entrar na campanha.
- Testar uma instância ainda bloqueada: deve continuar fora e apresentar o motivo.
- Confirmar que nenhuma consulta geral continua rodando a cada 2 horas.
- Confirmar que campanhas com várias instâncias seguem usando somente as aprovadas após a revalidação.

## Custo

A alteração reduz o consumo atual: elimina 12 verificações gerais por dia e passa a consultar apenas as instâncias escolhidas quando uma campanha é iniciada.
