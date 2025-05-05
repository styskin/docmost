import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet } from "react-router-dom";
import GlobalAppShell from "@/components/layouts/global/global-app-shell.tsx";
import { useTrackPageView } from "@/hooks/use-track-page-view";

export default function Layout() {
  // Track page views when the location changes
  useTrackPageView();
  return (
    <UserProvider>
      <GlobalAppShell>
        <Outlet />
      </GlobalAppShell>
    </UserProvider>
  );
}
