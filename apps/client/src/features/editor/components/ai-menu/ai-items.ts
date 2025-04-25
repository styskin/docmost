import { AIMenuItemType, CommandProps } from "./types";

const AI_PROMPTS = [
  {
    id: "summarize",
    title: "Summarize",
    description: "Summarize the selected text",
    prompt: "Please summarize the following text concisely:\n\n",
  },
  {
    id: "improve",
    title: "Improve writing",
    description: "Improve the writing style and clarity",
    prompt:
      "Please improve the writing style and clarity of the following text:\n\n",
  },
  {
    id: "explain",
    title: "Explain",
    description: "Explain the selected text in simple terms",
    prompt: "Please explain the following text in simple terms:\n\n",
  },
  {
    id: "translate",
    title: "Translate",
    description: "Translate the text to English",
    prompt: "Please translate the following text to English:\n\n",
  },
];

export const getAIItems = async ({
  query,
  editor,
}: {
  query: string;
  editor: any;
}): Promise<AIMenuItemType[]> => {
  const filteredItems = AI_PROMPTS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()),
  );
  const items = filteredItems.map((item) => ({
    ...item
  }));
  return items;
};
