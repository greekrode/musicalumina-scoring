import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import StateCard from "../components/shared/StateCard";
import { User } from "../types";

interface AppState {
  user: User | null;
  userRole: "admin" | "jury" | "score_staff" | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type Action =
  | {
      type: "SET_USER";
      payload: { user: User | null; role: "admin" | "jury" | "score_staff" | null };
    }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOGOUT" };

const initialState: AppState = {
  user: null,
  userRole: null,
  isAuthenticated: false,
  isLoading: true,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload.user,
        userRole: action.payload.role,
        isAuthenticated: !!action.payload.user,
        isLoading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        userRole: null,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const signOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkUserAccess = async () => {
      if (!isLoaded) {
        dispatch({ type: "SET_LOADING", payload: true });
        setIsAuthorized(null);
        return;
      }

      if (!isSignedIn || !clerkUser) {
        dispatch({ type: "SET_USER", payload: { user: null, role: null } });
        setIsAuthorized(null);
        return;
      }

      try {
        // Role = Clerk publicMetadata.role (set in the Clerk dashboard; users
        // cannot edit it). RLS checks the same claim. Legacy "org:admin" = admin.
        const role =
          typeof clerkUser.publicMetadata?.role === "string"
            ? clerkUser.publicMetadata.role.replace(/^org:/, "")
            : null;
        const isAdmin = role === "admin";

        if (isAdmin) {
          // Admin user
          const user: User = {
            id: clerkUser.id,
            username:
              clerkUser.username ||
              clerkUser.primaryEmailAddress?.emailAddress ||
              "",
            name: clerkUser.fullName || clerkUser.firstName || "Admin",
            role: "admin",
          };
          dispatch({ type: "SET_USER", payload: { user, role: "admin" } });
          setIsAuthorized(true);
          return;
        }

        // jury enters scores; score_staff only views results (RLS enforces both).
        if (role === "jury" || role === "score_staff") {
          const user: User = {
            id: clerkUser.id,
            username:
              clerkUser.username ||
              clerkUser.primaryEmailAddress?.emailAddress ||
              "",
            name: clerkUser.fullName || clerkUser.firstName || (role === "jury" ? "Jury Member" : "Score Viewer"),
            role,
          };
          dispatch({ type: "SET_USER", payload: { user, role } });
          setIsAuthorized(true);
        } else {
          // Not authorized
          setIsAuthorized(false);
          setAuthError('Access denied: this app needs the admin, jury or score_staff role.');

          // Force logout after showing error message
          signOutTimerRef.current = setTimeout(() => {
            signOut();
          }, 3000);
        }
      } catch (error) {
        console.error('Authorization check error:', error);
        setIsAuthorized(false);
        setAuthError('Error checking authorization. Please try again.');

        signOutTimerRef.current = setTimeout(() => {
          signOut();
        }, 3000);
      }
    };

    checkUserAccess();
  }, [clerkUser, isLoaded, isSignedIn, signOut]);

  // Clear sign-out timer on unmount
  useEffect(() => {
    return () => {
      if (signOutTimerRef.current) {
        clearTimeout(signOutTimerRef.current);
      }
    };
  }, []);

  // Loading state while checking authorization
  if (isLoaded && clerkUser && isAuthorized === null) {
    return (
      <StateCard eyebrow="Checking access" title="One moment…">
        <div className="spinner mx-auto mt-2" aria-label="Loading" />
      </StateCard>
    );
  }

  // Authorization failed state
  if (isLoaded && clerkUser && isAuthorized === false) {
    return (
      <StateCard eyebrow="Access denied" title="Not authorised.">
        <p>{authError}</p>
        <p className="mt-4 text-[0.8125rem] text-ink-subtle">Signing you out in a few seconds…</p>
      </StateCard>
    );
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
