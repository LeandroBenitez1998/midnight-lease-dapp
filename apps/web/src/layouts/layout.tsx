import { Link, useRouterState } from '@tanstack/react-router';
import { ReactNode } from 'react';
import { ModeToggle } from '@/components/mode-toggle';
import { FileText, Home, Wallet } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/lease', label: 'Lease', icon: FileText },
  { to: '/wallet-ui', label: 'Wallet', icon: Wallet },
] as const;

export const MainLayout = ({ children }: MainLayoutProps) => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  if (currentPath.startsWith('/lease')) {
    return <div className="min-h-screen bg-white text-black">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
          <Link to="/" className="text-sm font-semibold tracking-[0.28em] text-foreground hover:opacity-80 transition-opacity">
            MIDNIGHT LEASE
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border/60 py-6">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Built on Midnight Network
          </p>
          <p className="text-xs text-muted-foreground">
            Midnight Lease DApp
          </p>
        </div>
      </footer>
    </div>
  );
};
