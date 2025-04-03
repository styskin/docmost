import { ReactRenderer, useEditor } from "@tiptap/react";
import AIList from "./ai-list";
import tippy from "tippy.js";

const renderAIItems = () => {
  let component: ReactRenderer | null = null;
  let popup: any | null = null;

  return {
    onBeforeStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {


      component = new ReactRenderer(AIList, {
        props: { 
          isLoading: true, 
          items: [],
          editor: props.editor,
          autoFocus: true
        },
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      });
    },
    onStart: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps({...props, isLoading: false});

      if (!props.clientRect) {
        return;
      }

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onUpdate: (props: {
      editor: ReturnType<typeof useEditor>;
      clientRect: DOMRect;
    }) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup &&
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
    },
    onKeyDown: (props: { event: KeyboardEvent; }) => {
      if (props.event.key === "Escape") {
        popup?.[0].hide();
        component?.destroy()

        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },
    onExit: () => {
      if (popup && !popup[0]?.state.isDestroyed) {
        popup[0]?.destroy();
      }

      if (component) {
        component?.destroy();
      }
    },
  };
};

export default renderAIItems; 