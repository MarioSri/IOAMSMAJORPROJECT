BrowserMCP (local MCP) — quick setup

Files added/changed

- browsermcp config: IAOMS-MAIN/browsermcp.config.json
- npm script: IAOMS-MAIN/package.json -> `mcp:start`

Run locally

- Using npm script:

```bash
npm run mcp:start
```

- Or run directly with npx:

```bash
npx @browsermcp/mcp@latest --config browsermcp.config.json
```

Notes

- On Windows PowerShell you can run the above commands as-is.
- If you want me to start the MCP server now from this environment, tell me and I will run the `npx` command (you may be prompted to allow network access).
