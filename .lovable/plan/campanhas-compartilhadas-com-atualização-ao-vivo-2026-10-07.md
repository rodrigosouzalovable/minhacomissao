# Campanhas compartilhadas com atualização ao vivo

## Diagnóstico confirmado

- O compartilhamento de **dib municipios 3000** com **Guilherme** está gravado, e a campanha está rodando.
- A página **Campanhas** consulta apenas campanhas iniciadas pelo próprio login. Por isso, ela pode mostrar zero campanhas mesmo com um compartilhamento válido.
- O botão flutuante já carrega campanhas compartilhadas, mas a atualização ao vivo acompanha somente campanhas do proprietário.
- O cartão de resultados carrega a apuração salva ao abrir e só recalcula pelo botão **Atualizar**. Portanto, apenas liberar o andamento ao vivo não atualiza automaticamente respostas e taxas.
- As regras de leitura já permitem acesso à campanha compartilhada; as regras de alteração continuam restritas ao proprietário.

## Alterações

1. **Exibir a campanha para Guilherme** na página Campanhas e no botão inferior, incluindo campanhas próprias e compartilhadas sem duplicação, com os filtros e a paginação preservados.
2. **Usar o mesmo diálogo e os mesmos dados para ambos:** progresso, enviados, pendentes, erros, custos, últimas ocorrências, entregas, instâncias e resultados. Guilherme permanece identificado como **Somente visualização**.
3. **Atualizar o andamento automaticamente** enquanto a campanha estiver sendo acompanhada. Aplicar as alterações recebidas aos contadores e agrupar a atualização das listas para evitar uma consulta por mensagem.
4. **Sincronizar os resultados entre os observadores:** quando houver nova apuração, mostrar os mesmos números e horário para todos. Atualizar respostas e taxas automaticamente em cadência limitada e compartilhada, sem recalcular por envio ou por observador; manter indicação do horário da apuração.
5. **Preservar as restrições:** Guilherme não poderá pausar, retomar, cancelar, excluir, alterar ritmo, reativar números ou compartilhar novamente. Não liberar outras campanhas, Inbox, credenciais ou administração.
6. **Tratar reconexão e revogação:** atualizar ao voltar para a aba ou recuperar conexão; ao retirar o compartilhamento, remover a campanha e fechar seus detalhes após confirmação da perda de acesso.

## Economia e detalhes técnicos

- O custo adicional da atualização ao vivo foi autorizado. O impacto cresce com o número de observadores e eventos; não há valor fixo em reais confirmado.
- Reutilizar a publicação existente de campanhas/itens e centralizar a assinatura da campanha acompanhada para evitar conexões duplicadas entre página e diálogo.
- Assinar somente identificadores autorizados, com validação de leitura no servidor; nunca abrir acesso geral aos logs ou às instâncias do proprietário.
- Suspender acompanhamento contínuo em segundo plano, encerrar assinaturas ao sair e agrupar consultas paginadas. Não criar novo cron nem alterar o motor de disparos.
- Conferir o caminho dos eventos de resposta/entrega e implementar invalidação restrita à campanha. Se necessário para resultados salvos ou revogação, ajustar a publicação de eventos com as regras de acesso preservadas.
- Separar atualização de leitura da apuração pesada, usando cache e exclusão de cálculos simultâneos. O andamento será ao vivo; resultados terão atualização automática limitada, não promessa de latência zero.

## Validação

- Abrir a campanha como proprietário e como Guilherme e comparar contadores, custos, instâncias e resultados durante o andamento real, sem iniciar novos envios de teste.
- Confirmar atualização sem clicar em Atualizar, suspensão em segundo plano e recuperação ao retornar.
- Testar que um terceiro não autorizado não lê a campanha e que Guilherme não consegue executar comandos por chamada direta.
- Testar revogação com dados de teste, sem remover o compartilhamento real solicitado.
- Adicionar testes para inclusão de campanhas compartilhadas, autorização somente de leitura e ciclo de atualização. Relatar separadamente qualquer verificação autenticada que não puder ser executada.