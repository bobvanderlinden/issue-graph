import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";

const GitHubAuthContext = createContext({});

export function GitHubAuthProvider({ githubAuthClient, children }) {
  const [{ isLoading, user, error }, setValue] = useState({
    isLoading: true,
  });

  useEffect(() => {
    githubAuthClient
      .authenticate()
      .catch((error) => {
        setValue({
          isLoading: false,
          error,
        });
      })
      .then((result) => {
        setValue({
          isLoading: false,
          user: result,
        });
      });
  }, [githubAuthClient]);

  function login() {
    setValue({
      isLoading: true,
    });
    githubAuthClient.login();
  }

  function logout() {
    setValue({
      isLoading: false,
    });
    githubAuthClient.logout();
  }

  const value = {
    isLoading,
    error,
    user,
    login,
    logout,
  };

  const memoedValue = useMemo(() => value, [isLoading, error, user]);

  return (
    <GitHubAuthContext.Provider value={memoedValue}>
      {children}
    </GitHubAuthContext.Provider>
  );
}

export function useGitHubAuth() {
  return useContext(GitHubAuthContext);
}
