import { AppShell, Container } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsSidebar from "@/components/settings/settings-sidebar.tsx";
import { useAtom } from "jotai";
import {
  asideStateAtom,
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
  asideWidthAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";
import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import classes from "./app-shell.module.css";
import { useTrialEndAction } from "@/ee/hooks/use-trial-end-action.tsx";
import { useClickOutside, useMergedRef } from "@mantine/hooks";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";

export default function GlobalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useTrialEndAction();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [{ isAsideOpen }] = useAtom(asideStateAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [asideWidth, setAsideWidth] = useAtom(asideWidthAtom);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isAsideResizing, setIsAsideResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const navbarOutsideRef = useClickOutside(() => {
    if (mobileOpened) {
      toggleMobile();
    }
  });

  const mergedRef = useMergedRef(sidebarRef, navbarOutsideRef);

  const startSidebarResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsSidebarResizing(true);
  }, []);

  const stopSidebarResizing = React.useCallback(() => {
    setIsSidebarResizing(false);
  }, []);

  const resizeSidebar = React.useCallback(
    (mouseMoveEvent) => {
      if (isSidebarResizing && sidebarRef.current) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < 220) {
          setSidebarWidth(220);
          return;
        }
        if (newWidth > 600) {
          setSidebarWidth(600);
          return;
        }
        setSidebarWidth(newWidth);
      }
    },
    [isSidebarResizing, setSidebarWidth],
  );

  const startAsideResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsAsideResizing(true);
  }, []);

  const stopAsideResizing = React.useCallback(() => {
    setIsAsideResizing(false);
  }, []);

  const resizeAside = React.useCallback(
    (mouseMoveEvent) => {
      if (isAsideResizing && asideRef.current) {
        const newWidth =
          window.innerWidth - mouseMoveEvent.clientX;
        const minWidth = 250;
        const maxWidth = 600;

        if (newWidth < minWidth) {
          setAsideWidth(minWidth);
          return;
        }
        if (newWidth > maxWidth) {
          setAsideWidth(maxWidth);
          return;
        }
        setAsideWidth(newWidth);
      }
    },
    [isAsideResizing, setAsideWidth],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      resizeSidebar(event);
      resizeAside(event);
    };

    const handleMouseUp = () => {
      stopSidebarResizing();
      stopAsideResizing();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeSidebar, stopSidebarResizing, resizeAside, stopAsideResizing]);

  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const isHomeRoute = location.pathname.startsWith("/home");
  const isPageRoute = location.pathname.includes("/p/");

  return (
    <AppShell
      header={{ height: 45 }}
      navbar={
        !isHomeRoute && {
          width: isSpaceRoute ? sidebarWidth : 300,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: !desktopOpened,
          },
        }
      }
      aside={
        isPageRoute && {
          width: asideWidth,
          breakpoint: "sm",
          collapsed: { mobile: !isAsideOpen, desktop: !isAsideOpen },
        }
      }
      padding="md"
    >
      <AppShell.Header px="md" className={classes.header}>
        <AppHeader />
      </AppShell.Header>
      {!isHomeRoute && (
        <AppShell.Navbar
          className={classes.navbar}
          withBorder={false}
          ref={sidebarRef}
        >
          {desktopOpened && isSpaceRoute && (
             <div className={classes.resizeHandle} onMouseDown={startSidebarResizing} />
          )}
          {isSpaceRoute && <SpaceSidebar />}
          {isSettingsRoute && <SettingsSidebar />}
        </AppShell.Navbar>
      )}
      <AppShell.Main>
        {isSettingsRoute ? (
          <Container size={850}>{children}</Container>
        ) : (
          children
        )}
      </AppShell.Main>

      {isPageRoute && (
        <AppShell.Aside
          className={classes.aside}
          p={0}
          withBorder={false}
          ref={asideRef}
        >
          {isAsideOpen && (
            <div className={classes.asideResizeHandle} onMouseDown={startAsideResizing} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'var(--mantine-spacing-md)' }}>
             <Aside />
          </div>
        </AppShell.Aside>
      )}
    </AppShell>
  );
}
