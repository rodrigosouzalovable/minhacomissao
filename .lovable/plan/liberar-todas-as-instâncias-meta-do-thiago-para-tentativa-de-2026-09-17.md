# Liberar todas as instâncias Meta do Thiago para tentativa de envio

## Diagnóstico confirmado

- Thiago Nogueira está corretamente marcado como **Parceiro Meta** e possui oito instâncias vinculadas.
- A tela ainda desabilita a seleção quando a instância não está com o pool `ativo`, mesmo sendo uma instância própria do parceiro.
- Além da tela, o início e a execução da campanha ainda descartam instâncias por qualidade YELLOW/RED, quarentena, recuperação, retenção manual, nome reprovado, estado do pool, freios internos e algumas restrições salvas.
- Exemplo atual: **AMARAL 61 8263-7820** está `CONNECTED` e com nome `APPROVED`, mas YELLOW, em quarentena e marcada como restrita por reputação; por isso o checkbox aparece bloqueado.
- A função de envio também possui validações internas antes de chamar a Meta. Portanto, liberar apenas o checkbox não resolveria o fluxo completo.

## Resultado desejado

Thiago poderá selecionar e tentar enviar por **todas as instâncias vinculadas ao login dele**, independentemente de:

- qualidade GREEN, YELLOW, RED ou sem leitura;
- quarentena ou recuperação;
- estado interno do pool;
- retenção manual do pool;
- nome pendente ou reprovado;
- freio interno, guardião, pausa ou restrição registrada no sistema.

A exceção valerá somente para o usuário Thiago e somente para as instâncias explicitamente vinculadas a ele. Outros usuários, parceiros e números permanecem com as regras atuais.

## Implementação

1. **Exceção segura por usuário e vínculo**
   - Criar uma verificação central no backend que confirme simultaneamente o usuário Thiago, a permissão Parceiro Meta e o vínculo da instância com ele.
   - Não confiar em sinalização enviada pela tela; o backend decide a exceção usando o usuário autenticado e os vínculos salvos.

2. **Liberar seleção na tela Envio Meta**
   - Habilitar os checkboxes de todas as instâncias próprias do Thiago.
   - Fazer “Selecionar todas” incluir todas as instâncias dele, mesmo com selo vermelho, YELLOW/RED ou fora do pool.
   - Manter os selos e motivos visíveis como informação, sem bloquear o clique.
   - Exibir um aviso claro de que a tentativa está liberada, mas a Meta ainda pode recusar a entrega.

3. **Liberar início da campanha**
   - Não remover instâncias próprias do Thiago por qualidade, quarentena, recuperação, nome, pool, pausa, retenção manual ou leitura de saúde.
   - Registrar no job que a campanha foi iniciada com a exceção autorizada, para que a execução preserve a mesma regra.

4. **Liberar execução e rodízio**
   - Fazer o seletor de instância e o envio final ignorarem todas as travas internas listadas quando o job pertencer ao Thiago e a instância estiver vinculada a ele.
   - Não retirar automaticamente YELLOW/RED do rodízio durante a campanha dele.
   - Não reter a instância por falhas internas ou estado salvo; continuar o rodízio enquanto houver instâncias vinculadas disponíveis para tentativa.

5. **Preservar a resposta real da Meta**
   - A aplicação fará a tentativa, mas não falsificará sucesso quando a Meta recusar por conta bloqueada, cobrança, nome, banimento, limite ou qualquer outro motivo externo.
   - Guardar e mostrar o código/motivo real da Meta por instância e contato.
   - Rate limit continuará aguardando e retomando, sem encerrar a campanha.

6. **Validar com o login do Thiago**
   - Confirmar que todos os checkboxes ficam clicáveis e que “Selecionar todas” inclui as oito instâncias vinculadas.
   - Iniciar uma campanha de teste e confirmar que nenhuma trava interna elimina YELLOW/RED ou instâncias com selo vermelho.
   - Confirmar que uma aceitação da Meta é registrada como enviada e uma recusa da Meta aparece com o motivo real, sem ser mascarada como bloqueio do sistema.

## Observações

- Esta liberação aumenta o risco de piora de reputação e bloqueio definitivo dos números YELLOW/RED ou já restritos. Ela também pode gerar cobrança por conversas aceitas pela Meta.
- Não serão criados novos agendamentos, buscas repetidas ou canais em tempo real; não há aumento estrutural de custo no Lovable Cloud.
