DO $$
DECLARE v text;
BEGIN
  SELECT pg_get_functiondef('public.reserve_tier_250_template_slot'::regproc) INTO v;
  v := replace(v, 'generate_series(1, 2)', 'generate_series(1, 40)');
  v := replace(v, ') >= 2 THEN RETURN', ') >= 40 THEN RETURN');
  EXECUTE v;
END $$;