import { Box, ScrollArea, Text } from "@mantine/core";
import CommentList from "@/features/comment/components/comment-list.tsx";
import { useAtom } from "jotai";
import { effectiveAsideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { AIChat } from "@/features/ai/components/ai-chat.tsx";

export default function Aside() {
  const [{ tab, isAsideOpen }] = useAtom(effectiveAsideStateAtom);
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);

  let title: string;
  let component: ReactNode;

  switch (tab) {
    case "comments":
      component = <CommentList />;
      title = "Comments";
      break;
    case "toc":
      component = <TableOfContents editor={pageEditor} />;
      title = "Table of contents";
      break;
    case "ai":
      component = <AIChat />;
      title = "Chat with AI";
      break;
    default:
      component = null;
      title = null;
  }

  return (
    <Box p={tab === "ai" ? "0" : "md"}>
      {component && (
        <>
          <Text mb="md" fw={500} px={tab === "ai" ? "md" : "0"}>
            {t(title)}
          </Text>

          <ScrollArea
            style={{ height: "85vh" }}
            scrollbarSize={5}
            type="scroll"
          >
            <div style={{ paddingBottom: "200px" }}>{component}</div>
          </ScrollArea>
        </>
      )}
    </Box>
  );
}
