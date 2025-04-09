import { ActionIcon } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useResolveCommentMutation } from "@/features/comment/queries/comment-query";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";

interface ResolveCommentProps {
  commentId: string;
  pageId: string;
  resolvedAt: Date | null;
}

function ResolveComment({
  commentId,
  pageId,
  resolvedAt,
}: ResolveCommentProps) {
  const { t } = useTranslation();
  const resolveCommentMutation = useResolveCommentMutation();
  const editor = useAtomValue(pageEditorAtom);

  const openConfirmModal = () => {
    modals.openConfirmModal({
      title: t("Are you sure you want to resolve this comment thread?"),
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: handleResolve,
    });
  };

  const handleResolve = async () => {
    try {
      await resolveCommentMutation.mutateAsync({
        commentId,
        pageId,
        resolved: true,
      });
      try {
        if (editor && editor.commands) {
          editor.commands.unsetComment(commentId);
        }
      } catch (editorError) {
        console.error("Failed to unset comment in editor:", editorError);
        // Don't rethrow - the comment is still resolved on the server
      }

      console.log("Successfully resolved comment");
    } catch (error) {
      console.error("Failed to resolve comment:", error);
    }
  };

  return (
    <ActionIcon
      onClick={openConfirmModal}
      variant="default"
      style={{ border: "none" }}
      title={t("Resolve comment")}
    >
      <IconCircleCheck size={20} stroke={2} color="gray" />
    </ActionIcon>
  );
}

export default ResolveComment;
