import { Link } from 'react-router-dom';
import { CREDORES } from '@/lib/credorConfig';
import logoSouzaRibeiro from '@/assets/logo-souza-ribeiro.png';
import { ArrowRight, Lock, Shield } from 'lucide-react';

export default function PortalHome() {
  const credores = Object.values(CREDORES);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004080 100%)' }}>
      {/* Header */}
      <header className="px-4 py-4" style={{ background: 'linear-gradient(135deg, #001a33 0%, #002b55 100%)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="w-10" />
          <img src={logoSouzaRibeiro} alt="Souza e Ribeiro" className="h-14 sm:h-20 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          <Link to="/auth" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Área restrita">
            <Lock className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
        <div className="max-w-3xl w-full text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#fff' }}>
            Portal de Acordos
          </h1>
          <p className="text-base sm:text-lg mb-10" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Selecione a empresa para consultar e negociar seus débitos
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {credores.map((credor) => (
              <Link
                key={credor.slug}
                to={`/${credor.slug}`}
                className="group rounded-2xl p-8 flex flex-col items-center gap-5 transition-all hover:scale-[1.03] hover:shadow-2xl"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {credor.logos.principal ? (
                  <div className="h-16 sm:h-20 w-full flex items-center justify-center">
                    <img src={credor.logos.principal} alt={credor.nome} className="max-h-16 sm:max-h-20 max-w-[200px] w-auto object-contain" />
                  </div>
                ) : (
                  <div
                    className="h-16 sm:h-20 flex items-center justify-center px-6 rounded-xl text-2xl font-black"
                    style={{ background: 'rgba(0,168,107,0.15)', color: '#00a86b' }}
                  >
                    {credor.nome.toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: '#fff' }}>{credor.nome}</h2>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Consultar débitos e negociar</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#00a86b' }}>
                  Acessar portal
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6" style={{ background: '#1a1a2e' }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Negociação segura e sigilosa</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Portal de Acordos é um serviço da SOUZA E RIBEIRO ADVOGADOS
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © {new Date().getFullYear()} Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
