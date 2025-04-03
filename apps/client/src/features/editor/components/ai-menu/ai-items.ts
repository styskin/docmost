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
    prompt: "Please improve the writing style and clarity of the following text:\n\n",
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

async function callClaude(prompt: string, text: string) {
  // TODO: Implement Claude API call
  // This is a placeholder that returns the text unchanged
  return text;
}

export const getAIItems = async ({
  query,
  editor,
}: {
  query: string;
  editor: any;
}): Promise<AIMenuItemType[]> => {
  // Filter items based on query




  const filteredItems = AI_PROMPTS.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  const items = filteredItems.map((item) => ({
    ...item,
    command: async ({ editor, range }: CommandProps) => {
      const { from, to } = range;
      const text = editor.state.doc.textBetween(from, to);

      console.error("Text :", text);

      
      if (!text) return;

      try {
        const result = await fetch("/api/claude", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: item.prompt, context: text }),
        });

        const responseText = await result.text();
        console.error("Response :", responseText);
    
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(responseText)
          .run();
      } catch (error) {
        console.error("Error calling Claude API:", error);
      }
    },
  }));

  return items;
}; 