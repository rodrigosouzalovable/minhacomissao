UPDATE public.google_maps_buscas
SET custo_estimado_usd = ROUND((GREATEST(CEIL(COALESCE(total_resultados, 0)::numeric / 20), 1) * 0.032)::numeric, 4)
WHERE custo_estimado_usd IS NOT NULL;