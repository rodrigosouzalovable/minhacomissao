import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, MessageCircle, FileText, Phone, AlertCircle, CalendarIcon, ChevronDown, ChevronUp, Check } from 'lucide-react';
import logoGrupoAltum from '@/assets/logo-grupo-altum-negociacao.png';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

interface NegociacaoState {
  negociando: boolean;
  confirmado: boolean;
  entrada: number;
  parcelas: number;
  dataPrimeiroPagamento: Date | undefined;
}

const PHONE = '5562981089329';
const PHONE_DISPLAY = '(62) 98108-9329';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCpfFull(cpf: string) {
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function formatDateBR(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return null;
  }
}

export default function ConsultaResultado() {
  const { cpf } = useParams<{ cpf: string }>();
  const [debitos, setDebitos] = useState<Debito[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [nascimentoCliente, setNascimentoCliente] = useState<string | null>(null);
  const [negociacoes, setNegociacoes] = useState<Record<string, NegociacaoState>>({});

  useEffect(() => {
    async function fetchDebitos() {
      if (!cpf) return;
      const { data, error } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
      if (!error && data && data.length > 0) {
        const typedData = data as Debito[];
        setDebitos(typedData);
        setNomeCliente(typedData[0].nome);
        setCpfCliente(typedData[0].cpf);
        setNascimentoCliente(typedData[0].data_vencimento);
      }
      setLoading(false);
    }
    fetchDebitos();
  }, [cpf]);

  const toggleNegociacao = (id: string) => {
    setNegociacoes(prev => ({
      ...prev,
      [id]: prev[id]?.negociando
        ? { ...prev[id], negociando: false, confirmado: false }
        : { negociando: true, confirmado: false, entrada: 0, parcelas: 1, dataPrimeiroPagamento: undefined }
    }));
  };

  const updateNegociacao = (id: string, updates: Partial<NegociacaoState>) => {
    setNegociacoes(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const confirmarNegociacao = (id: string) => {
    updateNegociacao(id, { confirmado: true });
  };

  const getValorParcela = (debito: Debito, neg: NegociacaoState) => {
    const restante = debito.valor_original - (neg.entrada || 0);
    if (restante <= 0 || neg.parcelas < 1) return 0;
    return restante / neg.parcelas;
  };

  const getMaxParcelas = (neg: NegociacaoState) => {
    return neg.entrada > 0 ? 23 : 24;
  };

  const isNegociacaoValida = (debito: Debito, neg: NegociacaoState) => {
    if (!neg.dataPrimeiroPagamento) return false;
    if (neg.entrada > debito.valor_original) return false;
    if (neg.entrada < 0) return false;
    const valorParcela = getValorParcela(debito, neg);
    if (valorParcela < 1 && (debito.valor_original - (neg.entrada || 0)) > 0) return false;
    return true;
  };

  const gerarWhatsappLink = (debito: Debito, neg: NegociacaoState) => {
    const valorParcela = getValorParcela(debito, neg);
    const dataFormatada = neg.dataPrimeiroPagamento
      ? format(neg.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })
      : '';

    let msg: string;
    if (neg.entrada > 0) {
      msg = `Olá! Meu nome é ${nomeCliente}, meu CPF é ${cpfCliente} e quero negociar o contrato em aberto de número ${debito.contrato || 'N/A'}, da seguinte forma: Entrada de ${formatCurrency(neg.entrada)} e mais ${neg.parcelas}x de ${formatCurrency(valorParcela)}. Quero pagar a primeira parcela no dia ${dataFormatada}. Me envie o boleto por gentileza.`;
    } else {
      msg = `Olá! Meu nome é ${nomeCliente}, meu CPF é ${cpfCliente} e quero negociar o contrato em aberto de número ${debito.contrato || 'N/A'}, da seguinte forma: ${neg.parcelas}x de ${formatCurrency(valorParcela)}. Quero pagar a primeira parcela no dia ${dataFormatada}. Me envie o boleto por gentileza.`;
    }

    return `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  };

  const handleEntradaChange = (id: string, value: string) => {
    const num = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    updateNegociacao(id, { entrada: num });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004080 100%)' }}>
      <header className="border-b px-4 py-3" style={{ borderColor: '#ffffff15' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoGrupoAltum} alt="Grupo Altum" className="h-14" />
            <p className="text-sm" style={{ color: '#ffffffaa' }}>Portal de Negociação</p>
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
                  Não encontramos débitos em aberto para o CPF informado.
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <p className="text-sm" style={{ color: '#ffffffaa' }}>
                    CPF: {formatCpfFull(cpfCliente)}
                  </p>
                  {nascimentoCliente && (
                    <p className="text-sm" style={{ color: '#ffffffaa' }}>
                      Nascimento: {formatDateBR(nascimentoCliente)}
                    </p>
                  )}
                </div>
                <p className="mt-2" style={{ color: '#ffffffaa' }}>
                  Encontramos {debitos.length} débito{debitos.length > 1 ? 's' : ''} em aberto. Negocie agora!
                </p>
              </div>

              <div className="grid gap-4">
                {debitos.map((debito) => {
                  const neg = negociacoes[debito.id];
                  const valorParcela = neg ? getValorParcela(debito, neg) : 0;
                  const maxParcelas = neg ? getMaxParcelas(neg) : 24;

                  return (
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
                        <div className="mb-4">
                          <p className="text-xs mb-1" style={{ color: '#ffffff77' }}>Valor do Débito</p>
                          <p className="text-2xl font-bold" style={{ color: '#ff6b6b' }}>{formatCurrency(debito.valor_original)}</p>
                        </div>

                        {!neg?.negociando ? (
                          <Button className="w-full" style={{ background: '#00a86b', color: '#fff' }} onClick={() => toggleNegociacao(debito.id)}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Negociar este débito
                          </Button>
                        ) : !neg.confirmado ? (
                          <div className="space-y-4 pt-2" style={{ borderTop: '1px solid #ffffff15' }}>
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-sm" style={{ color: '#00a86b' }}>Monte sua proposta</h3>
                              <button onClick={() => toggleNegociacao(debito.id)} className="text-xs hover:underline" style={{ color: '#ffffff77' }}>
                                Cancelar
                              </button>
                            </div>

                            {/* Entrada */}
                            <div>
                              <Label className="text-xs" style={{ color: '#ffffffaa' }}>Valor de entrada (opcional)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={debito.valor_original}
                                step={0.01}
                                placeholder="R$ 0,00"
                                value={neg.entrada || ''}
                                onChange={(e) => handleEntradaChange(debito.id, e.target.value)}
                                className="mt-1 border-0"
                                style={{ background: '#ffffff15', color: '#fff' }}
                              />
                              {neg.entrada > debito.valor_original && (
                                <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>Entrada não pode ser maior que o valor do débito</p>
                              )}
                            </div>

                            {/* Parcelas */}
                            <div>
                              <Label className="text-xs" style={{ color: '#ffffffaa' }}>Número de parcelas</Label>
                              <Select
                                value={String(neg.parcelas)}
                                onValueChange={(v) => updateNegociacao(debito.id, { parcelas: parseInt(v) })}
                              >
                                <SelectTrigger className="mt-1 border-0" style={{ background: '#ffffff15', color: '#fff' }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(n => (
                                    <SelectItem key={n} value={String(n)}>{n}x de {formatCurrency((debito.valor_original - (neg.entrada || 0)) / n)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Data primeiro pagamento */}
                            <div>
                              <Label className="text-xs" style={{ color: '#ffffffaa' }}>Data do primeiro pagamento</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn("w-full mt-1 justify-start text-left font-normal border-0", !neg.dataPrimeiroPagamento && "opacity-70")}
                                    style={{ background: '#ffffff15', color: '#fff' }}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {neg.dataPrimeiroPagamento
                                      ? format(neg.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })
                                      : 'Selecione a data'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={neg.dataPrimeiroPagamento}
                                    onSelect={(d) => updateNegociacao(debito.id, { dataPrimeiroPagamento: d })}
                                    disabled={(date) => {
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      return date < today;
                                    }}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                    locale={ptBR}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Resumo */}
                            {neg.dataPrimeiroPagamento && neg.entrada <= debito.valor_original && (
                              <div className="rounded-lg p-3" style={{ background: '#ffffff0a', border: '1px solid #ffffff15' }}>
                                <p className="text-xs font-semibold mb-2" style={{ color: '#00a86b' }}>Resumo da negociação</p>
                                {neg.entrada > 0 && (
                                  <p className="text-sm" style={{ color: '#ffffffcc' }}>Entrada: {formatCurrency(neg.entrada)}</p>
                                )}
                                <p className="text-sm" style={{ color: '#ffffffcc' }}>
                                  {neg.parcelas}x de {formatCurrency(valorParcela)}
                                </p>
                                <p className="text-sm" style={{ color: '#ffffffcc' }}>
                                  Primeiro pagamento: {format(neg.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            )}

                            <Button
                              className="w-full"
                              style={{ background: '#00a86b', color: '#fff' }}
                              disabled={!isNegociacaoValida(debito, neg)}
                              onClick={() => confirmarNegociacao(debito.id)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Confirmar proposta
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #ffffff15' }}>
                            <div className="rounded-lg p-3" style={{ background: '#00a86b15', border: '1px solid #00a86b33' }}>
                              <p className="text-xs font-semibold mb-2" style={{ color: '#00a86b' }}>✓ Proposta confirmada</p>
                              {neg.entrada > 0 && (
                                <p className="text-sm" style={{ color: '#ffffffcc' }}>Entrada: {formatCurrency(neg.entrada)}</p>
                              )}
                              <p className="text-sm" style={{ color: '#ffffffcc' }}>
                                {neg.parcelas}x de {formatCurrency(valorParcela)}
                              </p>
                              <p className="text-sm" style={{ color: '#ffffffcc' }}>
                                Primeiro pagamento: {format(neg.dataPrimeiroPagamento!, 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                            <a href={gerarWhatsappLink(debito, neg)} target="_blank" rel="noopener noreferrer" className="block">
                              <Button className="w-full" style={{ background: '#25d366', color: '#fff' }}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Enviar proposta pelo WhatsApp
                              </Button>
                            </a>
                            <button onClick={() => updateNegociacao(debito.id, { confirmado: false })} className="w-full text-xs text-center hover:underline" style={{ color: '#ffffff77' }}>
                              Alterar proposta
                            </button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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
