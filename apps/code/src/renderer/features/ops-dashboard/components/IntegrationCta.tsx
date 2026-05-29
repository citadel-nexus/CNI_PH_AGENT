import { Badge, Button, Flex, Text } from "@radix-ui/themes";

interface IntegrationCtaProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function IntegrationCta({
  message,
  actionLabel,
  onAction,
}: IntegrationCtaProps) {
  return (
    <Flex
      direction="column"
      gap="2"
      className="rounded-md border border-[--gray-a4] bg-[--gray-a2] p-3"
    >
      <Badge color="gray" variant="soft" size="1" className="w-fit">
        Setup required
      </Badge>
      <Text className="text-[12px] text-[--gray-10]">{message}</Text>
      {actionLabel && onAction ? (
        <Button
          variant="soft"
          color="gray"
          size="1"
          onClick={onAction}
          className="w-fit"
        >
          {actionLabel}
        </Button>
      ) : null}
    </Flex>
  );
}
