import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ClienteLang = 'en' | 'es' | 'pt';

// Textos em português -> tradução para clientes USA B2B (somente telas que eles veem).
const DIC: Record<string, { en: string; es: string }> = {
  'Minha Conta': { en: 'My Account', es: 'Mi cuenta' },
  'Inbox Meta Oficial': { en: 'Conversations', es: 'Conversaciones' },
  'Inbox': { en: 'Conversations', es: 'Conversaciones' },
  'AI Assistant (USA)': { en: 'AI Assistant', es: 'Asistente IA' },
  'Sair': { en: 'Sign out', es: 'Salir' },
  'Inbox API Oficial Meta': { en: 'WhatsApp Inbox', es: 'Bandeja de WhatsApp' },
  'Mostrar filtros': { en: 'Show filters', es: 'Mostrar filtros' },
  'Minimizar filtros': { en: 'Hide filters', es: 'Ocultar filtros' },
  'Todos': { en: 'All', es: 'Todos' },
  'Buscar por nome ou telefone...': { en: 'Search by name or phone...', es: 'Buscar por nombre o teléfono...' },
  'Conversas': { en: 'Conversations', es: 'Conversaciones' },
  'Arquivados': { en: 'Archived', es: 'Archivados' },
  'Todas': { en: 'All', es: 'Todas' },
  'Não lidas': { en: 'Unread', es: 'No leídas' },
  'Meus Clientes': { en: 'My Customers', es: 'Mis clientes' },
  'Sem caixa de mensagens atribuída — fale com o administrador.': { en: 'No inbox assigned — contact the administrator.', es: 'Sin bandeja asignada — contacta al administrador.' },
  'Nenhuma conversa.': { en: 'No conversations yet.', es: 'Aún no hay conversaciones.' },
  'Nenhuma conversa encontrada.': { en: 'No conversations found.', es: 'No se encontraron conversaciones.' },
  'Nenhuma conversa arquivada.': { en: 'No archived conversations.', es: 'No hay conversaciones archivadas.' },
  'Oficial': { en: 'Official', es: 'Oficial' },
  'Selecione uma conversa': { en: 'Select a conversation', es: 'Selecciona una conversación' },
  'Digite uma mensagem...': { en: 'Type a message...', es: 'Escribe un mensaje...' },
  'Etiquetas': { en: 'Labels', es: 'Etiquetas' },
  'Criar Etiqueta': { en: 'Create label', es: 'Crear etiqueta' },
  'Configuração de etiquetas': { en: 'Label settings', es: 'Configurar etiquetas' },
  'Salvar': { en: 'Save', es: 'Guardar' },
  'Cancelar': { en: 'Cancel', es: 'Cancelar' },
  'Nova conversa': { en: 'New conversation', es: 'Nueva conversación' },
  'Filtrar por etiquetas': { en: 'Filter by labels', es: 'Filtrar por etiquetas' },
  'Escolher outra cor': { en: 'Choose another color', es: 'Elegir otro color' },
  'Escolher qualquer cor': { en: 'Choose any color', es: 'Elegir cualquier color' },
  'Editar cor': { en: 'Edit color', es: 'Editar color' },
  'Filtrar por qualificações': { en: 'Filter by qualifications', es: 'Filtrar por calificaciones' },
  'Filtrar conversas com janela 24h ativa (verde/amarela)': { en: 'Show conversations with an open 24h window (green/yellow)', es: 'Mostrar conversaciones con ventana de 24h abierta (verde/amarilla)' },
  'Clientes que receberam campanha e ainda não responderam': { en: 'Customers who received a campaign and have not replied', es: 'Clientes que recibieron campaña y aún no respondieron' },
  'Todas as conversas com a minha etiqueta de atendente': { en: 'All conversations with my agent label', es: 'Todas las conversaciones con mi etiqueta de agente' },
  'Limpar datas': { en: 'Clear dates', es: 'Borrar fechas' },
  'Atualizar caixas de mensagens': { en: 'Refresh inboxes', es: 'Actualizar bandejas' },
  'Caixa padrão (mensagens da equipe)': { en: 'Default inbox (team messages)', es: 'Bandeja principal (mensajes del equipo)' },
  'Configurar modelos e regras da IA': { en: 'Configure AI templates and rules', es: 'Configurar plantillas y reglas de IA' },
  'Caixas ocultas': { en: 'Hidden inboxes', es: 'Bandejas ocultas' },
  'Gerenciar caixas de mensagens': { en: 'Manage inboxes', es: 'Gestionar bandejas' },
  'Não precisa de resposta': { en: 'No reply needed', es: 'No necesita respuesta' },
  'Excluir': { en: 'Delete', es: 'Eliminar' },
  'Voltar para conversas': { en: 'Back to conversations', es: 'Volver a conversaciones' },
  'Credor desta conversa (clique para alterar)': { en: 'Creditor of this conversation (click to change)', es: 'Acreedor de esta conversación (clic para cambiar)' },
  'Qualificar esta conversa': { en: 'Qualify this conversation', es: 'Calificar esta conversación' },
  'Ligar para o cliente': { en: 'Call the customer', es: 'Llamar al cliente' },
  'Agendar retorno para este cliente': { en: 'Schedule a follow-up with this customer', es: 'Programar seguimiento con este cliente' },
  'Agendar retorno': { en: 'Schedule follow-up', es: 'Programar seguimiento' },
  'Duplo clique para responder': { en: 'Double-click to reply', es: 'Doble clic para responder' },
  'Respostas rápidas': { en: 'Quick replies', es: 'Respuestas rápidas' },
  'Gravar áudio': { en: 'Record audio', es: 'Grabar audio' },
  'Sugestões de resposta (copiloto de objeções)': { en: 'Reply suggestions', es: 'Sugerencias de respuesta' },
  'Sugestões de resposta': { en: 'Reply suggestions', es: 'Sugerencias de respuesta' },
  'Limpar': { en: 'Clear', es: 'Borrar' },
  'Limpar qualificações': { en: 'Clear qualifications', es: 'Borrar calificaciones' },
  'Nenhuma qualificação ativa.': { en: 'No qualifications yet.', es: 'Aún no hay calificaciones.' },
  'Gerenciar qualificações': { en: 'Manage qualifications', es: 'Gestionar calificaciones' },
  'Qualificação': { en: 'Qualification', es: 'Calificación' },
  'Erro ao qualificar': { en: 'Could not qualify', es: 'No se pudo calificar' },
  'Erro': { en: 'Error', es: 'Error' },
  'Não é possível excluir': { en: 'Cannot delete', es: 'No se puede eliminar' },
  'Novo motivo': { en: 'New reason', es: 'Nuevo motivo' },
  'Nova qualificação': { en: 'New qualification', es: 'Nueva calificación' },
  'Nenhum item cadastrado ainda.': { en: 'No items yet.', es: 'Aún no hay elementos.' },
  'Selecione o motivo para salvar.': { en: 'Select a reason to save.', es: 'Selecciona un motivo para guardar.' },
  'Salvar qualificação': { en: 'Save qualification', es: 'Guardar calificación' },
  'Sem motivos configurados': { en: 'No reasons set', es: 'Sin motivos configurados' },
  'Selecione o motivo (pode marcar mais de um) para concluir a qualificação.': { en: 'Select a reason (you can pick more than one) to finish.', es: 'Selecciona un motivo (puedes marcar varios) para terminar.' },
  'Crie, renomeie, ative/inative ou exclua os motivos desta qualificação.': { en: 'Create, rename, enable/disable or delete the reasons for this qualification.', es: 'Crea, renombra, activa/desactiva o elimina los motivos.' },
  'Clique no ícone de lista para configurar os motivos de cada qualificação.': { en: 'Click the list icon to set up the reasons for each qualification.', es: 'Haz clic en el icono de lista para configurar los motivos.' },
  'Selecione uma ou mais qualificações para esta conversa.': { en: 'Select one or more qualifications for this conversation.', es: 'Selecciona una o más calificaciones para esta conversación.' },
  'Você pode marcar várias qualificações. Clique em uma marcada para removê-la.': { en: 'You can select several. Click a selected one to remove it.', es: 'Puedes marcar varias. Haz clic en una marcada para quitarla.' },
  'Clique com o botão direito para configurar os motivos.': { en: 'Right-click to set up reasons.', es: 'Clic derecho para configurar los motivos.' },
};

/** Idioma da interface para clientes USA B2B; null para a equipe (fica em português). */
export function useClienteUsaLang() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['cliente-usa-lang', user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('cliente_usa_config').select('usa_b2b, idioma_interface').eq('user_id', user!.id).maybeSingle();
      return data?.usa_b2b ? ((data.idioma_interface as ClienteLang) || 'en') : null;
    },
  });
  const lang = data ?? null;
  const tr = (pt: string) => (lang && lang !== 'pt' ? DIC[pt]?.[lang] ?? pt : pt);
  return { lang, tr };
}
