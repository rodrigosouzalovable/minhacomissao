
INSERT INTO whatsapp_aquecimento_config (chave, valor) VALUES
  ('aquecimento_pausado', 'true'::jsonb),
  ('engajamento_status_auto', 'false'::jsonb),
  ('grupo_conversa_habilitado', 'false'::jsonb),
  ('perfil_completacao_ativo', 'false'::jsonb),
  ('descoberta_grupos_auto', 'false'::jsonb),
  ('promocao_fase_auto', 'false'::jsonb),
  ('ia_pingpong_habilitado', 'false'::jsonb),
  ('postar_status_auto', 'true'::jsonb),
  ('status_habilitado', 'true'::jsonb)
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
