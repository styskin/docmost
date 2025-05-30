import "@/features/editor/styles/index.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onAuthenticationFailedParameters,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { EditorContent, EditorProvider, useEditor } from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import LinkMenu from "@/features/editor/components/link/link-menu.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu";
import DrawioMenu from "./components/drawio/drawio-menu";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { SuggestionHoverMenu } from "./extensions/suggestion-mode/hover-menu";
import {
  suggestionModePluginKey,
  SuggestionPluginState,
} from "./extensions/suggestion-mode/plugin";
import { jwtDecode } from "jwt-decode";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
}

export default function PageEditor({
  pageId,
  editable,
  content,
}: PageEditorProps) {
  const collaborationURL = useCollaborationUrl();
  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [, setYjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [socket] = useAtom(socketAtom);

  const [isLocalSynced, setLocalSynced] = useState(false);
  const [isRemoteSynced, setRemoteSynced] = useState(false);
  const [isCollabReady, setIsCollabReady] = useState(false);

  const menuContainerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);

  const documentName = `page.${pageId}`;
  const ydoc = useMemo(() => new Y.Doc(), [pageId]);
  const localProvider = useMemo(() => {
    const provider = new IndexeddbPersistence(documentName, ydoc);

    provider.on("synced", () => {
      setLocalSynced(true);
    });

    return provider;
  }, [pageId, ydoc]);

  const updateCachedContent = useDebouncedCallback((newContent: any) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        content: newContent,
        updatedAt: new Date(),
      });
    }
  }, 300);

  const remoteProvider = useMemo(() => {
    const provider = new HocuspocusProvider({
      name: documentName,
      url: collaborationURL,
      document: ydoc,
      token: collabQuery?.token,
      connect: false,
      preserveConnection: false,
      onAuthenticationFailed: (auth: onAuthenticationFailedParameters) => {
        const payload = jwtDecode(collabQuery?.token);
        const now = Date.now().valueOf() / 1000;
        const isTokenExpired = now >= payload.exp;
        if (isTokenExpired) {
          refetchCollabToken();
        }
      },
      onStatus: (status) => {
        if (status.status === "connected") {
          setYjsConnectionStatus(status.status);
        }
      },
    });

    provider.on("synced", () => {
      setRemoteSynced(true);
      if (editor) {
        const editorJson = editor.getJSON();
        updateCachedContent(editorJson);
      }
    });

    provider.on("disconnect", () => {
      setYjsConnectionStatus(WebSocketStatus.Disconnected);
    });

    provider.on("update", () => {
      if (editor) {
        const editorJson = editor.getJSON();
        updateCachedContent(editorJson);
      }
    });

    return provider;
  }, [ydoc, pageId, collabQuery?.token]);

  useLayoutEffect(() => {
    remoteProvider.connect();
    return () => {
      setRemoteSynced(false);
      setLocalSynced(false);
      remoteProvider.destroy();
      localProvider.destroy();
    };
  }, [remoteProvider, localProvider]);

  const extensions = useMemo(() => {
    return [
      ...mainExtensions,
      ...collabExtensions(remoteProvider, currentUser?.user),
    ];
  }, [ydoc, pageId, remoteProvider, currentUser?.user]);

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: true,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (view, event, slice) =>
          handlePaste(view, event, pageId, currentUser?.user.id),
        handleDrop: (view, event, _slice, moved) =>
          handleFileDrop(view, event, moved, pageId),
      },
      onCreate({ editor }) {
        if (editor) {
          // @ts-ignore
          setEditor(editor);
          editor.storage.pageId = pageId;
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        updateCachedContent(editorJson);
      },
    },
    [pageId, editable, remoteProvider?.status],
  );

  useEffect(() => {
    if (!socket) return;

    // Force a sync when a content update is received via WebSocket
    const handleWebSocketMessage = (data) => {
      if (
        data.operation === "updateOne" &&
        data.entity?.includes("pages") &&
        (data.id === pageId || data.payload?.id === pageId)
      ) {
        if (
          remoteProvider &&
          remoteProvider.status !== WebSocketStatus.Connected
        ) {
          remoteProvider.connect();
        } else if (remoteProvider.status === WebSocketStatus.Connected) {
          shouldReconnectRef.current = true;
          remoteProvider.disconnect();
        }
      }
    };

    socket.on("message", handleWebSocketMessage);

    return () => {
      socket.off("message", handleWebSocketMessage);
    };
  }, [socket, pageId, remoteProvider]);

  useEffect(() => {
    if (
      shouldReconnectRef.current &&
      remoteProvider?.status === WebSocketStatus.Disconnected
    ) {
      shouldReconnectRef.current = false;
      remoteProvider.connect();
    }
  }, [remoteProvider?.status]);

  const handleActiveCommentEvent = (event) => {
    const { commentId } = event.detail;
    setActiveCommentId(commentId);
    setAsideState({ tab: "comments", isAsideOpen: true });

    //wait if aside is closed
    setTimeout(() => {
      const selector = `div[data-comment-id="${commentId}"]`;
      const commentElement = document.querySelector(selector);
      commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  };

  useEffect(() => {
    document.addEventListener("ACTIVE_COMMENT_EVENT", handleActiveCommentEvent);
    return () => {
      document.removeEventListener(
        "ACTIVE_COMMENT_EVENT",
        handleActiveCommentEvent,
      );
    };
  }, []);

  useEffect(() => {
    setActiveCommentId(null);
    setShowCommentPopup(false);
    setAsideState({ tab: "", isAsideOpen: false });
  }, [pageId]);

  useEffect(() => {
    if (remoteProvider?.status === WebSocketStatus.Connecting) {
      const timeout = setTimeout(() => {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [remoteProvider?.status]);

  useEffect(() => {
    if (
      isIdle &&
      documentState === "hidden" &&
      remoteProvider?.status === WebSocketStatus.Connected
    ) {
      remoteProvider.disconnect();
      setIsCollabReady(false);
      return;
    }

    if (
      documentState === "visible" &&
      remoteProvider?.status === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      remoteProvider.connect();
      setTimeout(() => {
        setIsCollabReady(true);
      }, 600);
    }
  }, [isIdle, documentState, remoteProvider]);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    const collabReadyTimeout = setTimeout(() => {
      if (
        !isCollabReady &&
        isSynced &&
        remoteProvider?.status === WebSocketStatus.Connected
      ) {
        setIsCollabReady(true);
      }
    }, 500);
    return () => clearTimeout(collabReadyTimeout);
  }, [isRemoteSynced, isLocalSynced, remoteProvider?.status]);

  // Read the plugin state
  const [suggestionPluginState, setSuggestionPluginState] =
    useState<SuggestionPluginState | null>(null);

  useEffect(() => {
    if (!editor) return;
    // Function to update local state when plugin state changes
    const updateState = () => {
      const currentState = suggestionModePluginKey.getState(editor.state);
      setSuggestionPluginState(currentState);
    };
    // Initial update
    updateState();
    // Subscribe to editor changes
    editor.on("transaction", updateState);
    return () => {
      editor.off("transaction", updateState);
    };
  }, [editor]);

  // Load effect - force a sync when collaboration is ready
  useEffect(() => {
    if (isCollabReady && remoteProvider?.status === WebSocketStatus.Connected) {
      // Force a sync by sending a small update
      remoteProvider.awareness.setLocalStateField("presence", {
        synced: true,
        user: currentUser?.user,
      });
    }
  }, [isCollabReady, remoteProvider?.status]);

  return isCollabReady ? (
    <div>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />
        {editor && suggestionPluginState && (
          <SuggestionHoverMenu
            editor={editor}
            menuState={suggestionPluginState}
          />
        )}

        {editor && editor.isEditable && (
          <div>
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableCellMenu editor={editor} appendTo={menuContainerRef} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <ExcalidrawMenu editor={editor} />
            <DrawioMenu editor={editor} />
            <LinkMenu editor={editor} appendTo={menuContainerRef} />
          </div>
        )}

        {showCommentPopup && <CommentDialog editor={editor} pageId={pageId} />}
      </div>

      <div
        onClick={() => editor.commands.focus("end")}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  ) : (
    <EditorProvider
      editable={false}
      immediatelyRender={true}
      extensions={mainExtensions}
      content={content}
    ></EditorProvider>
  );
}
