-- Consolidar duplicatas de whatsapp_contatos: mesmo sufixo 8d + mesma instancia
-- Estratégia: apagar os contatos sem mensagens; se múltiplos têm mensagens, manter o com maior count.
WITH dups AS (
  SELECT instancia_id, RIGHT(regexp_replace(telefone,'\D','','g'),8) AS sufixo
  FROM whatsapp_contatos
  GROUP BY 1,2
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT c.id, c.instancia_id, c.telefone,
    (SELECT COUNT(*) FROM whatsapp_mensagens m WHERE m.instancia_id=c.instancia_id AND m.telefone_remoto=c.telefone) AS msg_count,
    ROW_NUMBER() OVER (
      PARTITION BY c.instancia_id, RIGHT(regexp_replace(c.telefone,'\D','','g'),8)
      ORDER BY (SELECT COUNT(*) FROM whatsapp_mensagens m WHERE m.instancia_id=c.instancia_id AND m.telefone_remoto=c.telefone) DESC,
               c.criado_em ASC
    ) AS rn
  FROM whatsapp_contatos c
  JOIN dups d ON d.instancia_id=c.instancia_id 
    AND d.sufixo=RIGHT(regexp_replace(c.telefone,'\D','','g'),8)
)
DELETE FROM whatsapp_contatos
WHERE id IN (SELECT id FROM ranked WHERE rn > 1 AND msg_count = 0);