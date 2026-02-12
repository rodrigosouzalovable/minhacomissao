import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, FileText, Phone, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Debito {
  id: string;
  nome: string;
  cpf: string;
  valor_original: number;
  valor_atualizado: number;
  descricao: string | null;
  contrato: string | null;
  data_vencimento: string | null;
}

const PHONE = '5562981089329';
const PHONE_DISPLAY = '(62) 98108-9329';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCpfDisplay(cpf: string) {
  if (cpf.length !== 11) return cpf;
  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export default function ConsultaResultado() {
  const { cpf } = useParams<{ cpf: string }>();
  const [debitos, setDebitos] = useState<Debito[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeCliente, setNomeCliente] = useState('');

  useEffect(() => {
    async function fetchDebitos() {
      if (!cpf) return;
      const { data, error } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
      if (!error && data && data.length > 0) {
        setDebitos(data as Debito[]);
        setNomeCliente((data as Debito[])[0].nome);
      }
      setLoading(false);
    }
    fetchDebitos();
  }, [cpf]);

  const whatsappMsg = (debito: Debito) => {
    const msg = `Olá, gostaria de negociar meu débito.\n\nContrato: ${debito.contrato || 'N/A'}\nDescrição: ${debito.descricao || 'N/A'}\nValor: ${formatCurrency(debito.valor_atualizado)}`;
    return `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004080 100%)' }}>
      {/* Header */}
      <header className="border-b px-4 py-3" style={{ borderColor: '#ffffff15' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: '#00a86b', color: '#fff' }}>GA</div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#fff' }}>GRUPO ALTUM</h1>
              <p className="text-xs" style={{ color: '#ffffffaa' }}>Portal de Negociação</p>
            </div>
          </div>
          <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
            <Phone className="h-4 w-4" />
            {PHONE_DISPLAY}
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-sm mb-6 hover:underline" style={{ color: '#00a86b' }}>
            <ArrowLeft className="h-4 w-4" />
            Voltar à consulta
          </Link>

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin h-8 w-8 border-2 rounded-full mx-auto mb-4" style={{ borderColor: '#00a86b', borderTopColor: 'transparent' }} />
              <p style={{ color: '#ffffffaa' }}>Consultando débitos...</p>
            </div>
          ) : debitos.length === 0 ? (
            <Card className="border-0 text-center" style={{ background: '#ffffff0d' }}>
              <CardContent className="p-12">
                <AlertCircle className="h-16 w-16 mx-auto mb-4" style={{ color: '#00a86b' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>Nenhum débito encontrado</h2>
                <p className="mb-6" style={{ color: '#ffffffaa' }}>
                  Não encontramos débitos em aberto para o CPF {cpf ? formatCpfDisplay(cpf) : ''}.
                </p>
                <p className="text-sm mb-6" style={{ color: '#ffffff77' }}>
                  Se acredita que há um erro, entre em contato conosco.
                </p>
                <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer">
                  <Button style={{ background: '#00a86b', color: '#fff' }}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold" style={{ color: '#fff' }}>
                  Olá, {nomeCliente}
                </h2>
                <p style={{ color: '#ffffffaa' }}>
                  Encontramos {debitos.length} débito{debitos.length > 1 ? 's' : ''} em aberto. Negocie agora!
                </p>
              </div>

              <div className="grid gap-4">
                {debitos.map((debito) => (
                  <Card key={debito.id} className="border-0 overflow-hidden" style={{ background: '#ffffff0d' }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg" style={{ color: '#fff' }}>
                            {debito.descricao || 'Débito'}
                          </CardTitle>
                          {debito.contrato && (
                            <p className="text-sm flex items-center gap-1 mt-1" style={{ color: '#ffffffaa' }}>
                              <FileText className="h-3 w-3" />
                              Contrato: {debito.contrato}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs mb-1" style={{ color: '#ffffff77' }}>Valor Original</p>
                          <p className="font-semibold" style={{ color: '#ffffffcc' }}>{formatCurrency(debito.valor_original)}</p>
                        </div>
                        <div>
                          <p className="text-xs mb-1" style={{ color: '#ffffff77' }}>Valor Atualizado</p>
                          <p className="text-xl font-bold" style={{ color: '#ff6b6b' }}>{formatCurrency(debito.valor_atualizado)}</p>
                        </div>
                        {debito.data_vencimento && (
                          <div>
                            <p className="text-xs mb-1" style={{ color: '#ffffff77' }}>Vencimento</p>
                            <p className="font-semibold" style={{ color: '#ffffffcc' }}>
                              {format(new Date(debito.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        )}
                      </div>
                      <a href={whatsappMsg(debito)} target="_blank" rel="noopener noreferrer" className="block">
                        <Button className="w-full" style={{ background: '#00a86b', color: '#fff' }}>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Negociar este débito
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t px-4 py-6" style={{ borderColor: '#ffffff15', background: '#00000033' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs" style={{ color: '#ffffff55' }}>
            © {new Date().getFullYear()} Grupo Altum — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
