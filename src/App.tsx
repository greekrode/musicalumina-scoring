import { SignInButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import AdminDashboard from "./components/admin/AdminDashboard";
import ResultsOverview from "./components/admin/ResultsOverview";
import Header from "./components/Header";
import JuryInterface from "./components/jury/JuryInterface";
import StateCard from "./components/shared/StateCard";
import UnauthorizedModal from "./components/UnauthorizedModal";
import { AppProvider, OfflineAppProvider, useApp } from "./context/AppContext";
import { User } from "./types";
import { useOutbox, useOutboxSync } from "./lib/scoreOutbox";

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

/** Shown when the app opened from the device cache. */
function OfflineBanner() {
  const { online, queued } = useOutbox();
  const pending = Object.keys(queued).length;
  return (
    <div role="status" className="border-b border-rule-hairline bg-status-upcoming-bg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-[0.875rem] text-status-upcoming-fg sm:px-6 lg:px-8">
        <p>
          {online
            ? `Connection is back. Reconnect to sign in${pending ? ` and sync ${pending} saved score${pending > 1 ? "s" : ""}` : ""}.`
            : "Offline mode: showing the last data saved on this device. Scores you enter are kept here until you reconnect."}
        </p>
        {online && (
          <button className="btn-primary btn-sm" onClick={() => window.location.reload()}>
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
}

function OfflineContent({ user }: { user: User }) {
  // The outbox watches connectivity; it cannot send until Clerk is back.
  useOutboxSync(user.id);
  return (
    <div className="min-h-[100dvh] bg-surface-canvas">
      <Header />
      <OfflineBanner />
      <main>
        <JuryInterface />
      </main>
    </div>
  );
}

export function OfflineApp({ user }: { user: User }) {
  return (
    <OfflineAppProvider user={user}>
      <OfflineContent user={user} />
    </OfflineAppProvider>
  );
}
