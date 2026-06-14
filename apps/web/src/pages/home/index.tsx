import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Shield, FileText, Wallet, BadgeCheck } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();

  const implementations = [
    {
      title: 'Midnight Lease',
      description: 'A standalone private legaltech flow for rental agreements with wallet connection, proof generation, and signed verification.',
      icon: FileText,
      path: '/lease' as const,
      accent: 'from-zinc-500/10 to-zinc-500/5',
      iconColor: 'text-zinc-700',
    },
  ];

  const features = [
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Built on Midnight Network with zero-knowledge proof technology and minimal public state.',
    },
    {
      icon: Wallet,
      title: 'Wallet Connected',
      description: 'The UI hooks into the existing wallet stack and keeps the signature flow explicit.',
    },
    {
      icon: BadgeCheck,
      title: 'Verifiable Signature',
      description: 'The flow is built for proof generation, contract signing, and receipt export.',
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.03]" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Standalone DApp
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Midnight Lease DApp
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              A standalone foundation for privacy-preserving rental contracts on Midnight Network.
            </p>
          </div>
        </div>
      </section>

      {/* Implementation Cards */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
            Lease App
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {implementations.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate({ to: item.path })}
                  className="group text-left bg-card rounded-xl border border-border/60 p-6 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20"
                >
                  <div className={`inline-flex items-center justify-center w-11 h-11 rounded-lg bg-gradient-to-br ${item.accent} mb-4`}>
                    <Icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {item.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                    Open lease flow
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="text-center sm:text-left">
                    <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-muted mb-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
