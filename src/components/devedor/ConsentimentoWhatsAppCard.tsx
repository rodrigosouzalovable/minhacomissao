import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  devedorId: string;
  cpf: string;
}

const ORIGEM_LABEL: Record<string, string> = {
  acordo_assinado: 'Acordo assinado',
  portal_publico: 'Portal público de negociação',
  manual: 'Registro manual do atendente',
};

export function ConsentimentoWhatsAppCard({ devedorId, cpf }: Props) {
  const { isAdmin, isGestor } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [optInEm, setOptInEm] = useState<string | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);

  const podeEditar = isAdmin || isGestor;

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('devedores')
      .select('whatsapp_opt_in, whatsapp_opt_in_em, whatsapp_opt_in_origem')
      .eq('id', devedorId)
      .maybeSingle();
    if (data) {
      setOptIn(!!data.whatsapp_opt_in);
      setOptInEm(data.whatsapp_opt_in_em);
      setOrigem(data.whatsapp_opt_in_origem);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [devedorId]);

  const registrarManual = async () => {
    setSaving(true);
    const agora = new Date().toISOString();
    // Atualiza todos os devedores com o mesmo CPF
    const cpfNorm = (cpf || '').replace(/\D/g, '');
    const { error } = await supabase
      .from('devedores')
      .update({
        whatsapp_opt_in: true,
        whatsapp_opt_in_em: agora,
        whatsapp_opt_in_origem: 'manual',
      })
      .filter('cpf', 'ilike', `%${cpfNorm.slice(-11)}%`);

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Consentimento WhatsApp registrado');
      carregar();
    }
    setSaving(false);
  };

  const revogar = async () => {
    if (!confirm('Revogar consentimento WhatsApp deste cliente?')) return;
    setSaving(true);
    const cpfNorm = (cpf || '').replace(/\D/g, '');
    const { error } = await supabase
      .from('devedores')
      .update({
        whatsapp_opt_in: false,
        whatsapp_opt_in_em: null,
        whatsapp_opt_in_origem: null,
      })
      .filter('cpf', 'ilike', `%${cpfNorm.slice(-11)}%`);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Consentimento revogado');
      carregar();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando consentimento…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={optIn ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            {optIn ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-sm">Consentimento WhatsApp</div>
              {optIn ? (
                <div className="text-xs text-muted-foreground mt-1">
                  <Badge variant="default" className="bg-green-600 mr-1">Opt-in confirmado</Badge>
                  {optInEm && (
                    <>em {format(new Date(optInEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                  )}
                  {origem && <> — origem: <strong>{ORIGEM_LABEL[origem] || origem}</strong></>}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  <Badge variant="secondary" className="mr-1">Sem consentimento</Badge>
                  Envios automatizados via WhatsApp não estão autorizados para este cliente.
                </div>
              )}
            </div>
          </div>
          {podeEditar && (
            <div className="flex gap-1">
              {!optIn ? (
                <Button size="sm" variant="outline" onClick={registrarManual} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Registrar opt-in'}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={revogar} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revogar'}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
