import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';
import DescontosCredorEditor from './DescontosCredorEditor';

const CREDORES_FIXOS = ['MMP MUNDO DA MODA', 'MUNDO DA MODA', 'UME | NOVO MUNDO', 'MONTREAL'];

export default function DescontosCredorCard() {
  const [credores, setCredores] = useState<string[]>(CREDORES_FIXOS);
  const [credor, setCredor] = useState('');
  const [outro, setOutro] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data } = await supabase.rpc('listar_credores_distintos');
      if (cancelado || !data) return;
      const unique = (data as { credor: string }[]).map((d) => d.credor).filter(Boolean);
      setCredores(Array.from(new Set([...CREDORES_FIXOS, ...unique])));
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const credorFinal = (credor === 'outro' ? outro.trim() : credor).trim();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Descontos do portal por credor
        </CardTitle>
        <CardDescription>
          Defina as faixas de atraso e os descontos (à vista e parcelado) de qualquer credor. As alterações passam a
          valer imediatamente na próxima consulta do cliente no portal de negociação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Credor</Label>
          <Select value={credor} onValueChange={setCredor}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Selecione o credor..." />
            </SelectTrigger>
            <SelectContent>
              {credores.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value="outro">Outro (digitar)</SelectItem>
            </SelectContent>
          </Select>
          {credor === 'outro' && (
            <Input
              placeholder="Digite o nome do credor"
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              className="max-w-xs"
            />
          )}
        </div>
        {credorFinal ? (
          <DescontosCredorEditor key={credorFinal} credor={credorFinal} titulo={credorFinal} />
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um credor para editar as faixas de desconto.</p>
        )}
      </CardContent>
    </Card>
  );
}
