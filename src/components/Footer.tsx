import { useLocation } from "react-router-dom";

export function Footer() {
  const location = useLocation();

  // Don't render footer on login page
  if (location.pathname === "/login") {
    return null;
  }

  return (
    <footer className="w-full border-t bg-zinc-900">
      <div className="mx-auto w-full px-6 md:px-8 flex flex-col items-center gap-1 py-3">
        {/* <div className="flex items-center gap-6 text-xs text-zinc-400">
          <a href="#" className="hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Support
          </a>
        </div> */}
        <p className="text-xs text-zinc-400 text-center">
          © {new Date().getFullYear()} Hauler Hero. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
