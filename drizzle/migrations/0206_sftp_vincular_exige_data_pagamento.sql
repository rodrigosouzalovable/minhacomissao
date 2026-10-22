DO $m$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.sftp_ume_vincular_existentes(uuid)'::regprocedure) INTO src;
  src := replace(src, 'IF v_val IS NULL OR v_val <= 0 THEN CONTINUE; END IF;',
    'IF v_val IS NULL OR v_val <= 0 THEN CONTINUE; END IF;
    IF r.data_pagamento IS NULL OR r.data_pagamento > coalesce(r.data_lote, current_date) THEN CONTINUE; END IF;');
  EXECUTE src;
END $m$;