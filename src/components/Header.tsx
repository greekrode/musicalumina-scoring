import { UserButton } from "@clerk/clerk-react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useOutbox } from "../lib/scoreOutbox";

const ROLE_LABEL = { admin: "Admin", score_staff: "Results · view only", jury: "Jury" } as const;

/** Jury-only: connection and offline-queue state. */
function SyncStatus() {
  const { online, syncing, queued } = useOutbox();
  const pending = Object.keys(queued).length;

  if (syncing && pending) {
    return (
      <span className="pill-wait" role="status">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> Syncing {pending}
      </span>
    );
  }
  if (!online) {
    return (
      <span className="pill-error" role="status" title="Scores are saved on this device and sync automatically">
        <CloudOff className="h-3.5 w-3.5" aria-hidden /> Offline{pending ? ` · ${pending} saved` : ""}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="pill-wait" role="status">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {pending} to sync
      </span>
    );
  }
  return (
    <span className="pill-ok hidden sm:inline-flex" role="status">
      <Wifi className="h-3.5 w-3.5" aria-hidden /> Online
    </span>
  );
}

export default function Header() {
  const { state } = useApp();
  const { user, userRole } = state;

  return (
    <header className="sticky top-0 z-40 border-b border-rule-hairline bg-surface-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo.png" alt="Musica Lumina" className="h-6 w-auto" />
          <span aria-hidden className="h-5 w-px bg-rule-subtle" />
          <span className="type-label truncate text-ink-muted">
            Scoring{userRole ? ` · ${ROLE_LABEL[userRole]}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {userRole === "jury" && <SyncStatus />}
          <span className="hidden text-[0.875rem] text-ink-muted md:inline">{user?.name}</span>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
