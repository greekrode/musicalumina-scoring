import { SignInButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import AdminDashboard from "./components/admin/AdminDashboard";
import ResultsOverview from "./components/admin/ResultsOverview";
import Header from "./components/Header";
import JuryInterface from "./components/jury/JuryInterface";
import StateCard from "./components/shared/StateCard";
import UnauthorizedModal from "./components/UnauthorizedModal";
import { AppProvider, useApp } from "./context/AppContext";
import { useOutboxSync } from "./lib/scoreOutbox";

function AppContent() {
  const { state } = useApp();
  const { user, userRole, isLoading } = state;
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);

  // Only jury submit scores, so only they get an offline outbox.
  useOutboxSync(userRole === "jury" ? user?.id : null);

  useEffect(() => {
    const handleUnauthorized = () => setShowUnauthorizedModal(true);
    window.addEventListener("unauthorized-access", handleUnauthorized);
    return () => window.removeEventListener("unauthorized-access", handleUnauthorized);
  }, []);

  if (isLoading) {
    return (
      <StateCard eyebrow="Scoring" title="Opening the scoresheet…">
        <div className="spinner mx-auto mt-2" aria-label="Loading" />
      </StateCard>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-canvas">
      <SignedOut>
        <StateCard eyebrow="Jury & staff access" title="Welcome back.">
          <p>Sign in with your Musica Lumina account to score performances or review results.</p>
          <SignInButton mode="modal">
            <button className="btn-primary mt-8 w-full">Sign in</button>
          </SignInButton>
        </StateCard>
      </SignedOut>

      <SignedIn>
        {user && (
          <>
            <Header />
            <main>
              {userRole === "admin" ? (
                <AdminDashboard />
              ) : userRole === "score_staff" ? (
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
                  <ResultsOverview readOnly />
                </div>
              ) : (
                <JuryInterface />
              )}
            </main>
          </>
        )}
      </SignedIn>

      <UnauthorizedModal isOpen={showUnauthorizedModal} onClose={() => setShowUnauthorizedModal(false)} />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
