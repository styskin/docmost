import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Group, Badge, Menu, ActionIcon, Button } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import {
  DocumentType,
  DOCUMENT_TYPE_NAMES,
} from "@/features/page/types/page.types.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { IconChevronDown, IconFileText } from "@tabler/icons-react";

interface Props {
  readOnly?: boolean;
}
export default function PageHeader({ readOnly }: Props) {
  const { pageSlug } = useParams();
  const {
    data: page,
    isLoading: isPageLoading,
    error: pageError,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const updatePageMutation = useUpdatePageMutation();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const handleTypeChange = (value: string | null) => {
    if (!page || !value) {
      return;
    }
    const newType = value as DocumentType;
    updatePageMutation.mutate({ pageId: page.id, type: newType });
  };

  const getBadgeColor = (type: DocumentType | undefined) => {
    if (!type) return "gray";
    switch (type) {
      case DocumentType.STANDARD:
        return "blue";
      case DocumentType.LLM_INSTRUCTION:
        return "grape";
      case DocumentType.LLM_SCHEDULED_TASK:
        return "teal";
      default:
        return "gray";
    }
  };

  const currentType = page?.type || DocumentType.STANDARD;
  const currentTypeName = DOCUMENT_TYPE_NAMES[currentType];
  const currentBadgeColor = getBadgeColor(currentType);

  const ReadOnlyDisplay = () => {
    if (isMobile) {
      return (
        <ActionIcon
          variant="light"
          color={currentBadgeColor}
          size="lg"
          style={{ height: "30px", width: "30px" }}
        >
          <IconFileText size={18} />
        </ActionIcon>
      );
    }
    return (
      <Button
        variant="light"
        color={currentBadgeColor}
        size="compact-lg"
        styles={{
          root: {
            cursor: "default",
            paddingLeft: "var(--mantine-spacing-xs)",
            paddingRight: "var(--mantine-spacing-xs)",
          },
          label: { fontSize: "var(--mantine-font-size-sm)" },
        }}
      >
        {currentTypeName}
      </Button>
    );
  };

  return (
    <div className={classes.header}>
      <Group justify="space-between" h="100%" px="md" wrap="nowrap">
        <Breadcrumb />
        <Group wrap="nowrap">
          {readOnly ? (
            <ReadOnlyDisplay />
          ) : (
            <Menu
              shadow="md"
              width={220}
              disabled={updatePageMutation.isPending || isPageLoading}
            >
              <Menu.Target>
                {isMobile ? (
                  <ActionIcon
                    variant="light"
                    color={currentBadgeColor}
                    size="lg"
                    style={{ height: "30px", width: "30px" }}
                  >
                    <IconFileText size={18} />
                  </ActionIcon>
                ) : (
                  <Button
                    variant="light"
                    color={currentBadgeColor}
                    size="compact-lg"
                    rightSection={<IconChevronDown size={16} />}
                    styles={{
                      root: {
                        paddingLeft: "var(--mantine-spacing-xs)",
                        paddingRight: "var(--mantine-spacing-xs)",
                      },
                      section: {
                        marginLeft: "calc(var(--mantine-spacing-xs) / 2)",
                      },
                      label: { fontSize: "var(--mantine-font-size-sm)" },
                    }}
                  >
                    {currentTypeName}
                  </Button>
                )}
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Select Document Type</Menu.Label>
                {Object.values(DocumentType).map((docType) => (
                  <Menu.Item
                    key={docType}
                    onClick={() => handleTypeChange(docType)}
                    disabled={docType === currentType}
                  >
                    <Badge
                      color={getBadgeColor(docType)}
                      fullWidth
                      variant="light"
                    >
                      {DOCUMENT_TYPE_NAMES[docType]}
                    </Badge>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
          <PageHeaderMenu readOnly={readOnly} />
        </Group>
      </Group>
    </div>
  );
}
