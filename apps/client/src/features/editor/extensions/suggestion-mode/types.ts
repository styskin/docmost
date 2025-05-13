// Define the structure for suggestions received from the backend
export interface ISuggestion {
  textToReplace: string;
  textReplacement: string;
  reason: string;
  textBefore: string;
  textAfter: string;
}
