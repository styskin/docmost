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
import classes from "./claude.module.css";

export default function ClaudeView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor } = props;
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");

  const handleSubmit = async () => {
    console.debug("Sending query to Claude 11");

    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      console.debug("Sending query to Claude:", query);

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      console.log("Response from Claude:", data.data.response);
//      setResponse(data);
      
      // Insert Claude's response into the editor after the current node
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
      console.error("Error querying Claude:", error);
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
              Claude Assistant
            </Text>
          </Group>

          <Textarea
            placeholder={t("Ask Claude anything...")}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
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

          {response && (
            <Paper p="sm" withBorder bg="var(--mantine-color-gray-0)">
              <Text size="sm">{response}</Text>
            </Paper>
          )}
        </Stack>
      </Paper>
    </NodeViewWrapper>
  );
} 