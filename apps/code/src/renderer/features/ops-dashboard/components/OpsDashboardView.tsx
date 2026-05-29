import { Box, Grid } from "@radix-ui/themes";
import { DatadogPanel } from "./DatadogPanel";
import { LinearPanel } from "./LinearPanel";
import { N8nPanel } from "./N8nPanel";
import { PostHogPanel } from "./PostHogPanel";

export function OpsDashboardView() {
  return (
    <Box className="h-full min-h-0 p-3">
      <Grid
        columns="2"
        rows="2"
        className="h-full min-h-0 gap-3"
        style={{ gridTemplateRows: "1fr 1fr" }}
      >
        <DatadogPanel />
        <PostHogPanel />
        <LinearPanel />
        <N8nPanel />
      </Grid>
    </Box>
  );
}
