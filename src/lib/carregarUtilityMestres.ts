import { supabase } from '@/integrations/supabase/client';
import type { UtilityMaster } from './metaUtilityCatalog';

export async function carregarUtilityMestres(userId: string): Promise<UtilityMaster[]> {
  const rows: UtilityMaster[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('meta_templates_mestre').select('*')
      .eq('criado_por', userId).eq('categoria', 'UTILITY').eq('reclassificado_marketing', false)
      .order('nome').order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}