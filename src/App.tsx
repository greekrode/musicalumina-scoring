import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import AdminDashboard from "./components/admin/AdminDashboard";
import Header from "./components/Header";
import JuryInterface from "./components/jury/JuryInterface";
import UnauthorizedModal from "./components/UnauthorizedModal";
import { AppProvider, useApp } from "./context/AppContext";

function LoginHeader() {
  return (
    <header className="bg-white shadow-sm border-b border-piano-gold/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Musicalumina"
            className="h-12 w-auto mr-4"
          />
          <div className="text-center">
            <h1 className="text-3xl font-bold text-piano-wine">
              Musica Lumina Scoring System
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}

function AppContent() {
  const { state } = useApp();
  const { user, userRole, isLoading } = state;
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);

  // Listen for unauthorized access from AppContext
  useEffect(() => {
    const handleUnauthorized = () => {
      setShowUnauthorizedModal(true);
    };

    window.addEventListener("unauthorized-access", handleUnauthorized);
    return () =>
      window.removeEventListener("unauthorized-access", handleUnauthorized);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-piano-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-piano-cream">
      <SignedOut>
        <LoginHeader />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <SignIn />
        </div>
      </SignedOut>

      <SignedIn>
        {user && (
          <>
            <Header />
            <main className="container mx-auto px-4 py-8">
              {userRole === "admin" ? <AdminDashboard /> : <JuryInterface />}
            </main>
          </>
        )}
      </SignedIn>

      <UnauthorizedModal
        isOpen={showUnauthorizedModal}
        onClose={() => setShowUnauthorizedModal(false)}
      />
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
