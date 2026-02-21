import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { existsSync, mkdtempSync, rmSync, copyFileSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";

const PORT = parseInt(process.env.PORT || "9005");
const HOST = process.env.HOST || "0.0.0.0";

interface SlitherResult {
  success: boolean;
  contracts?: any[];
  detectors?: any[];
  functions?: any[];
  source?: string;
  analysisOutput?: string;
  error?: string;
}

const analysisCache = new Map<string, any>();

function createSandboxedEnvironment(files: string[]): string {
  const sandboxDir = mkdtempSync(join(tmpdir(), "slither-sandbox-"));
  
  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(`File does not exist: ${file}`);
    }
    const filename = basename(file);
    const destPath = join(sandboxDir, filename);
    copyFileSync(file, destPath);
  }
  
  return sandboxDir;
}

function runSlitherOnFiles(files: string[], args: string[] = []): SlitherResult {
  let sandboxDir: string | null = null;
  
  try {
    if (files.length === 0) {
      return { success: false, error: "No files provided for analysis" };
    }

    const fileListKey = files.sort().join("|");
    if (analysisCache.has(fileListKey)) {
      console.log(`Using cached analysis for ${files.length} files`);
      return { success: true, ...analysisCache.get(fileListKey) };
    }

    sandboxDir = createSandboxedEnvironment(files);
    console.log(`Running Slither analysis on ${files.length} files in sandbox ${sandboxDir}...`);
    
    const slitherArgs = [".", "--print", "human-summary", ...args];
    const result = execSync(`slither ${slitherArgs.join(" ")}`, { 
      encoding: "utf8",
      timeout: 30000,
      cwd: sandboxDir
    });

    const analysis = {
      contracts: [],
      detectors: [],
      functions: [],
      analysisOutput: result,
      analyzedFiles: files
    };

    analysisCache.set(fileListKey, analysis);
    return { success: true, ...analysis };
    
  } catch (err) {
    const error = err as Error;
    return { 
      success: false, 
      error: `Slither analysis failed: ${error.message}` 
    };
  } finally {
    if (sandboxDir && existsSync(sandboxDir)) {
      try {
        rmSync(sandboxDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(`Failed to cleanup sandbox: ${cleanupErr}`);
      }
    }
  }
}

function createMcpServer(): Server {
  const server = new Server(
    { name: "slither-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "analyze_files",
        description: "Run Slither static analysis on specific Solidity files",
        inputSchema: {
          type: "object" as const,
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "List of Solidity file paths to analyze",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "run_detectors",
        description: "Run specific Slither detectors on Solidity files",
        inputSchema: {
          type: "object" as const,
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "List of Solidity file paths to analyze",
            },
            detectors: {
              type: "array",
              items: { type: "string" },
              description: "List of specific detector names to run (optional, runs all if not specified)",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "get_contract_info",
        description: "Get detailed information about contracts in Solidity files",
        inputSchema: {
          type: "object" as const,
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "List of Solidity file paths to analyze",
            },
            contract_name: {
              type: "string",
              description: "Specific contract name (optional)",
            },
          },
          required: ["files"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "analyze_files") {
      const { files } = args as { files: string[] };
      const result = runSlitherOnFiles(files);
      
      if (!result.success) {
        return {
          content: [{ type: "text" as const, text: result.error || "Analysis failed" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `# Slither Analysis Results\n\n**Files:** ${files.join(", ")}\n\n## Analysis Output:\n\`\`\`\n${result.analysisOutput || "Analysis completed successfully"}\n\`\`\``,
          },
        ],
      };
    }

    if (name === "run_detectors") {
      const { files, detectors } = args as { files: string[]; detectors?: string[] };
      const detectorArgs = detectors ? ["--detect", detectors.join(",")] : [];
      const result = runSlitherOnFiles(files, detectorArgs);
      
      if (!result.success) {
        return {
          content: [{ type: "text" as const, text: result.error || "Detector analysis failed" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `# Slither Detector Results\n\n**Files:** ${files.join(", ")}\n\n## Findings:\n\`\`\`\n${result.analysisOutput || "No issues found"}\n\`\`\``,
          },
        ],
      };
    }

    if (name === "get_contract_info") {
      const { files, contract_name } = args as { files: string[]; contract_name?: string };
      const result = runSlitherOnFiles(files, ["--print", "inheritance-graph"]);
      
      if (!result.success) {
        return {
          content: [{ type: "text" as const, text: result.error || "Contract analysis failed" }],
          isError: true,
        };
      }

      const info = contract_name 
        ? `# Contract Information: ${contract_name}\n\n**Files:** ${files.join(", ")}\n\n## Analysis:\n\`\`\`\n${result.analysisOutput}\n\`\`\``
        : `# Contract Analysis\n\n**Files:** ${files.join(", ")}\n\n## Analysis:\n\`\`\`\n${result.analysisOutput}\n\`\`\``;

      return {
        content: [{ type: "text" as const, text: info }],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Unknown tool: '${name}'` }],
      isError: true,
    };
  });

  return server;
}

const app = express();
app.use(express.json());
app.use((_req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const sessions = new Map<string, { transport: StreamableHTTPServerTransport }>();

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "slither-mcp",
    cached_analyses: analysisCache.size,
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { transport });
    },
  });

  transport.onclose = () => {
    const id = transport.sessionId;
    if (id) sessions.delete(id);
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing mcp-session-id" });
    return;
  }
  const { transport } = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

async function main(): Promise<void> {
  try {
    execSync("slither --version", { encoding: "utf8" });
    console.log("Slither is available");
  } catch (err) {
    console.error("ERROR: Slither is not installed or not in PATH");
    console.error("Please install Slither: pip install slither-analyzer");
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Slither MCP server listening on ${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
