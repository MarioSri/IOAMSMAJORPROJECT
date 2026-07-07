// Global type declarations for external APIs
declare global {
  interface Window {
    gapi: {
      load: (apis: string, callback: () => void) => void;
      client: {
        init: (config: any) => Promise<void>;
        calendar: {
          events: {
            insert: (params: any) => Promise<any>;
            update: (params: any) => Promise<any>;
            delete: (params: any) => Promise<any>;
            get: (params: any) => Promise<any>;
            list: (params: any) => Promise<any>;
          };
        };
      };
      auth2: {
        getAuthInstance: () => {
          isSignedIn: {
            get: () => boolean;
          };
          signIn: () => Promise<any>;
          signOut: () => Promise<any>;
        };
      };
    };
  }
}

export {};
