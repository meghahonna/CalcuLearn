---
name: athena-react-sdk
description: Build React apps with the @athenaintel/react SDK — provider, chat, layout, toolkits, hooks, theming, and tool UIs
---

# @athenaintel/react — React SDK Reference

Drop-in React SDK for embedding Athena chat, runtime, and asset rendering into any React app. Handles auth, runtime wiring, tool UIs, and theming so you only configure and compose.

---

## Install

```bash
pnpm add @athenaintel/react
# or: npm install @athenaintel/react
```

Import the stylesheet once at your app entry point — chat prose styles depend on it:

```tsx
import '@athenaintel/react/styles.css';
```

### Tailwind CSS is required (today)

The SDK's components ship with Tailwind utility classes baked into their JSX (`flex`, `bg-background`, `text-muted-foreground`, etc.). The `styles.css` file above only provides theme-variable bindings — **the actual utility classes have to be compiled by your app's Tailwind**. Without Tailwind, the chat renders as unstyled HTML.

The `default-vite` and `athena-app` computer asset templates already have Tailwind v4 + the `@source` directive wired up — copy `docker/default-vite/src/index.css` and `docker/default-vite/vite.config.ts` from the monorepo for a minimal working setup. The critical line:

```css
/* in your app's main CSS entry */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@source "../node_modules/@athenaintel/react/dist";   /* scans SDK so its utilities get compiled */
```

A future SDK release will ship precompiled CSS so this step becomes unnecessary, but for now Tailwind v4 + the `@source` directive is the working path.

### pnpm consumers — dedupe React in vite config

If you see `Invalid hook call. Hooks can only be called inside of the body of a function component.` immediately after installing the SDK in a pnpm workspace, the cause is almost always **two copies of React** in `node_modules/.pnpm/`. pnpm's strict symlink layout sometimes ends up resolving `react`/`react-dom` to a different physical copy than the one your app imports, even though both packages list React as a peer dep.

The fix is one block in your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
```

Vite then guarantees a single resolved copy regardless of how pnpm laid out the directory tree. After adding this, restart the dev server (the cached module graph won't pick up the new resolver behaviour). This is a known pnpm + vite + React gotcha and is unrelated to anything specific about `@athenaintel/react`.

If you're not on Vite, the equivalent is your bundler's module-resolution dedupe option: webpack uses `resolve.alias`, esbuild uses `alias`, etc.

---

## Minimum viable app (~25 lines)

```tsx
import { AthenaProvider, AthenaChat, Toolkits, themes } from '@athenaintel/react';
import '@athenaintel/react/styles.css';

export default function App() {
  return (
    <AthenaProvider
      config={{ apiKey: import.meta.env.VITE_ATHENA_API_KEY }}
      tools={[Toolkits.DOCUMENT, Toolkits.WEB_SEARCH]}
      theme={themes.dark}
      enableThreadList
    >
      <AthenaChat
        welcomeMessage="Hi! How can I help?"
        welcomeSuggestions={[
          { icon: () => null, title: 'Summarize a doc', prompt: 'Summarize the latest report.' },
        ]}
      />
    </AthenaProvider>
  );
}
```

---

## `<AthenaProvider>` — root configuration

Wraps the entire app. Owns the runtime, auth, theme, and (optionally) thread-list state.

```tsx
<AthenaProvider
  config={{
    apiKey: '...',                  // Standalone mode (X-API-KEY)
    token: '...',                   // Athena-managed bearer token (preferred when present)
    apiUrl: '...',                  // Sync server streaming endpoint
    backendUrl: '...',              // Agora backend (Athena REST API)
    appUrl: '...',                  // Origin used for citation deep-links
    environment: 'staging',         // 'staging' | 'production' — preset URLs when apiUrl/backendUrl omitted
    trustedParentOrigins: [],       // Allow postMessage auth from these iframe parents
  }}
  agent="athena_assist_agent"       // Backend agent name
  model="claude-sonnet-4-6"         // LLM identifier
  tools={[Toolkits.DOCUMENT]}       // Backend toolkit IDs (see Toolkits below)
  frontendTools={{}}                // Browser-executed tools (Toolkit shape)
  systemPrompt="..."                // Optional system prompt override
  threadId="..."                    // Pin to a specific thread (omit for auto-generated)
  workbench={['asset_id']}          // Asset IDs to surface in the workbench
  knowledgeBase={['kb_id']}         // Knowledge base IDs for retrieval
  enableThreadList                  // Enable multi-thread UI + state
  theme={themes.dark}               // Theme preset or custom object
  linkClicks={{ /* see Citation Links */ }}
>
  {children}
</AthenaProvider>
```

**Auth precedence:**
1. Parent bridge (when embedded in Marathon/Olympus iframe — auth + URLs delivered via postMessage)
2. Explicit `config.token` (Athena-managed bearer token)
3. `config.apiKey` (standalone mode, sent as `X-API-KEY`)

When `config.apiUrl`/`backendUrl` are omitted, the provider resolves them from the parent bridge or from the `environment` preset. Top-level `apiKey`/`token`/`apiUrl`/`backendUrl`/`environment` props still work as compatibility aliases, but `config={{ ... }}` is the preferred shape.

**`environment` prop gotcha (computer assets):** when the app runs as a computer asset under Marathon/Olympus, **omit `environment`** entirely. The parent bridge already provides the correct `apiUrl`/`backendUrl` for whichever environment hosts the workspace (prod, staging, preview). Setting `environment: 'production'` will override the bridge and pin the app to prod URLs even when the surrounding workspace is on staging — hard to debug.

**`backendUrl` vs raw REST calls:** the `backendUrl` the parent bridge provides points at the **streaming/chat** endpoint (`https://<host>/api/assistant-ui`) — not the public REST API base. If you need to make raw `fetch` calls to AOPs/assets/threads alongside the SDK, **use `$ATHENA_API_URL` from the sandbox env** (it's pre-injected and resolves to `https://<host>/api/v0`). Or strip `/api/assistant-ui` from `backendUrl` and append `/api/v0` yourself.

---

## `<AthenaChat>` — full chat UI

```tsx
import { AthenaChat, TOOL_UI_REGISTRY } from '@athenaintel/react';

<AthenaChat
  welcomeMessage="Hi! How can I help?"
  welcomeSubtext="What can I help you with?"
  welcomeSuggestions={[]}             // [] hides the suggestion grid
  toolUIs={TOOL_UI_REGISTRY}          // Built-in renderers for 70+ tools
  maxWidth="44rem"                    // Cap chat content width
  mentionTools={[]}                   // @-mention candidates
/>
```

`TOOL_UI_REGISTRY` provides pre-built renderers for web search, browse, email, document/sheet/presentation/notebook creation, Python execution, asset opening, and a generic fallback. You can extend it: `<AthenaChat toolUIs={{ ...TOOL_UI_REGISTRY, my_tool: MyToolUI }} />`.

---

## `<AthenaLayout>` — split-pane chat + asset panel

```tsx
import { AthenaLayout, AthenaChat, AssetPanel } from '@athenaintel/react';

<AthenaLayout defaultChatPercent={50}>
  <AthenaChat />
</AthenaLayout>
```

When chat lives inside `<AthenaLayout>`, Athena citation links (`app.athenaintel.com/dashboard/spaces?...`) open the referenced asset in the SDK asset pane by default instead of navigating away. Override with `linkClicks` on the provider or `useAthenaLinkClickHandler()` in custom message renderers.

---

## `Toolkits` — backend toolkit IDs

Pass these strings (or use the `Toolkits` enum) to `tools={[...]}` on `<AthenaProvider>`:

| Constant | ID | Purpose |
|---|---|---|
| `Toolkits.DOCUMENT` | `document_toolkit` | Athena document editing |
| `Toolkits.SPREADSHEET` | `spreadsheet_toolkit` | Sheets ops |
| `Toolkits.PRESENTATION` | `presentation_toolkit` | Slide editing |
| `Toolkits.POWERPOINT` | `powerpoint_deck_toolkit` | PPTX templates |
| `Toolkits.NOTEBOOK` | `notebook_toolkit` | Jupyter execution |
| `Toolkits.WEB_SEARCH` | `web_search_browse_toolkit` | Web search + page browsing |
| `Toolkits.PYTHON` | `python_toolkit` | Python code execution |
| `Toolkits.SQL` | `sql_toolkit` | SQL query execution |
| `Toolkits.DATABASE` | `database_toolkit` | PostgreSQL DB management |
| `Toolkits.AOP` | `aop_toolkit` | Run Agent Operating Procedures |
| `Toolkits.EMAIL` | `unified_email_toolkit` | Multi-account email + calendar (Gmail + Outlook) |
| `Toolkits.EMAIL_CALENDAR` | `email_calendar_toolkit` | Legacy email + calendar |
| `Toolkits.DRIVE` | `olympus_drive_toolkit` | Workspace file management |
| `Toolkits.EXTERNAL_DRIVE` | `external_drive_toolkit` | SharePoint / Google Drive access |
| `Toolkits.COMPUTER_ASSET` | `computer_asset_toolkit` | Ephemeral compute environments |
| `Toolkits.BROWSER` | `browser_toolkit` | Web browser automation |
| `Toolkits.VM` | `vm_toolkit` | VM management |
| `Toolkits.CANVAS` | `canvas_toolkit` | Visual canvas creation |
| `Toolkits.VISUALIZATIONS` | `visualizations_toolkit` | Charts, dashboards, figures |
| `Toolkits.USER_INTERFACE` | `user_interface_toolkit` | Custom UI creation |
| `Toolkits.COMMENTS` | `comments_toolkit` | Document comments |
| `Toolkits.COLLECTIONS` | `collections_toolkit` | Asset collections |
| `Toolkits.PLAYBOOK` | `playbook_toolkit` | Reusable playbooks/prompts |
| `Toolkits.PROJECTS` | `projects_toolkit` | Project management |
| `Toolkits.PREFERENCES` | `preferences_toolkit` | User memory + preferences |
| `Toolkits.GTM` | `gtm_toolkit` | Go-To-Market |
| `Toolkits.MARKETING` | `marketing_toolkit` | Marketing campaigns |

---

## Composer hooks

### `useSendMessage()` — send a prompt from anywhere

Use this for workflow buttons, sidebar shortcuts, and any UI **outside** `<AthenaChat>` that should fire a prompt. Unlike `aui.thread().append()`, it does not depend on `ThreadPrimitive` context — it works anywhere inside `AthenaProvider`.

```tsx
import { useSendMessage } from '@athenaintel/react';

function WorkflowButton() {
  const sendMessage = useSendMessage();
  return (
    <button onClick={() => void sendMessage('Run the quarterly audit workflow')}>
      Run workflow
    </button>
  );
}
```

### `useAppendToComposer()` — prefill a draft (no send)

```tsx
import { useAppendToComposer } from '@athenaintel/react';

const append = useAppendToComposer();
append('Check this out: ...');                  // append
append('New text', { replace: true });          // replace
```

### `useComposerAttachment()` — programmatic attachments

```tsx
const { addFile, addContent, clear } = useComposerAttachment();
addFile(fileObject);                             // File from drag-drop or input
addContent('data.csv', 'col1,col2\n1,2');        // Synthetic content
clear();
```

### `useFileUpload()` — managed upload state

```tsx
import { useFileUpload, FileUploadButton, ComposerDropZone } from '@athenaintel/react';
```

`FileUploadButton` and `ComposerDropZone` are batteries-included variants if you don't need custom upload UI.

### `useQuote()` / `ComposerQuotePreview` — Cmd+L quote support

---

## Threads

Enable with `enableThreadList` on `<AthenaProvider>`. Provides thread list, switching, creation, and archive.

### `<ThreadList>` — pre-built sidebar

```tsx
import { ThreadList } from '@athenaintel/react';
<ThreadList className="px-2" />
```

Uses Tailwind CSS variables (`text-foreground`, `bg-muted`, `border-border`) so it inherits the active theme.

### `useRefreshThreadList()` — manually refresh

```tsx
import { useRefreshThreadList } from '@athenaintel/react';
const refresh = useRefreshThreadList();
await refresh();
```

---

## Tool UIs

### Built-in registry

```tsx
import { TOOL_UI_REGISTRY } from '@athenaintel/react';
<AthenaChat toolUIs={TOOL_UI_REGISTRY} />
```

Covers `WebSearchToolUI`, `BrowseToolUI`, `EmailSearchToolUI`, `CreateDocumentToolUI`, `CreateSheetToolUI`, `CreatePresentationToolUI`, `CreateNotebookToolUI`, `RunPythonCodeToolUI`, `OpenAssetToolUI`, `CreateEmailDraftToolUI`, plus `ToolFallback` for any unmapped tool.

### `createAssetToolUI` — quick asset-creating tool UI

```tsx
import { createAssetToolUI, TOOL_UI_REGISTRY } from '@athenaintel/react';
import { FileText } from 'lucide-react';

const MyDocToolUI = createAssetToolUI({
  icon: FileText,
  assetType: 'document',
  runningLabel: 'Creating doc...',
  doneLabel: 'Created',
});

<AthenaChat toolUIs={{ ...TOOL_UI_REGISTRY, create_my_doc: MyDocToolUI }} />
```

### Full custom tool UI

```tsx
import type { ToolCallMessagePartComponent } from '@athenaintel/react';
import { ToolCard, ExpandableSection, normalizeResult, formatToolName } from '@athenaintel/react';

const CustomUI: ToolCallMessagePartComponent = ({ args, result, status, toolName }) => (
  <ToolCard
    title={formatToolName(toolName)}
    status={status}
  >
    <ExpandableSection label="Args">{JSON.stringify(args, null, 2)}</ExpandableSection>
    {result && <ExpandableSection label="Result">{JSON.stringify(normalizeResult(result), null, 2)}</ExpandableSection>}
  </ToolCard>
);
```

### Frontend (browser-executed) tools

Define tools that run in the browser instead of on the backend. Pass via `frontendTools` on `<AthenaProvider>`.

```tsx
import type { Toolkit } from '@athenaintel/react';

const FRONTEND_TOOLS: Toolkit = {
  navigate_to: {
    description: 'Navigate to a page in this app',
    parameters: {
      type: 'object',
      properties: { page: { type: 'string' } },
      required: ['page'],
    },
    execute: async ({ page }) => {
      window.location.hash = `#/${page}`;
      return { success: true };
    },
  },
};

<AthenaProvider frontendTools={FRONTEND_TOOLS} {...rest} />
```

---

## Assets

### `<AssetPanel>` — embed asset previews

```tsx
import { AssetPanel } from '@athenaintel/react';
<AssetPanel />
```

Used by `<AthenaLayout>` automatically. Use directly if you're building a custom split-pane layout.

### `useAssetEmbed()` — generate embed URLs

```tsx
import { useAssetEmbed } from '@athenaintel/react';
const { url, isLoading } = useAssetEmbed({ assetId: '...', assetType: 'document' });
```

### `useAssetPanelStore()` — panel state

```tsx
import { useAssetPanelStore } from '@athenaintel/react';
const { activeAssetId, openAsset, closeAsset } = useAssetPanelStore();
```

---

## Citation links

Athena citation links (`app.athenaintel.com/dashboard/spaces?asset_ids=...`) inside chat messages are auto-intercepted when wrapped in `<AthenaLayout>` — they open the asset in the panel instead of navigating away.

To customize, pass `linkClicks` to `<AthenaProvider>` or use `useAthenaLinkClickHandler()` in a custom message renderer:

```tsx
import { useMemo } from 'react';

const linkClicks = useMemo(() => ({
  onClick: (link) => {
    if (link.kind !== 'athena-citation' || !link.openInAssetPanel) return false;
    console.log('Citation clicked:', link.citation?.assetId);
    link.openInAssetPanel();
    return true;
  },
}), []);

<AthenaProvider linkClicks={linkClicks}>...</AthenaProvider>
```

To disable interception entirely (let citation links navigate normally) while still observing clicks: `linkClicks={{ interceptAthenaCitations: false }}`.

---

## Theming

`themes` is a named export from `@athenaintel/react` — import it alongside the components you use:

```tsx
import { AthenaProvider, AthenaChat, themes } from '@athenaintel/react';

// 1. Use a preset:
<AthenaProvider theme={themes.dark}>

// 2. Extend a preset with overrides:
<AthenaProvider theme={{ ...themes.dark, primary: '#8b5cf6' }}>

// 3. Build a fully custom theme from scratch:
<AthenaProvider
  theme={{
    primary: '#8b5cf6',
    primaryForeground: '#f5f3ff',
    background: '#0a0a0f',
    foreground: '#f4f4f5',
    muted: '#1f1f2e',
    mutedForeground: '#a1a1aa',
    border: '#27272a',
    input: '#27272a',
    userBubble: '#1e1b4b',
    userBubbleForeground: '#f5f3ff',
    userBubbleRadius: '1rem',
    composerBorder: '#312e81',
    composerRadius: '1.25rem',
    threadMaxWidth: '56rem',
    radius: '0.75rem',
    fontFamily: "'Inter', system-ui, sans-serif",
  }}
>
  <AthenaChat />
</AthenaProvider>
```

**Preset themes:** `light`, `dark`, `midnight`, `warm`, `purple`, `green`.

**Theme properties** (selected — see `AthenaTheme` type for full list):

- **Core:** `primary`, `primaryForeground`, `background`, `foreground`
- **Surfaces:** `muted`, `mutedForeground`, `accent`, `accentForeground`, `secondary`, `card`, `popover`
- **Borders:** `border`, `input`, `ring`
- **Layout:** `radius`, `fontFamily`
- **Sidebar:** `sidebarBackground`, `sidebarBorder`, `sidebarWidth`
- **Chat bubbles:** `userBubble`, `userBubbleForeground`, `userBubbleRadius`, `assistantForeground`, `assistantBubble`, `composerBorder`, `composerRadius`, `threadMaxWidth`

### Contrast-critical token pairs

The theme system does **not** auto-derive readable text colors from custom backgrounds. If you darken or saturate a background, update its paired foreground too:

| Background | Foreground |
|---|---|
| `primary` | `primaryForeground` |
| `background` | `foreground` |
| `card` | `cardForeground` |
| `popover` | `popoverForeground` |
| `accent` | `accentForeground` |
| `secondary` | `secondaryForeground` |
| `userBubble` | `userBubbleForeground` |
| `assistantBubble` | `assistantForeground` |

### Per-element themes

`themeToStyleVars(theme)` returns inline `--var` styles for an arbitrary element — useful when you want a sidebar and chat to use different palettes without two providers:

```tsx
import { themeToStyleVars } from '@athenaintel/react';

const sidebarVars = themeToStyleVars({ background: '#111', foreground: '#eee' });
<div style={sidebarVars}>...</div>
```

### Tailwind CSS variables

The SDK uses Tailwind tokens that map to CSS custom properties. In a Vite + Tailwind app, set them in `index.css`:

```css
:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
}

.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
}
```

When a `theme` prop is set on `<AthenaProvider>`, the provider injects `<div class="athena-themed" style="--primary:...; ...">` and **overrides** `:root` vars. Use the `theme` prop, not `:root` edits, to change colors for theme-aware components.

---

## Auth helpers

### `useParentBridge()` — full iframe bridge state

```tsx
import { useParentBridge } from '@athenaintel/react';

const { token, apiUrl, backendUrl, ready } = useParentBridge();
```

| Field | Type | Description |
|---|---|---|
| `token` | `string \| null` | Bearer token from parent (Marathon/Olympus) |
| `apiUrl` | `string \| null` | Sync server URL from parent |
| `backendUrl` | `string \| null` | Agora backend URL from parent |
| `ready` | `boolean` | `true` once parent has responded or 2s timeout fires |

### `useParentAuth()` — token only

```tsx
import { useParentAuth } from '@athenaintel/react';
const token = useParentAuth();
```

---

## Advanced — runtime access

```tsx
import { useAthenaRuntime, DEFAULT_API_URL, DEFAULT_BACKEND_URL } from '@athenaintel/react';
```

Most apps don't need this — `<AthenaProvider>` wires the runtime automatically. Reach for it only when you're building a custom chat surface that doesn't use `<AthenaChat>`.

---

## UI primitives (build custom layouts)

```tsx
import { Button, buttonVariants, Tooltip, TooltipTrigger, TooltipContent, Collapsible, cn } from '@athenaintel/react';
```

- `cn()` — `clsx` + `tailwind-merge` utility
- `Button`, `Tooltip*`, `Collapsible*` — styled primitives matching the theme

---

## Re-exported types

```tsx
import type { Toolkit, ToolCallMessagePartComponent, AthenaTheme } from '@athenaintel/react';
```

These come from `@assistant-ui/react` under the hood — re-exported so consumers don't need to install assistant-ui separately.

---

## Common gotchas

- **Always import `@athenaintel/react/styles.css` once at the entry point.** Without it, chat prose and tool cards render unstyled.
- **Don't mutate `:root` CSS vars to change colors when a `theme` prop is active** — the theme prop wraps with inline styles that override `:root`. Use `theme={{ ... }}` instead.
- **`useSendMessage()` is the right hook for sidebar/workflow launchers**, not `aui.thread().append()`. The latter requires being inside the `ThreadPrimitive` subtree of `<AthenaChat>`.
- **Standalone mode requires `apiKey` or `token`.** When embedded in Marathon/Olympus, neither is needed — auth flows through the parent bridge.
- **`environment` is a shortcut.** `config={{ environment: 'staging' }}` resolves the matching `apiUrl`/`backendUrl`/`appUrl` automatically; only set them explicitly if you're routing through a custom proxy.
