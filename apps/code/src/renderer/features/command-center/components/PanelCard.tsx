import { Card, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface PanelCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PanelCard({ title, subtitle, children }: PanelCardProps) {
  return (
    <Card className="h-full border border-(--gray-a4)">
      <Flex direction="column" gap="3" height="100%">
        <Flex direction="column" gap="1">
          <Text className="font-medium text-(--gray-12) text-sm">{title}</Text>
          {subtitle ? (
            <Text className="text-(--gray-10) text-xs">{subtitle}</Text>
          ) : null}
        </Flex>
        <div className="min-h-0 flex-1">{children}</div>
      </Flex>
    </Card>
  );
}
