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
import { ArrowLeft, MessageCircle, FileText, Phone, AlertCircle, CalendarIcon, Check, Shield, Lock, Clock, ChevronDown, TrendingDown, Sparkles } from 'lucide-react';
import logoGrupoAltum from '@/assets/logo-grupo-altum-negociacao.png';
import DiscountTierSelector, { type DescontoFaixa, getDesconto, getMinParcelas, getMaxParcelasFaixa } from '@/components/negociacao/DiscountTierSelector';
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
  descontoFaixa: DescontoFaixa | undefined;
}

const PHONE = '5562982183144';
const VALOR_MINIMO_PARCELA = 90;
const PHONE_DISPLAY = '(62) 98218-3144';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCpfFull(cpf: string) {
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export default function ConsultaResultado() {
  const { cpf } = useParams<{ cpf: string }>();
  const [debitos, setDebitos] = useState<Debito[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeCliente, setNomeCliente] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [mostrarTodosDebitos, setMostrarTodosDebitos] = useState(false);

  const [negociacao, setNegociacao] = useState<NegociacaoState | null>(null);

  useEffect(() => {
    async function fetchDebitos() {
      if (!cpf) return;
      const { data, error } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
      if (!error && data && data.length > 0) {
        const typedData = data as Debito[];
        setDebitos(typedData);
        setNomeCliente(typedData[0].nome);
        setCpfCliente(typedData[0].cpf);
      }
      setLoading(false);
    }
    fetchDebitos();
  }, [cpf]);

  const valorTotal = debitos.reduce((acc, d) => acc + d.valor_original, 0);
  const valorAvista = valorTotal * 0.5;

  const toggleNegociacao = () => {
    setNegociacao(prev =>
      prev?.negociando
        ? null
        : { negociando: true, confirmado: false, entrada: 0, parcelas: 1, dataPrimeiroPagamento: undefined, descontoFaixa: undefined }
    );
  };

  const updateNegociacao = (updates: Partial<NegociacaoState>) => {
    setNegociacao(prev => prev ? { ...prev, ...updates } : prev);
  };

  const getValorComDesconto = (neg: NegociacaoState) => {
    if (!neg.descontoFaixa) return valorTotal;
    const desconto = getDesconto(neg.descontoFaixa);
    return valorTotal * (1 - desconto / 100);
  };

  const getValorParcela = (neg: NegociacaoState) => {
    const valorDesc = getValorComDesconto(neg);
    const restante = valorDesc - (neg.entrada || 0);
    if (restante <= 0 || neg.parcelas < 1) return 0;
    return restante / neg.parcelas;
  };

  const getMaxParcelas = (neg: NegociacaoState) => {
    if (!neg.descontoFaixa) return 24;
    const maxPelaFaixa = getMaxParcelasFaixa(neg.descontoFaixa);
    const valorDesc = getValorComDesconto(neg);
    const restante = valorDesc - (neg.entrada || 0);
    const maxPeloValor = restante > 0 ? Math.floor(restante / VALOR_MINIMO_PARCELA) : 1;
    return Math.max(1, Math.min(maxPelaFaixa, maxPeloValor));
  };

  const isNegociacaoValida = (neg: NegociacaoState) => {
    if (!neg.descontoFaixa) return false;
    if (!neg.dataPrimeiroPagamento) return false;
    const valorDesc = getValorComDesconto(neg);
    if (neg.entrada > valorDesc) return false;
    if (neg.entrada < 0) return false;
    const valorParcela = getValorParcela(neg);
    if (valorParcela < VALOR_MINIMO_PARCELA && (valorDesc - (neg.entrada || 0)) > 0) return false;
    return true;
  };

  const handleSelectFaixa = (faixa: DescontoFaixa) => {
    const min = getMinParcelas(faixa);
    updateNegociacao({ descontoFaixa: faixa, parcelas: min, entrada: 0 });
  };

  const gerarWhatsappLink = (neg: NegociacaoState) => {
    const valorParcela = getValorParcela(neg);
    const valorDesc = getValorComDesconto(neg);
    const desconto = neg.descontoFaixa ? getDesconto(neg.descontoFaixa) : 0;
    const dataFormatada = neg.dataPrimeiroPagamento
      ? format(neg.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })
      : '';
    const contratosStr = debitos.map(d => d.contrato).filter(Boolean).join(', ');
    const descontoStr = desconto > 0 ? `, com desconto de ${desconto}%, totalizando ${formatCurrency(valorDesc)}` : '';

    let msg: string;
    if (neg.entrada > 0) {
      msg = `Olá! Meu nome é ${nomeCliente}, meu CPF é ${cpfCliente} e quero negociar os contratos em aberto ${contratosStr}, no valor total de ${formatCurrency(valorTotal)}${descontoStr}, da seguinte forma: Entrada de ${formatCurrency(neg.entrada)} e mais ${neg.parcelas}x de ${formatCurrency(valorParcela)}. Quero pagar a primeira parcela no dia ${dataFormatada}. Me envie o boleto por gentileza.`;
    } else {
      msg = `Olá! Meu nome é ${nomeCliente}, meu CPF é ${cpfCliente} e quero negociar os contratos em aberto ${contratosStr}, no valor total de ${formatCurrency(valorTotal)}${descontoStr}, da seguinte forma: ${neg.parcelas}x de ${formatCurrency(valorParcela)}. Quero pagar a primeira parcela no dia ${dataFormatada}. Me envie o boleto por gentileza.`;
    }

    return `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
  };

  const handleEntradaChange = (value: string) => {
    const num = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    updateNegociacao({ entrada: num });
  };

  const debitosVisiveis = mostrarTodosDebitos ? debitos : debitos.slice(0, 2);
  const debitosOcultos = debitos.length - 2;

  const isDebitoVencido = (d: Debito) => {
    if (!d.data_vencimento) return false;
    return new Date(d.data_vencimento + 'T00:00:00') < new Date();
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
              {/* Header persuasivo */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #ff6b3d, #ff9a5c)',
                      color: '#fff',
                      animation: 'shimmer 2.5s ease-in-out infinite',
                      boxShadow: '0 2px 10px rgba(255, 107, 61, 0.3)',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Oportunidade exclusiva
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{ background: '#ffffff11', color: '#ffffffaa' }}
                  >
                    <Clock className="h-3 w-3" style={{ animation: 'float 2s ease-in-out infinite' }} />
                    Oferta por tempo limitado
                  </span>
                </div>

                <h2 className="text-3xl font-black mb-1" style={{ color: '#fff' }}>
                  Olá, <span style={{ color: '#00ff88' }}>{nomeCliente}</span>!
                </h2>
                <p className="text-sm" style={{ color: '#ffffffaa' }}>
                  CPF: {formatCpfFull(cpfCliente)}
                </p>
                <p className="mt-2 text-base" style={{ color: '#ffffffcc' }}>
                  Aproveite esta oportunidade única para regularizar sua situação com <strong style={{ color: '#00a86b' }}>até 50% de desconto</strong>!
                </p>
              </div>

              {/* Cards de débito colapsáveis */}
              <div className="space-y-2 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffffff66' }}>
                  {debitos.length} débito{debitos.length > 1 ? 's' : ''} em aberto
                </p>
                {debitosVisiveis.map((debito, index) => (
                  <Card key={debito.id} className="border-0" style={{ background: '#ffffff0a', borderLeft: isDebitoVencido(debito) ? '3px solid #ff6b6b' : '3px solid #ffffff15' }}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm" style={{ color: '#fff' }}>
                            Parcela {index + 1} de {debitos.length}
                          </p>
                          {isDebitoVencido(debito) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#ff6b6b22', color: '#ff6b6b', border: '1px solid #ff6b6b44' }}>
                              VENCIDO
                            </span>
                          )}
                        </div>
                        {debito.contrato && (
                          <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#ffffffaa' }}>
                            <FileText className="h-3 w-3" />
                            Contrato: {debito.contrato}
                          </p>
                        )}
                        {debito.data_vencimento && (
                          <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#ffffffaa' }}>
                            <CalendarIcon className="h-3 w-3" />
                            Vencimento: {format(new Date(debito.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <p className="text-lg font-black" style={{ color: '#ff6b6b' }}>
                        {formatCurrency(debito.valor_original)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {debitos.length > 2 && !mostrarTodosDebitos && (
                  <button
                    onClick={() => setMostrarTodosDebitos(true)}
                    className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ color: '#00a86b', background: '#00a86b11' }}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Ver mais {debitosOcultos} débito{debitosOcultos > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Card de valor total premium */}
              <Card className="border-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #0d1f3c 100%)', border: '1px solid #ffffff10' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#ffffff55' }}>
                    Valor total dos débitos
                  </CardTitle>
                  <p className="text-4xl font-black" style={{ color: '#ff6b6b' }}>
                    {formatCurrency(valorTotal)}
                  </p>

                  {/* Destaque à vista */}
                  <div className="rounded-xl p-4 mt-3" style={{ background: 'linear-gradient(135deg, #00a86b15, #00cc8815)', border: '1px solid #00a86b33' }}>
                    <p className="text-sm mb-1" style={{ color: '#ffffffaa' }}>
                      Mas você pode pagar à vista por apenas:
                    </p>
                    <p className="text-3xl font-black" style={{ color: '#00ff88', animation: 'float 4s ease-in-out infinite' }}>
                      {formatCurrency(valorAvista)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <TrendingDown className="h-4 w-4" style={{ color: '#00a86b' }} />
                      <span className="text-sm font-bold" style={{ color: '#00a86b' }}>
                        Economize {formatCurrency(valorTotal - valorAvista)}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                        style={{ background: '#00a86b22', color: '#00a86b', border: '1px solid #00a86b44' }}
                      >
                        50% OFF
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {!negociacao?.negociando ? (
                    <Button
                      className="w-full h-14 text-base font-bold rounded-xl"
                      style={{
                        background: 'linear-gradient(135deg, #00a86b, #00cc88)',
                        color: '#fff',
                        boxShadow: '0 4px 20px rgba(0, 168, 107, 0.4)',
                        animation: 'pulse-border 2s ease-in-out infinite',
                      }}
                      onClick={toggleNegociacao}
                    >
                      <MessageCircle className="h-5 w-5 mr-2" />
                      NEGOCIAR AGORA COM DESCONTO
                    </Button>
                  ) : !negociacao.confirmado ? (
                    <div className="space-y-5 pt-4" style={{ borderTop: '1px solid #ffffff15' }}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base flex items-center gap-2" style={{ color: '#00a86b' }}>
                          <Sparkles className="h-4 w-4" />
                          Monte sua proposta
                        </h3>
                        <button onClick={toggleNegociacao} className="text-xs hover:underline" style={{ color: '#ffffff55' }}>
                          Cancelar
                        </button>
                      </div>

                      <DiscountTierSelector
                        selected={negociacao.descontoFaixa}
                        onSelect={handleSelectFaixa}
                        valorTotal={valorTotal}
                      />

                      {negociacao.descontoFaixa && (
                        <>
                          {/* Valor com desconto destaque */}
                          {negociacao.descontoFaixa !== 'sem' && (
                            <div
                              className="rounded-xl p-5 text-center"
                              style={{
                                background: 'linear-gradient(135deg, #00a86b15, #00cc8815)',
                                border: '1px solid #00a86b44',
                                boxShadow: '0 0 30px rgba(0, 168, 107, 0.1)',
                              }}
                            >
                              <p className="text-xs mb-1" style={{ color: '#ffffffaa' }}>
                                De <span style={{ textDecoration: 'line-through', color: '#ff6b6b' }}>{formatCurrency(valorTotal)}</span> por
                              </p>
                              <p className="text-4xl font-black" style={{ color: '#00ff88' }}>
                                {formatCurrency(getValorComDesconto(negociacao))}
                              </p>
                              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full" style={{ background: '#00a86b22', border: '1px solid #00a86b44' }}>
                                <TrendingDown className="h-3.5 w-3.5" style={{ color: '#00a86b' }} />
                                <p className="text-xs font-bold" style={{ color: '#00a86b' }}>
                                  Você economiza {formatCurrency(valorTotal - getValorComDesconto(negociacao))} ({getDesconto(negociacao.descontoFaixa)}%)
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Entrada - hide for à vista */}
                          {negociacao.descontoFaixa !== 'avista' && (
                            <div>
                              <Label className="text-xs font-semibold" style={{ color: '#ffffffaa' }}>Valor de entrada (opcional)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={getValorComDesconto(negociacao)}
                                step={0.01}
                                placeholder="R$ 0,00"
                                value={negociacao.entrada || ''}
                                onChange={(e) => handleEntradaChange(e.target.value)}
                                className="mt-1 border-0 h-12 rounded-xl text-base"
                                style={{ background: '#ffffff12', color: '#fff' }}
                              />
                              {negociacao.entrada > getValorComDesconto(negociacao) && (
                                <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>Entrada não pode ser maior que o valor com desconto</p>
                              )}
                            </div>
                          )}

                          {/* Parcelas - hide for à vista */}
                          {negociacao.descontoFaixa !== 'avista' && (
                            <div>
                              <Label className="text-xs font-semibold" style={{ color: '#ffffffaa' }}>Número de parcelas</Label>
                              <Select
                                value={String(negociacao.parcelas)}
                                onValueChange={(v) => updateNegociacao({ parcelas: parseInt(v) })}
                              >
                                <SelectTrigger className="mt-1 border-0 h-12 rounded-xl text-base" style={{ background: '#ffffff12', color: '#fff' }}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from(
                                    { length: getMaxParcelas(negociacao) - getMinParcelas(negociacao.descontoFaixa) + 1 },
                                    (_, i) => i + getMinParcelas(negociacao.descontoFaixa)
                                  ).map(n => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}x de {formatCurrency((getValorComDesconto(negociacao) - (negociacao.entrada || 0)) / n)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div>
                            <Label className="text-xs font-semibold" style={{ color: '#ffffffaa' }}>Data do primeiro pagamento</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn("w-full mt-1 justify-start text-left font-normal border-0 h-12 rounded-xl text-base", !negociacao.dataPrimeiroPagamento && "opacity-70")}
                                  style={{ background: '#ffffff12', color: '#fff' }}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {negociacao.dataPrimeiroPagamento
                                    ? format(negociacao.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })
                                    : 'Selecione a data'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={negociacao.dataPrimeiroPagamento}
                                  onSelect={(d) => updateNegociacao({ dataPrimeiroPagamento: d })}
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

                          {/* Resumo premium */}
                          {negociacao.dataPrimeiroPagamento && negociacao.entrada <= getValorComDesconto(negociacao) && (
                            <div
                              className="rounded-xl p-4"
                              style={{
                                background: 'linear-gradient(135deg, #00a86b08, #00cc8808)',
                                border: '1px solid #00a86b33',
                                boxShadow: '0 0 20px rgba(0, 168, 107, 0.05)',
                              }}
                            >
                              <p className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#00a86b' }}>
                                <Check className="h-4 w-4" />
                                Resumo da negociação
                              </p>
                              {negociacao.descontoFaixa !== 'sem' && (
                                <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>
                                  Desconto: {getDesconto(negociacao.descontoFaixa)}% — <span style={{ textDecoration: 'line-through', color: '#ff6b6b' }}>{formatCurrency(valorTotal)}</span> → <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{formatCurrency(getValorComDesconto(negociacao))}</span>
                                </p>
                              )}
                              {negociacao.entrada > 0 && (
                                <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>Entrada: {formatCurrency(negociacao.entrada)}</p>
                              )}
                              <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>
                                {negociacao.parcelas}x de <strong style={{ color: '#00ff88' }}>{formatCurrency(getValorParcela(negociacao))}</strong>
                              </p>
                              <p className="text-sm" style={{ color: '#ffffffcc' }}>
                                Primeiro pagamento: {format(negociacao.dataPrimeiroPagamento, 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                          )}

                          <Button
                            className="w-full h-14 text-base font-bold rounded-xl"
                            style={{
                              background: isNegociacaoValida(negociacao)
                                ? 'linear-gradient(135deg, #00a86b, #00cc88)'
                                : '#ffffff15',
                              color: '#fff',
                              boxShadow: isNegociacaoValida(negociacao) ? '0 4px 20px rgba(0, 168, 107, 0.4)' : 'none',
                              animation: isNegociacaoValida(negociacao) ? 'pulse-border 2s ease-in-out infinite' : 'none',
                            }}
                            disabled={!isNegociacaoValida(negociacao)}
                            onClick={() => updateNegociacao({ confirmado: true })}
                          >
                            <Check className="h-5 w-5 mr-2" />
                            CONFIRMAR PROPOSTA
                          </Button>

                          <a
                            href={`https://wa.me/5562982183144?text=${encodeURIComponent(
                              `Olá! Meu nome é ${nomeCliente}, CPF ${cpfCliente}, e gostaria de fazer uma contra proposta para os contratos ${debitos.map(d => d.contrato).filter(Boolean).join(', ')}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Button
                              variant="outline"
                              className="w-full h-12 rounded-xl text-sm"
                              style={{ borderColor: '#ffffff22', color: '#ffffffaa', background: '#ffffff05' }}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              TENHO UMA CONTRA PROPOSTA
                            </Button>
                          </a>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Confirmação */
                    <div className="space-y-4 pt-4" style={{ borderTop: '1px solid #ffffff15' }}>
                      <div
                        className="rounded-xl p-5 text-center"
                        style={{
                          background: 'linear-gradient(135deg, #00a86b15, #00cc8815)',
                          border: '1px solid #00a86b44',
                        }}
                      >
                        <div
                          className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                          style={{ background: '#00a86b', boxShadow: '0 0 30px rgba(0, 168, 107, 0.4)' }}
                        >
                          <Check className="h-8 w-8" style={{ color: '#fff' }} />
                        </div>
                        <p className="text-lg font-bold mb-3" style={{ color: '#00ff88' }}>✓ Proposta confirmada!</p>
                        {negociacao.descontoFaixa && negociacao.descontoFaixa !== 'sem' && (
                          <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>
                            Desconto: {getDesconto(negociacao.descontoFaixa)}% — <span style={{ textDecoration: 'line-through', color: '#ff6b6b' }}>{formatCurrency(valorTotal)}</span> → <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{formatCurrency(getValorComDesconto(negociacao))}</span>
                          </p>
                        )}
                        {negociacao.entrada > 0 && (
                          <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>Entrada: {formatCurrency(negociacao.entrada)}</p>
                        )}
                        <p className="text-sm mb-1" style={{ color: '#ffffffcc' }}>
                          {negociacao.parcelas}x de <strong style={{ color: '#00ff88' }}>{formatCurrency(getValorParcela(negociacao))}</strong>
                        </p>
                        <p className="text-sm" style={{ color: '#ffffffcc' }}>
                          Primeiro pagamento: {format(negociacao.dataPrimeiroPagamento!, 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <a href={gerarWhatsappLink(negociacao)} target="_blank" rel="noopener noreferrer" className="block">
                        <Button
                          className="w-full h-14 text-base font-bold rounded-xl"
                          style={{
                            background: 'linear-gradient(135deg, #25d366, #128c7e)',
                            color: '#fff',
                            boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
                            animation: 'pulse-border 2s ease-in-out infinite',
                          }}
                        >
                          <MessageCircle className="h-5 w-5 mr-2" />
                          ENVIAR PROPOSTA PELO WHATSAPP
                        </Button>
                      </a>
                      <button onClick={() => updateNegociacao({ confirmado: false })} className="w-full text-xs text-center hover:underline" style={{ color: '#ffffff55' }}>
                        Alterar proposta
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Footer com selos de confiança */}
      <footer className="border-t px-4 py-8" style={{ borderColor: '#ffffff10', background: '#00000044' }}>
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-1.5" style={{ color: '#ffffff44' }}>
              <Shield className="h-4 w-4" />
              <span className="text-xs">Negociação Segura</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: '#ffffff44' }}>
              <Lock className="h-4 w-4" />
              <span className="text-xs">Dados Protegidos</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: '#ffffff44' }}>
              <Shield className="h-4 w-4" />
              <span className="text-xs">LGPD Compliance</span>
            </div>
          </div>
          <p className="text-[10px]" style={{ color: '#ffffff33' }}>
            Suas informações são tratadas com total sigilo e segurança conforme a Lei Geral de Proteção de Dados (LGPD).
          </p>
          <p className="text-xs" style={{ color: '#ffffff44' }}>
            © {new Date().getFullYear()} Grupo Altum — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
