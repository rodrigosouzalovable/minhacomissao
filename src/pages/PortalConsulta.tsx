import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Phone, Search, FileText, MessageCircle, Shield, HandshakeIcon, Clock, HelpCircle, Star, ChevronRight } from 'lucide-react';
import logoGrupoAltum from '@/assets/logo-grupo-altum.png';
import logoSouzaRibeiro from '@/assets/logo-souza-ribeiro.png';

function formatCpfInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

const PHONE = '5562981089329';
const PHONE_DISPLAY = '(62) 98108-9329';

export default function PortalConsulta() {
  const [cpf, setCpf] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cpf.replace(/\D/g, '');
    if (isValidCpf(cpf)) {
      navigate(`/consulta/${digits}`);
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004080 100%)' }}>
      {/* Header */}
      <header className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #001a33 0%, #002b55 100%)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logos */}
          <div className="flex items-center gap-4 sm:gap-6">
            <img
              src={logoSouzaRibeiro}
              alt="Souza e Ribeiro"
              className="h-10 sm:h-12 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
            <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.25)' }} />
            <img
              src={logoGrupoAltum}
              alt="Grupo Altum"
              className="h-10 sm:h-12 w-auto"
            />
          </div>

          {/* Nav Links - desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('beneficios')} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Benefícios
            </button>
            <button onClick={() => scrollTo('como-funciona')} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Como funciona
            </button>
            <button onClick={() => scrollTo('duvidas')} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Dúvidas
            </button>
          </nav>

          {/* Phone + Área Restrita */}
          <div className="flex items-center gap-4">
            <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 text-sm font-medium" style={{ color: '#00a86b' }}>
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </a>
            <a href="/auth" className="text-xs underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Área Restrita
            </a>
          </div>
        </div>
      </header>

      {/* Hero - Split Layout */}
      <section className="flex-1 flex items-center px-4 py-12 sm:py-20">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left Column - Badge + Motivational Text */}
          <div className="text-center lg:text-left">
            {/* Big Badge */}
            <div className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 mb-8" style={{ background: 'rgba(0,168,107,0.15)', border: '2px solid rgba(0,168,107,0.3)' }}>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: '#00a86b' }}>
                <HandshakeIcon className="h-7 w-7" style={{ color: '#fff' }} />
              </div>
              <span className="text-xl sm:text-2xl font-bold" style={{ color: '#00a86b' }}>Portal de Acordos</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4" style={{ color: '#fff' }}>
              Aproveite e coloque sua{' '}
              <span style={{ color: '#00a86b' }}>vida financeira</span>{' '}
              em dia.
            </h1>

            <p className="text-lg sm:text-xl mb-6" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Negocie seus débitos com condições especiais e recupere seu nome.
            </p>

            <div className="inline-flex items-center gap-2 rounded-full px-5 py-2.5" style={{ background: 'rgba(0,168,107,0.2)', border: '1px solid rgba(0,168,107,0.4)' }}>
              <Star className="h-5 w-5" style={{ color: '#00a86b' }} />
              <span className="text-base font-semibold" style={{ color: '#00a86b' }}>Condições Imperdíveis</span>
            </div>
          </div>

          {/* Right Column - Consultation Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md border-0 shadow-2xl" style={{ background: '#fff' }}>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full mb-4" style={{ background: 'rgba(0,51,102,0.1)' }}>
                    <Search className="h-7 w-7" style={{ color: '#003366' }} />
                  </div>
                  <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Consulte suas dívidas</h2>
                  <p className="text-sm" style={{ color: '#666' }}>
                    Digite seu CPF para verificar débitos em aberto
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="cpf" className="text-sm font-medium" style={{ color: '#333' }}>CPF</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                      className="h-12 text-center text-lg mt-1.5 border-2"
                      style={{ borderColor: '#e0e0e0', color: '#1a1a2e' }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!isValidCpf(cpf)}
                    className="w-full h-12 text-base font-semibold rounded-lg"
                    style={{ background: '#00a86b', color: '#fff' }}
                  >
                    <Search className="h-5 w-5 mr-2" />
                    Consultar
                  </Button>
                </form>

                <div className="flex items-center gap-2 mt-4 justify-center">
                  <Shield className="h-4 w-4" style={{ color: '#999' }} />
                  <span className="text-xs" style={{ color: '#999' }}>Consulta segura e sigilosa</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-10" style={{ color: '#fff' }}>Por que negociar conosco?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: HandshakeIcon, title: 'Negociação facilitada', desc: 'Processo simples e direto pelo WhatsApp.' },
              { icon: Clock, title: 'Atendimento rápido', desc: 'Resposta em até 24 horas úteis.' },
              { icon: Shield, title: 'Sigilo garantido', desc: 'Seus dados são tratados com total segurança.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,168,107,0.15)' }}>
                  <item.icon className="h-5 w-5" style={{ color: '#00a86b' }} />
                </div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#fff' }}>{item.title}</h4>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="px-4 py-16" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-10" style={{ color: '#fff' }}>Como funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Search, title: '1. Consulte seu CPF', desc: 'Digite seu CPF no campo acima para verificar débitos em aberto.' },
              { icon: FileText, title: '2. Veja seus débitos', desc: 'Confira os detalhes dos seus débitos: valores, contratos e vencimentos.' },
              { icon: MessageCircle, title: '3. Entre em contato', desc: 'Negocie condições especiais diretamente pelo WhatsApp.' },
            ].map((step) => (
              <Card key={step.title} className="border-0" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full mb-4" style={{ background: 'rgba(0,168,107,0.15)' }}>
                    <step.icon className="h-7 w-7" style={{ color: '#00a86b' }} />
                  </div>
                  <h4 className="font-semibold text-lg mb-2" style={{ color: '#fff' }}>{step.title}</h4>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-10" style={{ color: '#fff' }}>Dúvidas frequentes</h3>
          <div className="space-y-4">
            {[
              { q: 'Meus dados estão seguros?', a: 'Sim. Todas as consultas são sigilosas e seus dados são tratados com total segurança.' },
              { q: 'Como faço para negociar?', a: 'Após consultar seu CPF, entre em contato pelo WhatsApp para negociar condições especiais.' },
              { q: 'Qual o prazo de resposta?', a: 'Nossa equipe responde em até 24 horas úteis após o contato.' },
            ].map((faq) => (
              <div key={faq.q} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#00a86b' }} />
                  <div>
                    <h4 className="font-semibold mb-1" style={{ color: '#fff' }}>{faq.q}</h4>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Entre em contato:{' '}
            <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00a86b' }}>
              {PHONE_DISPLAY}
            </a>
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            © {new Date().getFullYear()} Grupo Altum — Todos os direitos reservados
          </p>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href={`https://wa.me/${PHONE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
        style={{ background: '#25D366' }}
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-7 w-7" style={{ color: '#fff' }} />
      </a>
    </div>
  );
}
