import { Outlet } from '@tanstack/react-router';
import { Navbar } from '@/components/navbar';

export const MainLayout = () => {
  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 py-6">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="text-xs text-neutral-500">
            Built on Midnight Network
          </p>
          <p className="text-xs text-neutral-500">
            Midnight Lease DApp
          </p>
        </div>
      </footer>
    </div>
  );
};
