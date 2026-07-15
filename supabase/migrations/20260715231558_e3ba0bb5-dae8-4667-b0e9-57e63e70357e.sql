
CREATE TABLE public.meta_instance_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_brl NUMERIC(12,4),
  numero_referencia TEXT NOT NULL,
  data_transacao DATE NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (numero_referencia)
);

CREATE INDEX idx_meta_instance_pagamentos_instance ON public.meta_instance_pagamentos(instance_id);
CREATE INDEX idx_meta_instance_pagamentos_user ON public.meta_instance_pagamentos(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_instance_pagamentos TO authenticated;
GRANT ALL ON public.meta_instance_pagamentos TO service_role;

ALTER TABLE public.meta_instance_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access meta_instance_pagamentos"
  ON public.meta_instance_pagamentos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users manage own meta_instance_pagamentos"
  ON public.meta_instance_pagamentos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
