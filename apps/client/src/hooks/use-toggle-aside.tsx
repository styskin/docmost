import {
  asideStateAtom,
  aiChatOpenStateAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useAtom } from "jotai";

const useToggleAside = () => {
  const [asideState, setAsideState] = useAtom(asideStateAtom);
  const [aiChatOpen, setAiChatOpen] = useAtom(aiChatOpenStateAtom);

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
  };
  return toggleAside;
};

export default useToggleAside;
