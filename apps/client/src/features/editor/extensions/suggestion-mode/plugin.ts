import { Plugin, PluginKey, Transaction } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { Mark, MarkType } from '@tiptap/pm/model';
import { findHoverTarget } from './utils';

export interface SuggestionPluginState {
  visible: boolean;
  top: number;
  left: number;
  markFrom: number | null;
  markTo: number | null;
  markType: MarkType | null;
  hideTimeoutId: ReturnType<typeof setTimeout> | null;
}

export const suggestionModePluginKey = new PluginKey<SuggestionPluginState>('suggestionModeHover');

const HIDE_DELAY_MS = 100;

export const suggestionModePlugin = new Plugin<SuggestionPluginState>({
  key: suggestionModePluginKey,

  state: {
    init(): SuggestionPluginState {
      return {
        visible: false,
        top: 0,
        left: 0,
        markFrom: null,
        markTo: null,
        markType: null,
        hideTimeoutId: null,
      };
    },
    apply(tr: Transaction, state: SuggestionPluginState): SuggestionPluginState {
      const meta = tr.getMeta(suggestionModePluginKey);
      let nextState = { ...state }; 

      if (meta) {
        if (meta.newState) {
          nextState = { ...nextState, ...meta.newState };
        }

        if (meta.action === 'clearTimeout' && nextState.hideTimeoutId) {
          clearTimeout(nextState.hideTimeoutId);
          nextState = { ...nextState, hideTimeoutId: null };
        }
      }

      if (tr.docChanged && nextState.visible) {
          if (nextState.hideTimeoutId) clearTimeout(nextState.hideTimeoutId);
          nextState = { ...nextState, visible: false, hideTimeoutId: null };
      }

      return nextState; 
    },
  },

  props: {
    handleDOMEvents: {
      mousemove(view: EditorView, event: MouseEvent) {
        const pluginState = suggestionModePluginKey.getState(view.state);
        if (!pluginState) return false;

        const targetElement = event.target as HTMLElement;
        const isMouseOverMenu = targetElement?.closest('[data-suggestion-menu="true"]');
        if (isMouseOverMenu) {
            if (pluginState.hideTimeoutId) {
                view.dispatch(
                    view.state.tr.setMeta(suggestionModePluginKey, { action: 'clearTimeout' })
                );
            }
          return false;
        }

        const target = findHoverTarget(view, event);

        if (target) {
          const { from, to, markType } = target;
          const startCoords = view.coordsAtPos(from);
          const menuTop = startCoords.top - 40 - 5; // Assuming approx 40px height
          const menuLeft = startCoords.left;

          if (pluginState.hideTimeoutId) {
              view.dispatch(
                view.state.tr.setMeta(suggestionModePluginKey, { action: 'clearTimeout' })
              );
          }

          if (!pluginState.visible || pluginState.markFrom !== from || pluginState.markTo !== to) {
            view.dispatch(
              view.state.tr.setMeta(suggestionModePluginKey, {
                newState: {
                  visible: true,
                  top: menuTop,
                  left: menuLeft,
                  markFrom: from,
                  markTo: to,
                  markType: markType,
                  hideTimeoutId: null,
                },
              })
            );
          }
        } else {
          if (pluginState.visible && !pluginState.hideTimeoutId) {
            const timeoutId = setTimeout(() => {
              view.dispatch(
                view.state.tr.setMeta(suggestionModePluginKey, {
                  newState: { visible: false, hideTimeoutId: null },
                })
              );
            }, HIDE_DELAY_MS);

            view.dispatch(
              view.state.tr.setMeta(suggestionModePluginKey, {
                newState: { hideTimeoutId: timeoutId },
              })
            );
          }
        }
        return false; 
      },
      mouseleave(view: EditorView, event: MouseEvent) {
        const pluginState = suggestionModePluginKey.getState(view.state);
        if (!pluginState) return false;

        const relatedTargetElement = event.relatedTarget as HTMLElement;
        const isLeavingToMenu = relatedTargetElement?.closest('[data-suggestion-menu="true"]');
        if (isLeavingToMenu) {
            return false;
        }
        
        if (pluginState.visible && !pluginState.hideTimeoutId) {
            const timeoutId = setTimeout(() => {
              view.dispatch(
                view.state.tr.setMeta(suggestionModePluginKey, {
                  newState: { visible: false, hideTimeoutId: null },
                })
              );
            }, HIDE_DELAY_MS);
            view.dispatch(
              view.state.tr.setMeta(suggestionModePluginKey, {
                newState: { hideTimeoutId: timeoutId },
              })
            );
        }
        return false;
      },
    },
  },
});