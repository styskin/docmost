import { Outlet } from "react-router-dom";
import ShareShell from "@/features/share/components/share-shell.tsx";
import { useTrackPageView } from "@/hooks/use-track-page-view";

export default function ShareLayout() {
  // Track shared page views
  useTrackPageView();
  return (
    <ShareShell>
      <Outlet />
    </ShareShell>
  );
}
