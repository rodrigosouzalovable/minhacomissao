-- Function to generate CREATE TABLE DDL + RLS policies for a given public table.
-- Restricted to admins. Returns plain SQL text safe to copy/paste into another Postgres.

CREATE OR REPLACE FUNCTION public.get_table_ddl(p_table text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ddl text := '';
  v_cols text := '';
  v_pk text := '';
  v_rls text := '';
  v_rec record;
  v_exists boolean;
BEGIN
  -- Only admins
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN '-- table public.' || quote_ident(p_table) || ' not found';
  END IF;

  -- Columns
  FOR v_rec IN
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table
    ORDER BY ordinal_position
  LOOP
    v_cols := v_cols
      || E'\n  '
      || quote_ident(v_rec.column_name) || ' '
      || CASE
           WHEN v_rec.data_type = 'ARRAY' THEN
             -- udt_name comes prefixed with _ for arrays
             regexp_replace(v_rec.udt_name, '^_', '') || '[]'
           WHEN v_rec.data_type = 'USER-DEFINED' THEN v_rec.udt_name
           WHEN v_rec.data_type = 'character varying' AND v_rec.character_maximum_length IS NOT NULL
             THEN 'varchar(' || v_rec.character_maximum_length || ')'
           ELSE v_rec.data_type
         END
      || CASE WHEN v_rec.column_default IS NOT NULL
              THEN ' DEFAULT ' || v_rec.column_default ELSE '' END
      || CASE WHEN v_rec.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
      || ',';
  END LOOP;

  -- Primary key
  SELECT '  CONSTRAINT ' || quote_ident(tc.constraint_name)
         || ' PRIMARY KEY (' || string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position) || ')'
    INTO v_pk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = p_table
    AND tc.constraint_type = 'PRIMARY KEY'
  GROUP BY tc.constraint_name;

  v_ddl := '-- ============================================' || E'\n'
        || '-- Table: public.' || quote_ident(p_table) || E'\n'
        || '-- ============================================' || E'\n'
        || 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(p_table) || ' ('
        || v_cols;

  IF v_pk IS NOT NULL THEN
    v_ddl := v_ddl || E'\n' || v_pk || E'\n);';
  ELSE
    -- remove trailing comma
    v_ddl := rtrim(v_ddl, ',') || E'\n);';
  END IF;

  -- Enable RLS
  v_ddl := v_ddl || E'\n\nALTER TABLE public.' || quote_ident(p_table) || ' ENABLE ROW LEVEL SECURITY;';

  -- Policies
  FOR v_rec IN
    SELECT polname, polcmd, polpermissive, polroles, polqual, polwithcheck
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_table
    ORDER BY polname
  LOOP
    DECLARE
      v_cmd text;
      v_using text;
      v_check text;
    BEGIN
      v_cmd := CASE v_rec.polcmd
                 WHEN 'r' THEN 'SELECT'
                 WHEN 'a' THEN 'INSERT'
                 WHEN 'w' THEN 'UPDATE'
                 WHEN 'd' THEN 'DELETE'
                 WHEN '*' THEN 'ALL'
                 ELSE 'ALL'
               END;
      v_using := CASE WHEN v_rec.polqual IS NOT NULL
                      THEN ' USING (' || pg_get_expr(v_rec.polqual, (SELECT oid FROM pg_class WHERE relname = p_table AND relnamespace = 'public'::regnamespace)) || ')'
                      ELSE '' END;
      v_check := CASE WHEN v_rec.polwithcheck IS NOT NULL
                      THEN ' WITH CHECK (' || pg_get_expr(v_rec.polwithcheck, (SELECT oid FROM pg_class WHERE relname = p_table AND relnamespace = 'public'::regnamespace)) || ')'
                      ELSE '' END;
      v_rls := v_rls || E'\n\nCREATE POLICY ' || quote_ident(v_rec.polname)
            || ' ON public.' || quote_ident(p_table)
            || CASE WHEN v_rec.polpermissive THEN ' AS PERMISSIVE' ELSE ' AS RESTRICTIVE' END
            || ' FOR ' || v_cmd
            || v_using || v_check || ';';
    END;
  END LOOP;

  v_ddl := v_ddl || v_rls || E'\n';
  RETURN v_ddl;
END;
$$;

REVOKE ALL ON FUNCTION public.get_table_ddl(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_table_ddl(text) TO authenticated;