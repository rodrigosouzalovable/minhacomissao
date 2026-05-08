CREATE POLICY "Authenticated users can view all instances"
ON public.user_whatsapp_instances
FOR SELECT
TO authenticated
USING (true);