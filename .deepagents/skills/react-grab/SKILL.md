---
name: react-grab
description: Set up React Grab UI element capture with Athena Add-to-Chat integration in Vite projects
---

# React Grab — UI Element Capture for the Preview Tab

**Repository:** https://github.com/aidenybai/react-grab

React Grab is a developer tool that lets users hover over React UI elements and capture their HTML source, component name, and file location. When integrated with Athena, captured elements can be sent directly to this chat via the "Add to Chat" button in the Preview tab.

---

## Installation

Run in the project root (where `package.json` lives):

```bash
# With pnpm (preferred)
pnpm add -D react-grab

# Or with npm
npm install --save-dev react-grab
```

## Setup for Vite Projects

Add a conditional dev-only import at the top of the app entry file (e.g., `src/main.tsx`):

```typescript
if (import.meta.env.DEV) {
  import("react-grab");
}
```

This ensures react-grab only loads in development and is tree-shaken from production builds.

## Athena "Add to Chat" Plugin

To enable the "Add to Chat" flow between the preview iframe and the Athena chat composer, create a plugin file and import it from the entry point.

### 1. Create `src/react-grab-athena-plugin.ts`

```typescript
if (import.meta.env.DEV) {
  import('react-grab').then((mod) => {
    const registerPlugin = mod.registerPlugin;
    if (!registerPlugin) return;

    // Helper to extract React component info from a DOM element
    function getElementInfo(el: HTMLElement) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      let componentName = '';
      let filePath = '';
      if (fiberKey) {
        let fiber = (el as any)[fiberKey];
        while (fiber) {
          const type = fiber.type;
          if (type && typeof type === 'function') {
            componentName = type.displayName || type.name || '';
          }
          const source = fiber._debugSource || fiber._debugOwner?._debugSource;
          if (source?.fileName) {
            filePath = source.fileName;
            if (source.lineNumber) filePath += ':' + source.lineNumber;
            if (source.columnNumber) filePath += ':' + source.columnNumber;
          }
          if (componentName && filePath) break;
          fiber = fiber.return;
        }
      }
      const html = el.outerHTML.length > 2000
        ? el.outerHTML.slice(0, 2000) + '...'
        : el.outerHTML;
      return { html, componentName, filePath };
    }

    registerPlugin({
      name: 'athena-add-to-chat',
      hooks: {
        // Event 1: Fires when user clicks/selects an element
        onElementSelect: (element: HTMLElement) => {
          const info = getElementInfo(element);
          window.parent.postMessage(
            { type: 'react-grab-element-selected', payload: info },
            '*'
          );
        },
      },
      actions: [
        {
          id: 'add-to-chat',
          label: 'Add to Chat',
          target: 'context-menu',
          // Event 2: Fires when user clicks "Add to Chat" in the context menu
          onAction: (context: { element: HTMLElement; hideContextMenu?: () => void }) => {
            const info = getElementInfo(context.element);
            window.parent.postMessage(
              { type: 'react-grab-add-to-chat', payload: info },
              '*'
            );
            context.hideContextMenu?.();
          },
        },
      ],
    });
  });
}
```

### 2. Import from entry file

Add to the top of `src/main.tsx` (or equivalent):

```typescript
import './react-grab-athena-plugin';
```

## How It Works

The integration uses **two postMessage events** to communicate between the iframe and Athena:

### Event 1: Element Selected (`react-grab-element-selected`)

Fires when the user **clicks or selects** an element with react-grab (via `onElementSelect` hook). This notifies the parent frame that an element has been highlighted, allowing it to show a preview banner.

```typescript
window.parent.postMessage({
  type: 'react-grab-element-selected',
  payload: { html, componentName, filePath },
}, '*');
```

### Event 2: Add to Chat (`react-grab-add-to-chat`)

Fires when the user clicks **"Add to Chat"** from the react-grab context menu. This is the explicit action that sends the element context to the developer agent chat composer.

```typescript
window.parent.postMessage({
  type: 'react-grab-add-to-chat',
  payload: { html, componentName, filePath },
}, '*');
```

### Full Flow

1. **User hovers** over a UI element in the preview iframe — react-grab highlights it
2. **User clicks** the element — `react-grab-element-selected` postMessage fires → banner appears in Preview tab
3. **User right-clicks** → selects **"Add to Chat"** from the react-grab context menu → `react-grab-add-to-chat` postMessage fires
4. A banner appears in the Preview tab showing the captured component with an "Add to Chat" button
5. User clicks **"Add to Chat"** → element context is inserted into the developer agent chat composer

## Captured Data

Each capture includes:
- **HTML source** — the `outerHTML` of the selected element (truncated to 2000 chars)
- **Component name** — the React component where the element lives (e.g., `LoginForm`)
- **File path** — source file with line and column numbers (e.g., `src/components/login-form.tsx:46:19`)

## Quick Setup (All-in-One)

If the user asks you to set up react-grab, run these commands:

```bash
cd /workspace/template  # or wherever the project root is

# Install
pnpm add -D react-grab 2>&1

# Write plugin (two postMessage events: element-selected + add-to-chat)
cat > src/react-grab-athena-plugin.ts << 'EOF'
if (import.meta.env.DEV) {
  import('react-grab').then((mod) => {
    const registerPlugin = mod.registerPlugin;
    if (!registerPlugin) return;

    function getElementInfo(el) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      let componentName = '', filePath = '';
      if (fiberKey) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (fiber.type && typeof fiber.type === 'function') {
            componentName = fiber.type.displayName || fiber.type.name || '';
          }
          const src = fiber._debugSource || fiber._debugOwner?._debugSource;
          if (src?.fileName) {
            filePath = src.fileName;
            if (src.lineNumber) filePath += ':' + src.lineNumber;
            if (src.columnNumber) filePath += ':' + src.columnNumber;
          }
          if (componentName && filePath) break;
          fiber = fiber.return;
        }
      }
      const html = el.outerHTML.length > 2000 ? el.outerHTML.slice(0, 2000) + '...' : el.outerHTML;
      return { html, componentName, filePath };
    }

    registerPlugin({
      name: 'athena-add-to-chat',
      hooks: {
        onElementSelect: (element) => {
          const info = getElementInfo(element);
          window.parent.postMessage({ type: 'react-grab-element-selected', payload: info }, '*');
        },
      },
      actions: [{
        id: 'add-to-chat',
        label: 'Add to Chat',
        target: 'context-menu',
        onAction: (ctx) => {
          const info = getElementInfo(ctx.element);
          window.parent.postMessage({ type: 'react-grab-add-to-chat', payload: info }, '*');
          ctx.hideContextMenu?.();
        },
      }],
    });
  });
}
EOF

# Inject import into entry file
ENTRY=$(find src -maxdepth 1 -name 'main.tsx' -o -name 'main.ts' -o -name 'index.tsx' | head -1)
if [ -n "$ENTRY" ] && ! grep -q 'react-grab-athena-plugin' "$ENTRY"; then
  TEMP=$(mktemp)
  echo "import './react-grab-athena-plugin';" > "$TEMP"
  cat "$ENTRY" >> "$TEMP"
  mv "$TEMP" "$ENTRY"
  echo "Injected import into $ENTRY"
fi

echo "react-grab setup complete — refresh the Preview tab"
```

## Plugin API Reference

react-grab exposes a plugin system:

- `registerPlugin({ name, actions, hooks })` — register a plugin
- `unregisterPlugin(name)` — remove a plugin
- **Actions**: `{ id, label, shortcut?, target?, isActive?, onAction }` — add context menu items or toolbar buttons
- **Hooks**: `{ onElementSelect? }` — fire when an element is targeted
- **ActionContext**: `{ element, hideContextMenu }` — provided to `onAction` callbacks

See the full type definitions at: https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/src/types.ts
