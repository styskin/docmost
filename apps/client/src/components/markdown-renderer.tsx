import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Box, Text, List, Title } from "@mantine/core";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        // Override heading components
        h1: ({ children }) => (
          <Title order={1} my="sm">
            {children}
          </Title>
        ),
        h2: ({ children }) => (
          <Title order={2} my="sm">
            {children}
          </Title>
        ),
        h3: ({ children }) => (
          <Title order={3} my="sm">
            {children}
          </Title>
        ),
        h4: ({ children }) => (
          <Title order={4} my="sm">
            {children}
          </Title>
        ),
        h5: ({ children }) => (
          <Title order={5} my="sm">
            {children}
          </Title>
        ),
        h6: ({ children }) => (
          <Title order={6} my="sm">
            {children}
          </Title>
        ),

        // Override paragraph
        p: ({ children }) => (
          <Text my="xs" style={{ fontSize: "15px", lineHeight: 1.2 }}>
            {children}
          </Text>
        ),

        // Override lists
        ul: ({ children }) => (
          <List
            type="unordered"
            my="xs"
            style={{ fontSize: "15px", lineHeight: 1.2 }}
          >
            {children}
          </List>
        ),
        ol: ({ children }) => (
          <List
            type="unordered"
            my="xs"
            style={{ fontSize: "15px", lineHeight: 1.2 }}
          >
            {children}
          </List>
        ),
        li: ({ children }) => (
          <List.Item style={{ fontSize: "15px", lineHeight: 1.2 }}>
            {children}
          </List.Item>
        ),

        // Override code blocks with syntax highlighting
        code: (props) => {
          const { className, children } = props;
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";

          // Simplify inline code detection - if no language specified and content is short, treat as inline
          const content = String(children).replace(/\n$/, "");
          const isInline =
            !className && content.length < 50 && !content.includes("\n");

          if (isInline) {
            return (
              <Text
                style={{ fontSize: "15px", lineHeight: 1.2 }}
                component="code"
                c="blue"
                bg="gray.0"
                px={5}
              >
                {children}
              </Text>
            );
          }

          return (
            <Box my="md">
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
              >
                {content}
              </SyntaxHighlighter>
            </Box>
          );
        },

        // Override blockquote
        blockquote: ({ children }) => (
          <Box
            my="sm"
            pl="md"
            style={{
              borderLeft: "3px solid var(--mantine-color-gray-4)",
              color: "var(--mantine-color-dimmed)",
            }}
          >
            {children}
          </Box>
        ),

        // Override links
        a: ({ children, href }) => (
          <Text
            component="a"
            href={href}
            c="blue"
            style={{ textDecoration: "underline" }}
          >
            {children}
          </Text>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
