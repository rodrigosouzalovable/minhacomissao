# Liberar a Novo Mundo 3144 quando estiver conectada

## Resultado esperado
- Remover a exclusão fixa da **Novo Mundo 3144** no “Selecionar todas”.
- Permitir selecionar, iniciar e continuar campanhas com essa instância quando a Meta informar **CONNECTED**.
- Exibir limitações de nome ou qualidade como alerta para essa instância, sem transformá-las em bloqueio interno de envio.
- Manter a retirada manual do pool e recusas reais devolvidas pela Meta durante uma tentativa.

## Implementação
1. **Seleção na aba Envio Meta**
   - Remover a regra específica que exclui números terminados em `3144`.
   - Ajustar o texto do botão “Selecionar todas”.
   - Para a Novo Mundo 3144, considerar o estado `CONNECTED` como suficiente para seleção, desde que não esteja fora do pool manualmente e a BM tenha saldo.

2. **Verificação de saúde e pool**
   - Identificar a instância pelo seu ID, evitando liberar por coincidência qualquer outro telefone terminado em 3144.
   - Quando estiver `CONNECTED`, impedir que a pendência do nome de exibição volte a colocar somente essa instância em `restrita`.
   - Preservar avisos visuais sobre nome não aprovado e demais limitações informativas.

3. **Início e continuidade das campanhas**
   - Aplicar a mesma exceção específica nas validações que iniciam campanhas, no envio individual e na retomada automática do disparo.
   - Não bloquear internamente a Novo Mundo 3144 apenas por nome não aprovado ou estado de pool gerado por esse motivo, se continuar `CONNECTED`.
   - Continuar registrando falhas reais da Meta, inclusive erros de mídia ou recusas da própria plataforma, sem convertê-las em sucesso.

4. **Segurança operacional**
   - Não alterar as regras das outras instâncias.
   - Continuar bloqueando a Novo Mundo 3144 se estiver desconectada, banida, desativada ou retirada manualmente pelo administrador.
   - Não criar novo agendamento, consulta recorrente ou monitoramento; sem aumento previsto de custo da nuvem.

## Validação
- Confirmar que a Novo Mundo 3144 aparece no “Selecionar todas” quando `CONNECTED`.
- Confirmar que uma campanha pode iniciar e continuar com ela mesmo enquanto o nome estiver pendente.
- Confirmar que uma recusa real da Meta aparece no histórico com o motivo correto.
- Confirmar que as demais instâncias mantêm todas as proteções atuais.
