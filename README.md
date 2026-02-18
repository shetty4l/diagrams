# @shetty4l/diagrams

Declarative animated architecture diagrams for [Remotion](https://remotion.dev).

Define diagrams as pure data — nodes, connections, containers, and a timeline — and the engine handles grid layout, arrow routing, and animation. Each diagram is a config object, not a component tree.

## Install

```bash
bun add @shetty4l/diagrams
```

Peer dependencies (must be installed separately):

```bash
bun add react react-dom remotion
```

This package publishes **source-only** (`.ts/.tsx`). Your project compiles it alongside your own code — no pre-built bundles.

## Quick Start

```tsx
import { DiagramEngine, ThemeProvider, defaultLight } from "@shetty4l/diagrams";
import type { DiagramConfig } from "@shetty4l/diagrams/types";

const config: DiagramConfig = {
  grid: { rows: 1, cols: 3 },
  nodes: [
    { id: "client", label: "Client", icon: "user", position: { row: 0, col: 0 } },
    { id: "api", label: "API Server", icon: "server", position: { row: 0, col: 1 } },
    { id: "db", label: "Database", icon: "database", position: { row: 0, col: 2 } },
  ],
  connections: [
    { from: "client", to: "api", label: "REST" },
    { from: "api", to: "db", label: "SQL" },
  ],
  timeline: [
    { type: "hold", duration: 1 },
    {
      type: "sequence",
      steps: [
        { action: "fillBox", target: "client", step: { num: 1, text: "User sends request" } },
        { action: "drawLine", target: "client->api" },
        { action: "fillBox", target: "api", step: { num: 2, text: "API processes" } },
        { action: "drawLine", target: "api->db" },
        { action: "fillBox", target: "db", step: { num: 3, text: "Query database" } },
      ],
    },
    { type: "reveal", duration: 1 },
    { type: "hold", duration: 2 },
  ],
  header: { title: "Request Flow", subtitle: "Client → API → Database" },
};

// In your Remotion composition:
export const MyDiagram = () => (
  <ThemeProvider theme={defaultLight}>
    <DiagramEngine config={config} />
  </ThemeProvider>
);
```

Register as a Remotion composition with the correct duration:

```tsx
import { Composition } from "remotion";
import { calculateTotalDuration } from "@shetty4l/diagrams";

const FPS = 30;

export const Root = () => (
  <Composition
    id="MyDiagram"
    component={MyDiagram}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={calculateTotalDuration(config.timeline, FPS)}
  />
);
```

## Concepts

### Grid

Diagrams use a row/col grid. The `grid` config sets the dimensions. Nodes are placed at `{ row, col }` positions. The engine computes pixel coordinates from the grid, canvas size, and header/footer fractions.

### Nodes

Each node has an `id`, `label`, `icon`, and grid `position`. Nodes can span multiple columns/rows (`widthCols`, `heightRows`), live inside containers (`container` + `innerCol`), or align to another node's inner column (`alignToInnerCol`).

### Connections

Connections link nodes (or container edges) by ID. Edge directions are auto-inferred from relative positions, or can be overridden with `fromEdge`/`toEdge`. Complex routes use `waypoints`. Connection IDs default to `"from->to"` if not specified.

### Containers

Containers are dashed/solid border groups that span a range of grid cells. They have their own inner grid for positioning contained nodes. Useful for grouping related services (e.g., a pipeline, a cluster).

### Timeline

The timeline drives animation as a sequence of phases:

| Phase | Description |
|-------|-------------|
| `hold` | Pause at current state for a duration |
| `dim` | Fade the entire diagram to transparent |
| `sequence` | Play animation steps one after another |
| `reveal` | Fade the diagram back to full opacity |

Steps within a sequence: `fillBox` (highlight a node), `drawLine` (animate an arrow), `showContainer` (reveal a container), `dimBox` (dim a node), `hold` (pause), `parallel` (play steps simultaneously).

Each step can carry a `step` label (shown in the step indicator) and a `group` (grouped elements fade out together).

### Static Rendering

For still images, set `durationInFrames: 1` and `fps: 1` in the Remotion composition. The timeline engine detects this and returns `null`, rendering everything at full opacity with no animation.

## Theme

Wrap your diagram with `ThemeProvider` to control colors, fonts, spacing, and radii.

### Presets

```tsx
import { defaultLight, presentationLight } from "@shetty4l/diagrams/theme";
```

- **`defaultLight`** — Warm orange accent, navy text, light gray surfaces
- **`presentationLight`** — Neutral tones, blue accent, softer contrast

### Custom Theme

```tsx
import type { Theme } from "@shetty4l/diagrams/theme";

const myTheme: Theme = {
  name: "my-theme",
  colors: { /* ... */ },
  fonts: { sans: "Inter", mono: "JetBrains Mono" },
  spacing: { page: 48, section: 32, element: 16, tight: 8 },
  radii: { sm: 4, md: 8, lg: 12, full: 9999 },
  animation: { /* ... */ },
};
```

Consumers are responsible for registering fonts. The theme only references font family names.

## Icons

18 built-in SVG icons, referenced by name in node definitions:

`user` `server` `database` `workflow` `shieldCheck` `upload` `key` `bell` `cloud` `layers` `image` `paintbrush` `clipboard` `catalog` `fileOutput` `atom` `gear` `package`

## Exports

| Subpath | Entry | Contents |
|---------|-------|----------|
| `.` | `./src/index.ts` | Everything (barrel export) |
| `./types` | `./src/types.ts` | All type definitions + `getConnectionId` |
| `./engine` | `./src/engine/DiagramEngine.tsx` | Main orchestrator component |
| `./components` | `./src/components/index.ts` | DiagramBox, BorderDraw, Header, Footer, StepIndicator |
| `./icons` | `./src/icons/index.tsx` | 18 SVG icon components |
| `./theme` | `./src/theme/index.ts` | ThemeProvider, useTheme, presets |

## License

[MIT](LICENSE)
