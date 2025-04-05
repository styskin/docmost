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

  // FIXME: remove filteredItems
  const items = filteredItems.map((item) => ({
    ...item,
    command: async ({ editor, range }: CommandProps) => {
      const { from, to } = range;
      const text = editor.state.doc.text;
      
      if (!text) return;
      try {


        // const analysis = await this.manulService.callManulAgent(
        //   JSON.stringify(context),
        //   "Please analyze the changes made to this document by comparing the previous and current content. Provide constructive criticism focusing on content quality, structure, and potential improvements. Be concise, use at most 2 sentences."
        // );

        const result = await fetch("/api/manul/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: query, 
            context: text
          })
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
        console.error("Error calling Manul API:", error);
      }
    },
  }));

  return items;
}; 