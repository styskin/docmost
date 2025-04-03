import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Avatar,
  Group,
  Paper,
  Text,
  Textarea,
  Button,
  Stack,
} from "@mantine/core";
import { IconBrain, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import classes from "./manul.module.css";

export default function ManulView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor } = props;
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/manul/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response');
      }

      const data = await response.json();
      
      // Insert the response into the editor after the current node
      const pos = props.getPos() + props.node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(pos, [
          { 
            type: 'paragraph', 
            content: [{ type: 'text', text: data.data.response }]
          },
        ])
        .run();

    } catch (error) {
      console.error("Error querying Manul:", error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <NodeViewWrapper className={classes.wrapper}>
      <Paper shadow="sm" p="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <Avatar color="blue" radius="xl">
              <IconBrain size={24} />
            </Avatar>
            <Text size="sm" fw={500}>
              AI Assistant
            </Text>
          </Group>

          <Textarea
            placeholder={t("Ask anything...")}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
            error={error}
          />

          <Group justify="flex-end">
            <Button
              onClick={handleSubmit}
              loading={isLoading}
              leftSection={<IconSend size={16} />}
              disabled={!query.trim()}
            >
              {t("Send")}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </NodeViewWrapper>
  );
} 