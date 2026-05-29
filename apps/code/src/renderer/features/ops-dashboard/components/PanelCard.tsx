import { Box, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface PanelCardProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PanelCard({
  title,
  subtitle,
  badge,
  children,
  className,
}: PanelCardProps) {
  return (
    <Flex
      direction="column"
      className={`h-full min-h-0 overflow-hidden rounded-lg border border-[--gray-a4] bg-[--color-background] ${className ?? ""}`}
    >
      <Flex
        align="center"
        justify="between"
        className="shrink-0 border-b border-[--gray-a4] px-3 py-2"
        gap="2"
      >
        <Flex direction="column" className="min-w-0">
          <Text className="truncate text-[12px] font-semibold">{title}</Text>
          {subtitle && (
            <Text className="truncate text-[11px] text-[--gray-10]">
              {subtitle}
            </Text>
          )}
        </Flex>
        {badge}
      </Flex>
      <Box className="min-h-0 flex-1 overflow-auto p-3">{children}</Box>
    </Flex>
  );
}
