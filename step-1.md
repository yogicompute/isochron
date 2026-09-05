# Step 1 — Foundations & "hello, socket"

> This is the first buildable step. In `plan.md` it's labelled **Step 0**; it's the
> *"set up files/folders + hello-world program"* step you described. By the end you'll have
> a TypeScript monorepo where a **TCP server** and a **TCP client** talk over a socket,
> with a shared **protocol** package between them.
>
> **Do it yourself, top to bottom.** Every file's full contents are given. Don't copy my
> scratchpad — type it out; that's the point.

---

## 0. Prerequisites (check once)

```bash
node -v      # need v18+  (you have v25 — good)
npm -v       # need v8+   (you have 11 — good)
```

You'll run TypeScript directly with **`tsx`** (no build step) during development.

---

## 1. Create the folder skeleton

From inside the project root (`~/Documents/isochron`):

```bash
cd ~/Documents/isochron

mkdir -p packages/protocol/src
mkdir -p packages/server/src
mkdir -p packages/client-sdk/src
```

Target layout for this step:

```
isochron/
├─ package.json                 # workspaces root (create in §2)
├─ tsconfig.base.json           # shared TS config (create in §3)
├─ plan.md                      # already there
├─ step-1.md                    # this file
└─ packages/
   ├─ protocol/
   │  ├─ package.json           # §4
   │  └─ src/index.ts           # §4
   ├─ server/
   │  ├─ package.json           # §5
   │  ├─ tsconfig.json          # §5
   │  └─ src/tcp-hello.ts       # §5
   └─ client-sdk/
      ├─ package.json           # §6
      ├─ tsconfig.json          # §6
      └─ src/tcp-hello-client.ts# §6
```

---

## 2. Root `package.json` (the workspaces root)

Create `~/Documents/isochron/package.json`:

```json
{
  "name": "isochron",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*",
    "tools/*"
  ],
  "scripts": {
    "dev:server": "tsx packages/server/src/tcp-hello.ts",
    "dev:client": "tsx packages/client-sdk/src/tcp-hello-client.ts"
  }
}
```

- `"private": true` — this root is never published.
- `"type": "module"` — use ESM (`import`/`export`) everywhere.
- `"workspaces"` — npm will symlink every `packages/*` into `node_modules` by its
  package name, so packages can import each other by name.

Now install the dev toolchain **at the root** (this also creates the workspace links):

```bash
cd ~/Documents/isochron
npm install -D tsx typescript @types/node
```

> After this you'll see `node_modules/@isochron/*` symlinks appear once the packages
> below exist and you run `npm install` again (see §7).

---

## 3. `tsconfig.base.json` (shared compiler settings)

Create `~/Documents/isochron/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

Each package will `extend` this so all packages share one strict config.

---

## 4. The `protocol` package (shared code)

This holds anything both server and client must agree on. Right now that's just a
port number, a protocol version, and a stub `Frame` type we grow later.

**`packages/protocol/package.json`**
```json
{
  "name": "@isochron/protocol",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```
> `exports` points straight at the `.ts` source. Because we run everything through
> `tsx`, other packages can `import` this by name with **no build step**.

**`packages/protocol/src/index.ts`**
```ts
export const PROTOCOL_VERSION = 1;

export const DEFAULT_TCP_PORT = 7000;

// A Frame is one message on the wire. Just a stub for now — we flesh this
// out into a real envelope in Step 2 (WebSocket) and a binary layout later.
export interface Frame {
  type: string;
  body: unknown;
}
```

---

## 5. The `server` package (TCP echo server)

**`packages/server/package.json`**
```json
{
  "name": "@isochron/server",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@isochron/protocol": "*"
  }
}
```
> `"@isochron/protocol": "*"` tells npm to link the local workspace package.

**`packages/server/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**`packages/server/src/tcp-hello.ts`**
```ts
import net from "node:net";
import { DEFAULT_TCP_PORT, PROTOCOL_VERSION } from "@isochron/protocol";

const server = net.createServer((socket) => {
  const who = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[server] client connected: ${who}`);

  socket.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    console.log(`[server] recv from ${who}: ${text.trimEnd()}`);
    socket.write(`echo: ${text}`); // send it straight back
  });

  socket.on("close", () => console.log(`[server] client disconnected: ${who}`));
  socket.on("error", (err) => console.error(`[server] socket error: ${err.message}`));
});

server.listen(DEFAULT_TCP_PORT, () => {
  console.log(
    `[server] isochron TCP hello (protocol v${PROTOCOL_VERSION}) listening on :${DEFAULT_TCP_PORT}`,
  );
});
```

**What each part does**
- `net.createServer(cb)` — `cb` fires once per incoming connection; `socket` is that client's pipe.
- `socket.on("data", …)` — TCP delivers **bytes**, not messages. A `Buffer` arrives; we
  turn it into a string. (For "hello" it comes in one chunk; real framing comes in Step 2.)
- `socket.write(...)` — write bytes back down the same socket.
- `server.listen(port, cb)` — bind the port and start accepting.

---

## 6. The `client-sdk` package (TCP client)

**`packages/client-sdk/package.json`**
```json
{
  "name": "@isochron/client-sdk",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@isochron/protocol": "*"
  }
}
```

**`packages/client-sdk/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**`packages/client-sdk/src/tcp-hello-client.ts`**
```ts
import net from "node:net";
import { DEFAULT_TCP_PORT } from "@isochron/protocol";

const socket = net.createConnection(
  { port: DEFAULT_TCP_PORT, host: "127.0.0.1" },
  () => {
    console.log("[client] connected, sending hello...");
    socket.write("hello");
  },
);

socket.on("data", (chunk) => {
  console.log(`[client] recv: ${chunk.toString("utf8").trimEnd()}`);
  socket.end(); // done after one round-trip
});

socket.on("close", () => console.log("[client] connection closed"));
socket.on("error", (err) => console.error(`[client] error: ${err.message}`));
```

**What each part does**
- `net.createConnection({port, host}, cb)` — open a TCP connection; `cb` runs once connected.
- We send `"hello"` on connect, print the reply, then `socket.end()` to close cleanly.

---

## 7. Wire up the workspace links

You added two new packages that depend on `@isochron/protocol`. Re-run install at the
root so npm creates the symlinks:

```bash
cd ~/Documents/isochron
npm install
```

Sanity check — you should see three symlinks:
```bash
ls -la node_modules/@isochron
# protocol -> ../../packages/protocol
# server   -> ../../packages/server
# client-sdk -> ../../packages/client-sdk
```

---

## 8. Run it (two terminals)

**Terminal A — start the server:**
```bash
cd ~/Documents/isochron
npm run dev:server
```
Expected:
```
[server] isochron TCP hello (protocol v1) listening on :7000
```

**Terminal B — run the client:**
```bash
cd ~/Documents/isochron
npm run dev:client
```
Expected (client):
```
[client] connected, sending hello...
[client] recv: echo: hello
[client] connection closed
```
And in Terminal A you'll see:
```
[server] client connected: 127.0.0.1:xxxxx
[server] recv from 127.0.0.1:xxxxx: hello
[server] client disconnected: 127.0.0.1:xxxxx
```

Stop the server with `Ctrl+C`.

---

## ✅ Definition of done (this step is a complete product)

- [ ] `npm run dev:server` starts and prints the listening line.
- [ ] `npm run dev:client` prints `[client] recv: echo: hello`.
- [ ] The server logs the connect / recv / disconnect lines.
- [ ] The client imports `DEFAULT_TCP_PORT` from `@isochron/protocol` (proves the
      workspace linking works — this is the foundation the whole monorepo relies on).

If all four are true, your first socket program works end to end and the repo skeleton
is real. Commit it:

```bash
cd ~/Documents/isochron
git init            # if you haven't yet
printf "node_modules/\ndist/\n" > .gitignore
git add -A && git commit -m "Step 1: TS monorepo + TCP hello-world echo"
```

---

## Troubleshooting

- **`Cannot find package '@isochron/protocol'`** → you didn't re-run `npm install` at the
  root after creating the packages (§7), or a `package.json` `name` is misspelled.
- **`command not found: tsx`** → run `npm install -D tsx` at the root (§2), and invoke via
  the npm scripts (which resolve `tsx` from `node_modules`), not a global `tsx`.
- **`EADDRINUSE :7000`** → the server is already running in another terminal, or change
  `DEFAULT_TCP_PORT` in `packages/protocol/src/index.ts`.
- **Client prints `ECONNREFUSED`** → the server isn't running yet; start Terminal A first.

---

## What you just learned / what's next

You built the **1:1** case: one client, one server, raw bytes. The whole project is about
the **1:N** case done *fairly*. **Step 2 (plan.md Step 1)** swaps `net` for WebSockets and
turns this echo into a **broadcast** to many browser tabs — and you'll *see* them flip at
slightly different times. That visible unfairness is the problem the rest of Isochron solves.
