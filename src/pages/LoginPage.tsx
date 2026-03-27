import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Eye,
  EyeOff,
  Quote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await api.login({ email, password });
      login(user);
      const sessionId = sessionStorage.getItem("session_id");
      if (sessionId) {
        try {
          const status = await api.getSessionStatus(sessionId);
          const stage = (status.stage ?? "").toLowerCase();
          if (stage === "none") {
            navigate("/upload");
            return;
          }
          if (stage === "uploaded" || stage === "joined") {
            navigate("/field-mapping");
            return;
          }
          if (stage === "mapped" || stage === "cleaning") {
            navigate(
              `/data-cleaning?session_id=${encodeURIComponent(sessionId)}`,
            );
            return;
          }
        } catch {
          // session not found or status unavailable — fall through to upload
        }
      }
      navigate("/upload");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Fullscreen Background Image */}
      <img
        src="/images/login-hero.png"
        alt="Hauler Hero Background"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Centered White Card (Low Opacity) */}
      <section className="relative z-10 w-full max-w-sm bg-background/90 rounded-lg shadow-xl p-2 px-2 border-white border">
        <div className="w-full">
          <CardHeader className="space-y-3 pb-3 border-none">
            <div className="flex justify-center">
              <img
                src="/images/logo.png"
                alt="Hauler Hero"
                className="h-[44px] w-auto mt-1"
              />
            </div>
            {/* <CardTitle className="h4 text-center text-foreground font-bold">
                Welcome Back
              </CardTitle> */}
            <CardDescription className="text-muted-foreground text-center">
              <div className="text-lg font-semibold">Welcome Back</div>
              <div>Please sign in to access your account</div>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex justify-center">
            <form
              onSubmit={handleSubmit}
              className="space-y-2 flex-1 max-w-[350px]  rounded-md p-4"
            >
              <div className="space-y-1 ">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-9 transition-all duration-200 rounded-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-9 pr-10 transition-all duration-200 rounded-sm"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm space-y-1">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Remember me
                </label>
                {/* <a href="#" className="text-primary hover:underline">Forgot password?</a> */}
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full !h-9 font-semibold hover:scale-x-[1.02]"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>

              {/* <p className="text-sm text-muted-foreground text-center pt-2">
                  Didn&apos;t have an account?{' '}
                  <a href="#" className="font-medium text-foreground hover:underline">
                    Sign up
                  </a>
                </p> */}
            </form>
          </CardContent>
        </div>
      </section>
    </div>
  );
}
