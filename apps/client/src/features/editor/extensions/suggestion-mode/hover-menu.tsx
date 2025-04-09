import React, { forwardRef } from "react";
import { Editor } from "@tiptap/react";
import { suggestionModePluginKey, SuggestionPluginState } from "./plugin";

// Define the props the menu will receive
interface SuggestionHoverMenuProps {
  editor: Editor;
  menuState: SuggestionPluginState;
}

const menuStyle: React.CSSProperties = {
  position: "fixed",
  backgroundColor: "white",
  border: "1px solid #ccc",
  borderRadius: "4px",
  padding: "4px 8px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  zIndex: 99999,
  display: "flex",
  gap: "4px",
  visibility: "hidden",
};

const buttonStyle: React.CSSProperties = {
  padding: "2px 6px",
  cursor: "pointer",
  borderRadius: "3px",
  border: "none",
  color: "white",
};

const acceptButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#4CAF50", // Green
};

const rejectButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#f44336", // Red
};

// Fix type signature for forwardRef
export const SuggestionHoverMenu = ({
  editor,
  menuState,
}: SuggestionHoverMenuProps) => {
  const handleAccept = () => {
    if (!menuState.markFrom || !menuState.markTo || !menuState.markType) return;
    const markType = menuState.markType.name;
    let tr = editor.state.tr;
    tr = tr.setMeta("suggestionOperation", { type: "accept" });
    if (markType === "suggestionInsert") {
      tr = tr.removeMark(
        menuState.markFrom,
        menuState.markTo,
        menuState.markType,
      );
    } else {
      tr = tr
        .removeMark(menuState.markFrom, menuState.markTo, menuState.markType)
        .delete(menuState.markFrom, menuState.markTo);
    }
    editor.view.dispatch(tr);
    // No need to manually hide; plugin handles it on mouseleave
  };

  const handleReject = () => {
    if (!menuState.markFrom || !menuState.markTo || !menuState.markType) return;
    const markType = menuState.markType.name;
    let tr = editor.state.tr;
    tr = tr.setMeta("suggestionOperation", { type: "reject" });
    if (markType === "suggestionInsert") {
      tr = tr
        .removeMark(menuState.markFrom, menuState.markTo, menuState.markType)
        .delete(menuState.markFrom, menuState.markTo);
    } else {
      tr = tr.removeMark(
        menuState.markFrom,
        menuState.markTo,
        menuState.markType,
      );
    }
    editor.view.dispatch(tr);
    // No need to manually hide
  };

  // Calculate style based on plugin state
  const finalStyle: React.CSSProperties = {
    ...menuStyle,
    left: `${menuState.left}px`,
    top: `${menuState.top}px`,
    visibility: menuState.visible ? "visible" : "hidden",
  };

  if (!menuState.visible) {
    return null;
  }

  const handleMouseEnter = () => {
    editor.view.dispatch(
      editor.state.tr.setMeta(suggestionModePluginKey, {
        action: "clearTimeout",
      }),
    );
  };

  const handleMouseLeave = () => {};

  return (
    <div
      style={finalStyle}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-suggestion-menu="true" // Add data attribute
    >
      <button style={acceptButtonStyle} onClick={handleAccept}>
        Accept
      </button>
      <button style={rejectButtonStyle} onClick={handleReject}>
        Reject
      </button>
    </div>
  );
};
