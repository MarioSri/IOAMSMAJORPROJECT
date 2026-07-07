import { useEffect, useState } from "react";
import { AuthenticationCard } from "@/components/auth/AuthenticationCard";
import { HITAMTreeLoading } from "@/components/ui/loading-animation";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const { user, isAuthenticated, isLoading, justLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const doNavigate = () => {
        const redirectPath = localStorage.getItem('iaoms-redirect-path');
        if (redirectPath) {
          localStorage.removeItem('iaoms-redirect-path');
          navigate(redirectPath, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      };

      if (justLoggedIn) {
        setShowAnimation(true);
        const timer = setTimeout(() => {
          doNavigate();
        }, 5500); // Wait for transition animation to complete smoothly
        return () => clearTimeout(timer);
      } else {
        doNavigate();
      }
    }
  }, [isAuthenticated, user, navigate, justLoggedIn]);

  if (showAnimation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <HITAMTreeLoading size="lg" />
      </div>
    );
  }

  // Removed generic spinner so the authentication screen loads immediately per requirements.

  return <AuthenticationCard />;
}