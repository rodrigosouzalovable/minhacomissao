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
