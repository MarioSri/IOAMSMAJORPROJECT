// Google API TypeScript Declarations

interface Window {
  gapi: {
    load: (api: string, callback: () => void) => void;
    client: {
      init: (config: {
        apiKey: string;
        clientId?: string;
        discoveryDocs: string[];
        scope?: string;
      }) => Promise<void>;
      drive: any;
    };
    auth2: {
      getAuthInstance: () => {
        isSignedIn: {
          get: () => boolean;
        };
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
      };
    };
  };
  google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: any) => void;
        }) => {
          callback: (response: any) => void;
          requestAccessToken: (options?: { prompt?: string }) => void;
        };
      };
    };
  };
}
