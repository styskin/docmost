import classes from "./switch-space.module.css";
import { useNavigate } from "react-router-dom";
import { SpaceSelect } from "./space-select";
import { getSpaceUrl } from "@/lib/config";
import { Avatar, Button, Popover, Text, Group } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";

interface SwitchSpaceProps {
  spaceName: string;
  spaceSlug: string;
  onSpaceChange?: () => void;
}

export function SwitchSpace({ spaceName, spaceSlug, onSpaceChange }: SwitchSpaceProps) {
  const navigate = useNavigate();
  const [opened, { close, open, toggle }] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 48em)");

  const handleSelect = (value: string) => {
    if (value) {
      navigate(getSpaceUrl(value));
      close();
      onSpaceChange?.();
    }
  };

  return (
    <Popover
      width={isMobile ? "90vw" : 300}
      position="bottom"
      withArrow
      shadow="md"
      opened={opened}
      onChange={toggle}
      withinPortal={false}
      styles={{
        dropdown: {
          zIndex: 1002,
        },
      }}
    >
      <Popover.Target>
        <Button
          variant="subtle"
          fullWidth
          color="gray"
          onClick={open}
          styles={{
            root: {
              height: isMobile ? "48px" : "auto",
            },
            inner: {
              justifyContent: "space-between",
              width: "100%",
            },
            label: {
              display: "flex",
              alignItems: "center",
              gap: "var(--mantine-spacing-sm)",
              flex: 1,
              width: "100%",
              justifyContent: "flex-start",
            },
            section: {
              marginLeft: "auto",
            },
          }}
          rightSection={<IconChevronDown size={18} />}
        >
          <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
            <Avatar
              size={20}
              color="initials"
              variant="filled"
              name={spaceName}
            />
            <Text className={classes.spaceName} size="md" fw={500} lineClamp={1}>
              {spaceName}
            </Text>
          </Group>
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <SpaceSelect
          label={spaceName}
          value={spaceSlug}
          onChange={(space) => handleSelect(space.slug)}
          width={isMobile ? window.innerWidth * 0.9 : 300}
          opened={true}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
