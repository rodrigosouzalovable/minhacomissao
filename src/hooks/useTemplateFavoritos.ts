import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TemplateFavoritoRef = {
  tipo: string;
  nome: string;
  idioma?: string | null;
};

const normalizar = (valor?: string | null) => String(valor || "").trim().toLocaleLowerCase("pt-BR");

export const templateFavoritoKey = (item: TemplateFavoritoRef) =>
  `${normalizar(item.tipo)}::${normalizar(item.nome)}::${normalizar(item.idioma)}`;

export function useTemplateFavoritos(tipo: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["template-favoritos", user?.id, tipo];

  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_favoritos")
        .select("template_tipo,template_nome,template_idioma")
        .eq("template_tipo", tipo);
      if (error) throw error;
      return new Set((data ?? []).map((item) => templateFavoritoKey({
        tipo: item.template_tipo,
        nome: item.template_nome,
        idioma: item.template_idioma,
      })));
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ item, favorito }: { item: TemplateFavoritoRef; favorito: boolean }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const idioma = normalizar(item.idioma);
      const nome = normalizar(item.nome);
      if (favorito) {
        const { error } = await supabase.from("template_favoritos").upsert({
          user_id: user.id,
          template_tipo: tipo,
          template_nome: nome,
          template_idioma: idioma,
        }, { onConflict: "user_id,template_tipo,template_nome,template_idioma" });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("template_favoritos")
        .delete()
        .eq("user_id", user.id)
        .eq("template_tipo", tipo)
        .eq("template_nome", nome)
        .eq("template_idioma", idioma);
      if (error) throw error;
    },
    onMutate: async ({ item, favorito }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey) ?? new Set<string>();
      const next = new Set(previous);
      const key = templateFavoritoKey({ ...item, tipo });
      if (favorito) next.add(key); else next.delete(key);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    favoritos: query.data ?? new Set<string>(),
    carregandoFavoritos: query.isLoading,
    isFavorito: (item: Omit<TemplateFavoritoRef, "tipo">) =>
      (query.data ?? new Set<string>()).has(templateFavoritoKey({ ...item, tipo })),
    alternarFavorito: (item: Omit<TemplateFavoritoRef, "tipo">) => {
      const favorito = !(query.data ?? new Set<string>()).has(templateFavoritoKey({ ...item, tipo }));
      mutation.mutate({ item: { ...item, tipo }, favorito });
    },
  };
}