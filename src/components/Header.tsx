import { UserButton } from "@clerk/clerk-react";
import { useApp } from "../context/AppContext";

export default function Header() {
  const { state } = useApp();
  const { user, userRole } = state;

  return (
    <header className="bg-white shadow-sm border-b border-piano-gold/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src="/logo.png" alt="Musicalumina" className="h-10 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-piano-wine">
                Musica Lumina Scoring System
              </h1>
              <p className="text-sm text-gray-600">
                {userRole === "admin"
                  ? "Admin Dashboard"
                  : "Jury Scoring Interface"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-piano-wine">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500">
                {userRole === "admin" ? "Administrator" : "Jury Member"}
              </p>
            </div>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                  userButtonPopoverCard: "shadow-lg",
                  userButtonPopoverActionButton: "hover:bg-piano-cream",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
