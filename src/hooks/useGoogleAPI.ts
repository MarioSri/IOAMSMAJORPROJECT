import { useEffect, useState } from 'react';

interface GoogleApiStatus {
  isLoaded: boolean;
  isSignedIn: boolean;
  error: string | null;
}

export function useGoogleAPI() {
  const [status, setStatus] = useState<GoogleApiStatus>({
    isLoaded: false,
    isSignedIn: false,
    error: null
  });

  useEffect(() => {
    async function loadGoogleAPI() {
      try {
        if (typeof window.gapi !== 'undefined') {
          setStatus(prev => ({ ...prev, isLoaded: true }));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;

        script.onload = () => {
          window.gapi.load('auth2:client', async () => {
            try {
              await window.gapi.client.init({
                apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
                clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                scope: 'https://www.googleapis.com/auth/calendar'
              });

              const authInstance = window.gapi.auth2.getAuthInstance();
              const isSignedIn = authInstance.isSignedIn.get();

              setStatus({ isLoaded: true, isSignedIn, error: null });
            } catch (error) {
              setStatus({ isLoaded: true, isSignedIn: false, error: 'Failed to initialize Google API' });
            }
          });
        };

        script.onerror = () => {
          setStatus({ isLoaded: false, isSignedIn: false, error: 'Failed to load Google API script' });
        };

        document.head.appendChild(script);
      } catch (error) {
        setStatus({ isLoaded: false, isSignedIn: false, error: 'Error loading Google API' });
      }
    }

    loadGoogleAPI();
  }, []);

  async function signIn() {
    if (!status.isLoaded) return false;
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signIn();
      setStatus(prev => ({ ...prev, isSignedIn: true }));
      return true;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      return false;
    }
  }

  async function signOut() {
    if (!status.isLoaded) return;
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setStatus(prev => ({ ...prev, isSignedIn: false }));
    } catch (error) {
      console.error('Google sign-out failed:', error);
    }
  }

  return {
    ...status,
    signIn,
    signOut
  };
}
