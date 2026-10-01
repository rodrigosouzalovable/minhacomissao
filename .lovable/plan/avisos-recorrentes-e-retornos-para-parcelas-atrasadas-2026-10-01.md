# Avisos recorrentes e Retornos para parcelas atrasadas

## Objetivo
Avisar o responsável pelo acordo quando uma parcela continuar pendente a partir do dia seguinte ao vencimento e facilitar o contato pela API Oficial Meta na tela **Retornos**.

## Implementação

1. **Identificar parcelas que realmente exigem cobrança**
   - Usar as parcelas com status pendente e vencimento anterior ao dia atual.
   - Excluir imediatamente parcelas pagas e acordos já quebrados, concluídos ou cancelados.
   - Respeitar o acesso atual: cada usuário recebe avisos dos acordos sob sua responsabilidade; administradores mantêm a visão ampliada já disponível na tela Retornos.
   - Considerar cada parcela separadamente, mostrando número, vencimento, valor, cliente, telefone e responsável.

2. **Exibir um único pop-up recorrente**
   - Reaproveitar o aviso global que hoje mostra retornos agendados.
   - Consultar as parcelas atrasadas ao entrar no sistema, ao voltar para uma aba visível e a cada 10 minutos enquanto a tela estiver aberta e visível.
   - Reunir todos os clientes atrasados em um único pop-up, sem abrir vários avisos simultâneos.
   - Permitir fechar o aviso atual, mas apresentá-lo novamente no próximo ciclo enquanto ainda houver atraso.
   - Remover automaticamente do próximo aviso qualquer parcela marcada como paga ou pertencente a acordo quebrado.
   - Manter o aviso sonoro/visual existente e não interferir na fila dos retornos agendados.

3. **Criar a área “Parcelas atrasadas” em Retornos**
   - Adicionar uma seção exclusiva antes da lista normal de retornos.
   - Exibir um card por parcela atrasada, com identificação do cliente, parcela, vencimento, dias em atraso, valor, telefone e responsável.
   - Atualizar a seção sem criar cópias na tabela de retornos: a lista será derivada diretamente das parcelas atuais, evitando registros órfãos ou duplicados.
   - Fazer o card desaparecer quando a parcela for paga ou o acordo for quebrado.

4. **Adicionar contato pelo WhatsApp oficial**
   - Incluir em cada card atrasado o botão **WhatsApp**.
   - Abrir o mesmo diálogo **Nova conversa Meta** já usado pelos retornos, com nome e telefone preenchidos.
   - Manter seleção de template, variáveis obrigatórias, favoritos, pré-visualização e escolha da instância compatível.
   - Desabilitar o botão sem telefone e informar quando não houver instância Meta disponível.

## Detalhes técnicos
- Reutilizar a consulta de parcelas vencidas já existente em `usePaymentReminders`, ajustando-a para ignorar acordos encerrados e compartilhá-la com o aviso e a tela Retornos.
- Estender o aviso global para uma visualização consolidada das parcelas, mantendo separado o fluxo de conclusão dos retornos agendados.
- Reutilizar `MetaNovaConversaDialog` e `get_meta_whatsapp_active_instances_for_sending`.
- Não criar cron, função em loop, tabela ou canal em tempo real. O ciclo de 10 minutos fica limitado à sessão visível, reduzindo custo recorrente na Lovable Cloud.

## Validação
- Confirmar que a parcela aparece somente a partir do dia seguinte ao vencimento.
- Confirmar um único pop-up com todos os atrasados, reaparecendo após 10 minutos se o atraso continuar.
- Confirmar pausa das consultas com a aba oculta e atualização ao voltar.
- Marcar uma parcela como paga e confirmar sua remoção do pop-up e da seção Retornos.
- Confirmar remoção quando o acordo estiver quebrado, concluído ou cancelado.
- Abrir o WhatsApp de um card e validar preenchimento, seleção de template e envio, sem realizar envio real no teste.
- Verificar as permissões e a apresentação em computador e celular.
