import {
  asideStateAtom,
  aiChatOpenStateAtom,
  mobileAsideAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useAtom } from "jotai";
import { useMediaQuery } from "@mantine/hooks";

const useToggleAside = () => {
  const [asideState, setAsideState] = useAtom(asideStateAtom);
  const [aiChatOpen, setAiChatOpen] = useAtom(aiChatOpenStateAtom);
  const [mobileAsideOpen, setMobileAsideOpen] = useAtom(mobileAsideAtom);
  const isMobile = useMediaQuery("(max-width: 48em)");

  const toggleAside = (toogledTab: string) => {
    let newIsOpen = true;
    if (asideState.tab === toogledTab) {
      newIsOpen = !asideState.isAsideOpen;
    }
    if (toogledTab === "ai") {
      newIsOpen = !aiChatOpen;
      setAiChatOpen(newIsOpen);
    } else {
      setAiChatOpen(false);
    }
    setAsideState({ tab: toogledTab, isAsideOpen: newIsOpen });
    
    // On mobile, also set the mobile aside state
    if (isMobile) {
      setMobileAsideOpen(newIsOpen);
    }
  };

  const closeAside = () => {
    setAsideState({ ...asideState, isAsideOpen: false });
    setAiChatOpen(false);
    if (isMobile) {
      setMobileAsideOpen(false);
    }
  };

  return { toggleAside, closeAside };
};

export default useToggleAside;
