import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from "jotai";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

export const desktopAsideAtom = atom<boolean>(false);
export const mobileAsideAtom = atom<boolean>(false);

type AsideStateType = {
  tab: string; // "toc" | "comments" | "ai" | "";
  isAsideOpen: boolean;
};

export const asideStateAtom = atomWithWebStorage<AsideStateType>(
  "aside_state",
  {
    tab: "",
    isAsideOpen: false,
  },
);

export const aiChatOpenStateAtom = atomWithWebStorage<boolean>(
  "ai_chat_open_state",
  false,
);

export const effectiveAsideStateAtom = atom((get) => {
  const asideState = get(asideStateAtom);
  const aiChatOpen = get(aiChatOpenStateAtom);
  const mobileAsideOpen = get(mobileAsideAtom);

  if (aiChatOpen) {
    return { tab: "ai", isAsideOpen: true, isMobileAsideOpen: mobileAsideOpen };
  }
  return { ...asideState, isMobileAsideOpen: mobileAsideOpen };
});

export const sidebarWidthAtom = atomWithWebStorage<number>("sidebarWidth", 300);
export const asideWidthAtom = atomWithWebStorage<number>("asideWidth", 350);
