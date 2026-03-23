import { useLocation } from 'react-router-dom';

export function Footer() {
  const location = useLocation();

  // Don't render footer on login page
  if (location.pathname === '/login') {
    return null;
  }

  return (
    <footer className="w-full border-t bg-background">
      <div className="mx-auto w-full px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <p className="text-sm font-semibold text-foreground">
            Hauler Hero
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Hauler Hero. All rights reserved.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
