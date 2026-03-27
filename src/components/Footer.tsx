import { useLocation } from "react-router-dom";

export function Footer() {
  const location = useLocation();

  // Don't render footer on login page
  if (location.pathname === "/login") {
    return null;
  }

  return (
    <footer className="w-full border-t bg-zinc-900">
      <div className="mx-auto w-full px-6 md:px-8 flex flex-col items-center gap-1 py-1">
        <p className="text-xs text-zinc-400 text-center flex items-center justify-between w-full">
          <a href="https://www.theblueflamelabs.com" target="_blank" >
            <img src={"https://www.theblueflamelabs.com/wp-content/themes/BFL_Custom_Template/images/BlueflameLabslogo2.png"} className="h-8 w-auto" />
          </a>
          © {new Date().getFullYear()} Blueflame Labs. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
