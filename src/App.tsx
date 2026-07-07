import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ErrorBoundary } from "@/utils/errorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import TrackDocuments from "@/pages/TrackDocuments";
import Calendar from "@/pages/Calendar";
import Messages from "@/pages/Messages";
import Approvals from "@/pages/Approvals";
import ApprovalRouting from "@/pages/ApprovalRouting";
import Analytics from "@/pages/Analytics";
import Emergency from "@/pages/Emergency";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes — only stale queries re-fetch on focus
      gcTime: 10 * 60 * 1000,    // 10 minutes — keep cache longer
      // Never retry auth/JWT errors — avoids redirect loops after session expiry.
      // All other failures get one retry (matching previous behaviour).
      retry: (failureCount, error: unknown) => {
        const msg = (error as { message?: string })?.message ?? '';
        const code = (error as { code?: string })?.code ?? '';
        if (
          msg.includes('JWT') ||
          msg.includes('session') ||
          code === 'PGRST301'
        ) {
          return false;
        }
        return failureCount < 1;
      },
      // Re-fetch stale data when the user returns to the tab — works in concert
      // with the AuthContext visibilitychange listener that refreshes the session
      // first, so queries always have a valid token when they fire.
      refetchOnWindowFocus: true,
      // Re-fetch stale data when the network comes back online.
      refetchOnReconnect: true,
    },
  },
});

// Clean up localStorage on app start to prevent quota issues
function cleanupLocalStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    const totalSize = keys.reduce(
      (sum, key) => sum + (localStorage.getItem(key)?.length ?? 0) + key.length,
      0
    );

    const MAX_SIZE = 3 * 1024 * 1024; // 3 MB — leaves ~2 MB headroom
    if (totalSize <= MAX_SIZE) return;

    console.log('Cleaning up localStorage...');

    // Remove legacy keys
    localStorage.removeItem('approval-history-new');

    // Remove known static cache keys (lowest priority first)
    const staticCacheKeys = [
      'search-cache',
      'analytics_metrics_cache',
      'department_stats_cache',
      'monthly_trends_cache',
      'recent-documents-cache',
      'documents-cache',
      'track-documents-cache',
      'bypass-cache',
      'emergency-cache',
    ];
    staticCacheKeys.forEach(key => localStorage.removeItem(key));

    // Remove dynamic cache keys (chat messages, channels, live meeting)
    const dynamicPrefixes = [
      'live_meeting_requests_cache_',
      'chat_messages_cache_',
      'chat_channels_cache_',
      'temp-',
      'cache-',
      'preview-',
    ];
    keys
      .filter(key => dynamicPrefixes.some(prefix => key.startsWith(prefix)))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('LocalStorage cleanup error:', error);
  }
}

cleanupLocalStorage();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <NotificationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                    <TutorialProvider>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/dashboard" element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        } />
                        <Route path="/documents" element={
                          <ProtectedRoute>
                            <Documents />
                          </ProtectedRoute>
                        } />
                        <Route path="/track-documents" element={
                          <ProtectedRoute>
                            <TrackDocuments />
                          </ProtectedRoute>
                        } />
                        <Route path="/calendar" element={
                          <ProtectedRoute>
                            <Calendar />
                          </ProtectedRoute>
                        } />
                        <Route path="/messages" element={
                          <ProtectedRoute>
                            <Messages />
                          </ProtectedRoute>
                        } />
                        <Route path="/approvals" element={
                          <ProtectedRoute requiredPermissions={['canApprove']}>
                            <Approvals />
                          </ProtectedRoute>
                        } />
                        <Route path="/approval-routing" element={
                          <ProtectedRoute requiredPermissions={['canManageWorkflows']}>
                            <ApprovalRouting />
                          </ProtectedRoute>
                        } />
                        <Route path="/analytics" element={
                          <ProtectedRoute requiredPermissions={['canViewAnalytics']}>
                            <Analytics />
                          </ProtectedRoute>
                        } />

                        <Route path="/emergency" element={
                          <ProtectedRoute>
                            <Emergency />
                          </ProtectedRoute>
                        } />
                        <Route path="/profile" element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        } />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </TutorialProvider>
                  </BrowserRouter>
                </TooltipProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
