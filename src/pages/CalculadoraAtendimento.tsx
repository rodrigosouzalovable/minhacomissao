import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ConsultaUmeDialog } from '@/components/inbox/meta/ConsultaUmeDialog';
import { useUserRole } from '@/hooks/useUserRole';

export default function CalculadoraAtendimento() {
  const [aberta, setAberta] = useState(true);
  const { isAdmin } = useUserRole();
  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Calculadora UME</h1>
        <p className="text-muted-foreground">
          Consulte o CPF do cliente, calcule as propostas e copie o texto para enviar onde precisar.
          Boleto, PIX e efetivação usam o seu próprio login UME.
        </p>
        <Button onClick={() => setAberta(true)}>
          <Calculator className="mr-2 h-4 w-4" /> Abrir calculadora
        </Button>
      </div>
      <ConsultaUmeDialog open={aberta} onOpenChange={setAberta} folderId={null} podeDefinirTeto={isAdmin} />
    </AppLayout>
  );
}
