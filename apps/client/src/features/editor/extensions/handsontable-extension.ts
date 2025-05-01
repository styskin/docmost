import { Handsontable as BaseHandsontable } from "@docmost/editor-ext";
import HandsontableView from "../components/handsontable/handsontable-view.tsx";

export const Handsontable = BaseHandsontable.configure({
  view: HandsontableView,
});
