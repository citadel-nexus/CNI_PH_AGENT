import { ChartBar } from "@phosphor-icons/react";
import { SidebarItem } from "../SidebarItem";

interface OpsDashboardItemProps {
  isActive: boolean;
  onClick: () => void;
}

export function OpsDashboardItem({ isActive, onClick }: OpsDashboardItemProps) {
  return (
    <SidebarItem
      depth={0}
      icon={<ChartBar size={16} weight={isActive ? "fill" : "regular"} />}
      label="Ops Dashboard"
      isActive={isActive}
      onClick={onClick}
    />
  );
}
