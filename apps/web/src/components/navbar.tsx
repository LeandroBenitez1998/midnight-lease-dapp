import { Link, useRouterState } from '@tanstack/react-router'
import { FileText, Home, Loader2, LogOut, Wallet, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { useWallet } from '@/modules/midnight/wallet-widget/hooks/useWallet'

const navItems = [
  { to: '/', label: 'Home', icon: Home, match: (pathname: string) => pathname === '/' || pathname.startsWith('/home') },
  { to: '/lease', label: 'Lease', icon: FileText, match: (pathname: string) => pathname.startsWith('/lease') },
  { to: '/wallet-ui', label: 'Wallet', icon: WalletCards, match: (pathname: string) => pathname.startsWith('/wallet') },
] as const

function formatShort(value: string | null | undefined, visible = 6): string {
  if (!value) return 'Pendiente'
  if (value.length <= visible * 2 + 3) return value
  return `${value.slice(0, visible)}...${value.slice(-visible)}`
}

export function Navbar() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const isLeaseRoute = pathname.startsWith('/lease')

  const { open, setOpen, connectingWallet, unshieldedAddress, disconnect } = useWallet()
  const walletAddress = unshieldedAddress?.unshieldedAddress ?? null
  const walletConnected = Boolean(walletAddress)

  return (
    <header className="sticky top-0 z-50 h-[76px] w-full border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="relative mx-auto flex h-full w-full max-w-[1180px] items-center justify-between px-6">
        <Link to="/" className="text-sm font-semibold tracking-[0.28em] text-black">
          MIDNIGHT LEASE
        </Link>

        <nav
          aria-label="Main navigation"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-neutral-950 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isLeaseRoute ? (
            <>
              <Badge variant="outline" className="gap-2 border-neutral-300 bg-white px-3 py-1.5 text-[11px] text-black">
                <span className="h-2 w-2 rounded-full bg-black" />
                Midnight Preprod
              </Badge>
              <Button
                type="button"
                onClick={() => setOpen(true)}
                className="bg-black text-white shadow-none hover:bg-black/90"
              >
                {connectingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                {connectingWallet ? '' : walletConnected ? formatShort(walletAddress, 6) : 'Conectar wallet'}
              </Button>
              {walletConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={disconnect}
                  aria-label="Desconectar wallet"
                  className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              ) : null}
            </>
          ) : null}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
