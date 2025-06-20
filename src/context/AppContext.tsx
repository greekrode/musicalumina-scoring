import React, { createContext, useContext, useReducer, useEffect } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
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

  useEffect(() => {
    const checkUserAccess = async () => {
      if (!isLoaded) {
        dispatch({ type: "SET_LOADING", payload: true });
        return;
      }

      if (!isSignedIn || !clerkUser) {
        dispatch({ type: "SET_USER", payload: { user: null, role: null } });
        return;
      }

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
      } else {
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
        } else {
          // Not authorized - show modal first, then logout
          dispatch({ type: "SET_USER", payload: { user: null, role: null } });
          
          // Dispatch custom event to show unauthorized modal
          window.dispatchEvent(new Event("unauthorized-access"));
          
          // Wait a bit before signing out to ensure modal is shown
          setTimeout(async () => {
            await signOut();
          }, 1000);
        }
      }
    };

    checkUserAccess();
  }, [clerkUser, isLoaded, isSignedIn, orgRole, signOut]);

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
