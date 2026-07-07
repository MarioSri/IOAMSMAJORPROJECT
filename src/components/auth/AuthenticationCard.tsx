import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  LogIn,
  IdCard,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { HITAMTreeLoading, LoadingSpinner } from "@/components/ui/loading-animation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  signInWithGoogle,
  signInWithEmployeeId,
  ALLOWED_DOMAIN,
} from "@/services/AuthService";

type LoginMethod = "google" | "employee-id";

export function AuthenticationCard() {
  const { loginWithResult } = useAuth();
  const { toast } = useToast();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>("google");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");

  const employeeIdRef = useRef<HTMLInputElement>(null);

  const carouselImages = ["/carousel-1.jpg", "/carousel-3.png", "/carousel-4.webp"];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  useEffect(() => {
    if (loginMethod === "employee-id") {
      setTimeout(() => employeeIdRef.current?.focus(), 100);
    }
  }, [loginMethod]);

  function clearError() {
    setErrorMessage("");
  }

  async function handleGoogleLogin() {
    clearError();
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // Redirect happens automatically — no further action needed here.
      // AuthContext.onAuthStateChange will handle the session on return.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setErrorMessage(msg);
      toast({
        title: "Google Sign-In Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmployeeLogin(e: React.FormEvent) {
    e.preventDefault();
    clearError();

    if (!employeeId.trim()) {
      setErrorMessage("Please enter your HITAM Employee ID.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithEmployeeId(employeeId.trim(), password);
      if (!result.success) {
        setErrorMessage(result.error ?? "Authentication failed.");
        toast({
          title: "Login Failed",
          description: result.error ?? "Invalid credentials.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      loginWithResult(result);

      toast({
        title: `Welcome, ${result.name}!`,
        description: `Logged in as ${result.role?.replace("-", " ")} · ${result.department}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      toast({
        title: "Login Error",
        description: msg,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-4xl shadow-elegant overflow-hidden">
        <div className="flex">
          <div className="hidden lg:block flex-1 relative bg-gray-100">
            {carouselImages.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100" : "opacity-0"
                  }`}
              >
                <img
                  src={image}
                  alt={`HITAM Campus ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentSlide
                    ? "bg-white scale-110"
                    : "bg-white/50 hover:bg-white/75"
                    }`}
                />
              ))}
            </div>
          </div>

          <div className="w-full max-w-md flex flex-col">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
                <Building2 className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">IAOMS Login</CardTitle>
                <CardDescription>
                  Hyderabad Institute of Technology and Management
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 flex-1">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  id="tab-google"
                  onClick={() => { setLoginMethod("google"); clearError(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${loginMethod === "google"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google (@{ALLOWED_DOMAIN})
                </button>
                <button
                  type="button"
                  id="tab-employee-id"
                  onClick={() => { setLoginMethod("employee-id"); clearError(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${loginMethod === "employee-id"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <IdCard className="w-4 h-4" />
                  Employee ID
                </button>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {loginMethod === "google" && (
                <div className="space-y-4">
                  <Button
                    id="btn-google-signin"
                    type="button"
                    variant="gradient"
                    className="w-full gap-2"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Continue with Google
                  </Button>
                </div>
              )}

              {loginMethod === "employee-id" && (
                <form onSubmit={handleEmployeeLogin} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="employee-id-input">HITAM Employee ID</Label>
                    <Input
                      id="employee-id-input"
                      ref={employeeIdRef}
                      type="text"
                      placeholder="Enter Your HITAM ID"
                      value={employeeId}
                      onChange={(e) => { setEmployeeId(e.target.value); clearError(); }}
                      autoComplete="username"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password-input">Password</Label>
                    <div className="relative">
                      <Input
                        id="password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearError(); }}
                        autoComplete="current-password"
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    id="btn-employee-signin"
                    type="submit"
                    variant="gradient"
                    className="w-full gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Sign In
                  </Button>
                </form>
              )}

              <div className="text-center text-xs text-muted-foreground pt-1">
                <p>Institutional Activity Oversight and Management System</p>
                <p className="mt-0.5">© 2026 HITAM. All rights reserved.</p>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}