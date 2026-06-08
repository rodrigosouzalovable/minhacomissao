import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { fraseDoDia } from '@/lib/frasesMotivacionais';
import { Quote } from 'lucide-react';
import { format } from 'date-fns';

export function FraseDoDiaBanner() {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const { data: custom } = useQuery({
    queryKey: ['frase-custom', hoje],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes_motivacao' as any)
        .select('frase_custom, frase_autor, frase_data')
        .eq('frase_data', hoje)
        .maybeSingle();
      return data as any;
    },
    staleTime: 10 * 60 * 1000,
  });

  const fixa = fraseDoDia();
  const texto = custom?.frase_custom?.trim() || fixa.texto;
  const autor = custom?.frase_custom?.trim() ? (custom?.frase_autor || 'Gestão') : fixa.autor;

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md">
      <div className="p-5 flex items-start gap-4">
        <Quote className="h-8 w-8 opacity-80 shrink-0 mt-1" />
        <div className="flex-1">
          <p className="text-base sm:text-lg font-semibold leading-snug">"{texto}"</p>
          <p className="text-xs opacity-80 mt-2">— {autor}</p>
        </div>
      </div>
    </Card>
  );
}
