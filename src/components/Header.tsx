import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    // sessionStorage.clear();
    logout();
    navigate("/login");
  };

  // Don't render header on login page
  if (location.pathname === "/login") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md">
      <div className="mx-auto w-full px-4 md:px-4 flex h-12 items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/upload">
            <img
              src="https://www.haulerhero.com/hubfs/Icons/Hauler-Hero-Landscape-Logo-Black.png"
              alt="Hauler-Hero-Landscape-Logo-Black"
              width="100%"
              style={{ maxWidth: "280px", maxHeight: "120px" }}
              className="kl-navbar__logo"
            />
          </a>
          <a href="">
            <img
              src="https://www.theblueflamelabs.com/wp-content/themes/BFL_Custom_Template/images/BlueflameLabslogo1.png"
              alt="Blueflame Labs"
              width="100%"
              style={{ maxWidth: "115px", maxHeight: "120px" }}
              className="kl-navbar__logo"
            />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full bg-black text-white hover:text-white hover:bg-gray-500 !h-10"
                aria-label="Open user menu"
              >
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              sideOffset={10}
              collisionPadding={16}
              className="w-44 max-w-[calc(100vw-1rem)]"
            >
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-primary focus:text-primary 
                focus:bg-primary/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
