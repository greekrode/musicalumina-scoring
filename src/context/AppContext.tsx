import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { Shield, AlertTriangle } from "lucide-react";
import { User, Category, Participant, Score } from "../types";

interface AppState {
  user: User | null;
  userRole: "admin" | "jury" | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  categories: Category[];
  participants: Participant[];
  scores: Score[];
}

type Action =
  | {
      type: "SET_USER";
      payload: { user: User | null; role: "admin" | "jury" | null };
    }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOGOUT" }
  | { type: "SET_CATEGORIES"; payload: Category[] }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "UPDATE_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "SET_PARTICIPANTS"; payload: Participant[] }
  | { type: "ADD_PARTICIPANT"; payload: Participant }
  | { type: "UPDATE_PARTICIPANT"; payload: Participant }
  | { type: "DELETE_PARTICIPANT"; payload: string }
  | { type: "ADD_SCORE"; payload: Score }
  | { type: "UPDATE_SCORE"; payload: Score };

const initialState: AppState = {
  user: null,
  userRole: null,
  isAuthenticated: false,
  isLoading: true,
  categories: [],
  participants: [],
  scores: [],
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
    case "SET_CATEGORIES":
      return { ...state, categories: action.payload };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.payload] };
    case "UPDATE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.id === action.payload.id ? action.payload : cat
        ),
      };
    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((cat) => cat.id !== action.payload),
      };
    case "SET_PARTICIPANTS":
      return { ...state, participants: action.payload };
    case "ADD_PARTICIPANT":
      return {
        ...state,
        participants: [...state.participants, action.payload],
      };
    case "UPDATE_PARTICIPANT":
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case "DELETE_PARTICIPANT":
      return {
        ...state,
        participants: state.participants.filter((p) => p.id !== action.payload),
      };
    case "ADD_SCORE":
      return { ...state, scores: [...state.scores, action.payload] };
    case "UPDATE_SCORE":
      return {
        ...state,
        scores: state.scores.map((score) =>
          score.id === action.payload.id ? action.payload : score
        ),
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
  const { orgRole } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>('');

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
        // Check if user has admin role in the organization
        const isAdmin = orgRole === "org:admin";

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

        // Check if user has "jury" in email or username
        const email =
          clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
        const username = clerkUser.username?.toLowerCase() || "";
        const fullName = clerkUser.fullName?.toLowerCase() || "";

        const hasJuryAccess =
          email.includes("jury") ||
          username.includes("jury") ||
          fullName.includes("jury");

        if (hasJuryAccess) {
          // Valid jury user
          const user: User = {
            id: clerkUser.id,
            username:
              clerkUser.username ||
              clerkUser.primaryEmailAddress?.emailAddress ||
              "",
            name: clerkUser.fullName || clerkUser.firstName || "Jury Member",
            role: "jury",
          };
          dispatch({ type: "SET_USER", payload: { user, role: "jury" } });
          setIsAuthorized(true);
        } else {
          // Not authorized
          setIsAuthorized(false);
          setAuthError('Access denied: You must be an admin or jury member to use this application.');
          
          // Force logout after showing error message
          setTimeout(() => {
            signOut();
          }, 3000);
        }
      } catch (error) {
        console.error('Authorization check error:', error);
        setIsAuthorized(false);
        setAuthError('Error checking authorization. Please try again.');
        
        setTimeout(() => {
          signOut();
        }, 3000);
      }
    };

    checkUserAccess();
  }, [clerkUser, isLoaded, isSignedIn, orgRole, signOut]);

  // Loading state while checking authorization
  if (isLoaded && clerkUser && isAuthorized === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-musica-cream via-amber-50 to-musica-cream flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-lg rounded-2xl p-8 border border-musica-burgundy/10 shadow-xl max-w-md w-full">
          <div className="w-16 h-16 bg-musica-gold rounded-xl flex items-center justify-center shadow-lg mx-auto mb-6 animate-pulse">
            <Shield className="w-8 h-8 text-musica-burgundy" />
          </div>
          <h2 className="text-2xl font-bold text-musica-burgundy mb-4">
            Checking Authorization...
          </h2>
          <p className="text-musica-burgundy/70">
            Please wait while we verify your access permissions.
          </p>
        </div>
      </div>
    );
  }

  // Authorization failed state
  if (isLoaded && clerkUser && isAuthorized === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-25 to-red-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-lg rounded-2xl p-8 border border-red-200 shadow-xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center shadow-lg mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-red-700 mb-4">
            Access Denied
          </h2>
          <p className="text-red-600 mb-6">
            {authError}
          </p>
          <p className="text-red-500 text-sm">
            You will be signed out automatically in a few seconds...
          </p>
        </div>
      </div>
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
