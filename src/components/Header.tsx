import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut } from 'lucide-react';

export function Header() {

  
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    // sessionStorage.clear();
    logout();
    navigate('/login');
  };

  // Don't render header on login page
  if (location.pathname === '/login') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md">
      <div className="mx-auto w-full px-4 md:px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/upload">
            <img src="https://www.haulerhero.com/hubfs/Icons/Hauler-Hero-Landscape-Logo-Black.png" alt="Hauler-Hero-Landscape-Logo-Black"
              width="100%" style={{ maxWidth: '280px', maxHeight: '140px' }}
              className="kl-navbar__logo" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          {/* <ThemeToggle /> */}
          <Button
            variant="default"
            onClick={handleLogout}
            className="font-semibold"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
