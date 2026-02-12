import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Search, FileText, MessageCircle, Shield, HandshakeIcon, Clock } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004080 100%)' }}>
      {/* Header */}
      <header className="border-b border-[#ffffff15] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: '#00a86b', color: '#fff' }}>
              GA
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#fff' }}>GRUPO ALTUM</h1>
              <p className="text-xs" style={{ color: '#ffffffaa' }}>Portal de Negociação</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-2 text-sm" style={{ color: '#00a86b' }}>
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </a>
            <a href="/auth" className="text-xs underline" style={{ color: '#ffffff80' }}>
              Área Restrita
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6" style={{ background: '#00a86b22', color: '#00a86b', border: '1px solid #00a86b44' }}>
            <Shield className="h-4 w-4" />
            Consulta segura e sigilosa
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold mb-4" style={{ color: '#fff' }}>
            Consulte seus débitos
          </h2>
          <p className="text-lg mb-8" style={{ color: '#ffffffbb' }}>
            Digite seu CPF para verificar se há débitos em aberto e entre em contato para negociar condições especiais.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input
              placeholder="Digite seu CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCpfInput(e.target.value))}
              className="h-12 text-center text-lg border-2 bg-[#ffffff15] placeholder:text-[#ffffff66]"
              style={{ color: '#fff', borderColor: '#ffffff33' }}
            />
            <Button
              type="submit"
              disabled={!isValidCpf(cpf)}
              className="h-12 px-8 text-base font-semibold"
              style={{ background: '#00a86b', color: '#fff' }}
            >
              <Search className="h-5 w-5 mr-2" />
              Consultar
            </Button>
          </form>
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-4 py-16" style={{ background: '#00000033' }}>
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-10" style={{ color: '#fff' }}>Como funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Search, title: '1. Consulte seu CPF', desc: 'Digite seu CPF no campo acima para verificar débitos em aberto.' },
              { icon: FileText, title: '2. Veja seus débitos', desc: 'Confira os detalhes dos seus débitos: valores, contratos e vencimentos.' },
              { icon: MessageCircle, title: '3. Entre em contato', desc: 'Negocie condições especiais diretamente pelo WhatsApp.' },
            ].map((step) => (
              <Card key={step.title} className="border-0" style={{ background: '#ffffff0d' }}>
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-full mb-4" style={{ background: '#00a86b22' }}>
                    <step.icon className="h-7 w-7" style={{ color: '#00a86b' }} />
                  </div>
                  <h4 className="font-semibold text-lg mb-2" style={{ color: '#fff' }}>{step.title}</h4>
                  <p className="text-sm" style={{ color: '#ffffffaa' }}>{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-10" style={{ color: '#fff' }}>Por que negociar conosco?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: HandshakeIcon, title: 'Negociação facilitada', desc: 'Processo simples e direto pelo WhatsApp.' },
              { icon: Clock, title: 'Atendimento rápido', desc: 'Resposta em até 24 horas úteis.' },
              { icon: Shield, title: 'Sigilo garantido', desc: 'Seus dados são tratados com total segurança.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 p-4 rounded-lg" style={{ background: '#ffffff08' }}>
                <item.icon className="h-6 w-6 mt-0.5 shrink-0" style={{ color: '#00a86b' }} />
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#fff' }}>{item.title}</h4>
                  <p className="text-sm" style={{ color: '#ffffffaa' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8" style={{ borderColor: '#ffffff15', background: '#00000033' }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm mb-2" style={{ color: '#ffffffaa' }}>
            Entre em contato: <a href={`https://wa.me/${PHONE}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00a86b' }}>{PHONE_DISPLAY}</a>
          </p>
          <p className="text-xs" style={{ color: '#ffffff55' }}>
            © {new Date().getFullYear()} Grupo Altum — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
