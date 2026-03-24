import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await api.login({ email, password });
      login(user);
      const sessionId = sessionStorage.getItem('session_id');
      if (sessionId) {
        try {
          const status = await api.getSessionStatus(sessionId);
          const stage = (status.stage ?? '').toLowerCase();
          if (stage === 'none') {
            navigate('/upload');
            return;
          }
          if (stage === 'uploaded' || stage === 'joined') {
            navigate('/field-mapping');
            return;
          }
          if (stage === 'mapped' || stage === 'cleaning') {
            navigate(`/data-cleaning?session_id=${encodeURIComponent(sessionId)}`);
            return;
          }
        } catch {
          // session not found or status unavailable — fall through to upload
        }
      }
      navigate('/upload');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
        {/* Left hero panel */}
        <section className="relative hidden lg:block">
          <img
            src="/images/login-hero.png"
            alt="Hauler Hero"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />

          <div className="absolute bottom-10 left-10 right-10 text-white">
            <Quote className="mb-4 h-8 w-8 scale-x-[-1] fill-white stroke-0" />
            <p className="max-w-3xl text-md font-light">
              Hauler Hero has made our lives more efficient and significantly less complicated. Since switching to Hauler Hero,
              my time to send our monthly or quarterly bills has been cut in half.
            </p>
            <div className="mt-4">
              <p className="text-2xl font-semibold">Alex Babbitt</p>
              <p className="text-white/90">Co-Owner - Carolina Trash & Septic

              </p>
            </div>

            {/* <div className="flex justify-end gap-3">
              <button
                type="button"
                aria-label="Previous"
                className="rounded-full border border-white/50 p-2 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next"
                className="rounded-full border border-white/50 p-2 text-white hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div> */}
          </div>
        </section>

        {/* Right login panel (restored card + previous font styling) */}
        <section className="relative flex items-center justify-center p-6 md:p-12 bg-background">

          <div className="w-full max-w-md">
            <CardHeader className="space-y-3 pb-6 border-none">
              <div className="flex justify-center">
                <img src="/images/logo.png" alt="Hauler Hero" className="h-12 w-auto" />
              </div>
              <CardTitle className="h4 text-center text-foreground font-bold">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground text-center">
                Please Login to Your Account
              </CardDescription>
            </CardHeader>

            <CardContent className='flex justify-center'>
              <form onSubmit={handleSubmit} className="space-y-5 flex-1 max-w-[350px] border-2 rounded-md p-4">
                <div className="space-y-2 ">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 transition-all duration-200 focus:ring-2 focus:ring-ring mt-0 rounded-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-ring rounded-none"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Remember me
                  </label>
                  <a href="#" className="text-primary hover:underline">Forgot password?</a>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 font-semibold hover:scale-x-[1.02]" disabled={loading}>
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
    </div>
  );
}