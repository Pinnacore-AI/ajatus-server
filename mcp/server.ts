import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

// Luo MCP-palvelin
const server = new McpServer({
    name: 'ajatuskumppani-code-sandbox',
    version: '1.0.0',
    description: 'Turvallinen koodin suoritusympäristö Ajatuskumppanille'
});

// Python-koodin suoritus
server.registerTool(
    'run_python_code',
    {
        schema: z.object({
            code: z.string().describe('Python-koodi joka suoritetaan'),
            timeout: z.number().optional().default(30).describe('Timeout sekunneissa'),
            packages: z.array(z.string()).optional().describe('Asennettavat pip-paketit')
        }),
        description: 'Suorittaa Python-koodin eristetyssä Docker-kontissa ja palauttaa tuloksen'
    },
    async (uri, { code, timeout = 30, packages = [] }) => {
        try {
            const result = await runPythonInDocker(code, timeout, packages);
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: true,
                        output: result.stdout,
                        error: result.stderr,
                        executionTime: result.executionTime
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                }]
            };
        }
    }
);

// JavaScript/Node.js-koodin suoritus
server.registerTool(
    'run_javascript_code',
    {
        schema: z.object({
            code: z.string().describe('JavaScript-koodi joka suoritetaan'),
            timeout: z.number().optional().default(30).describe('Timeout sekunneissa'),
            packages: z.array(z.string()).optional().describe('Asennettavat npm-paketit')
        }),
        description: 'Suorittaa JavaScript-koodin eristetyssä Docker-kontissa'
    },
    async (uri, { code, timeout = 30, packages = [] }) => {
        try {
            const result = await runJavaScriptInDocker(code, timeout, packages);
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: true,
                        output: result.stdout,
                        error: result.stderr,
                        executionTime: result.executionTime
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                }]
            };
        }
    }
);

// Rust-koodin suoritus
server.registerTool(
    'run_rust_code',
    {
        schema: z.object({
            code: z.string().describe('Rust-koodi joka suoritetaan'),
            timeout: z.number().optional().default(60).describe('Timeout sekunneissa (Rust kompiloi hitaammin)')
        }),
        description: 'Kääntää ja suorittaa Rust-koodin eristetyssä Docker-kontissa'
    },
    async (uri, { code, timeout = 60 }) => {
        try {
            const result = await runRustInDocker(code, timeout);
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: true,
                        output: result.stdout,
                        error: result.stderr,
                        executionTime: result.executionTime
                    }, null, 2)
                }]
            };
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/plain',
                    text: JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                }]
            };
        }
    }
);

// Express HTTP-serveri MCP-yhteyksiä varten
const app = express();
app.use(express.json());

const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
});

// MCP-serverin endpoint
app.post('/mcp', async (req, res) => {
    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('MCP request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', server: 'ajatuskumppani-code-sandbox' });
});

// Käynnistä serveri
const port = parseInt(process.env.MCP_PORT || '3001');
app.listen(port, () => {
    console.log(`🚀 MCP Code Sandbox running on http://localhost:${port}/mcp`);
});

// ============================================================================
// Sandbox-toteutukset
// ============================================================================

interface ExecutionResult {
    stdout: string;
    stderr: string;
    executionTime: number;
}

/**
 * Suorittaa Python-koodin Docker-kontissa
 */
async function runPythonInDocker(
    code: string,
    timeout: number,
    packages: string[] = []
): Promise<ExecutionResult> {
    const sessionId = uuidv4();
    const tempDir = `/tmp/python-sandbox-${sessionId}`;
    
    try {
        // Luo väliaikainen hakemisto
        await fs.mkdir(tempDir, { recursive: true });
        
        // Kirjoita koodi tiedostoon
        const codePath = path.join(tempDir, 'main.py');
        await fs.writeFile(codePath, code);
        
        // Luo Dockerfile
        const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
${packages.length > 0 ? `RUN pip install --no-cache-dir ${packages.join(' ')}` : ''}
COPY main.py .
CMD ["python", "main.py"]
`;
        await fs.writeFile(path.join(tempDir, 'Dockerfile'), dockerfile);
        
        const startTime = Date.now();
        
        // Buildaa ja suorita Docker-kontti
        const buildCmd = `docker build -t python-sandbox-${sessionId} ${tempDir}`;
        await execAsync(buildCmd, { timeout: 60000 });
        
        const runCmd = `docker run --rm --network none --memory=512m --cpus=1 python-sandbox-${sessionId}`;
        const { stdout, stderr } = await execAsync(runCmd, { timeout: timeout * 1000 });
        
        const executionTime = Date.now() - startTime;
        
        // Siivoa
        await cleanup(sessionId, tempDir);
        
        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime
        };
    } catch (error: any) {
        await cleanup(sessionId, tempDir);
        throw new Error(`Python execution failed: ${error.message}`);
    }
}

/**
 * Suorittaa JavaScript-koodin Docker-kontissa
 */
async function runJavaScriptInDocker(
    code: string,
    timeout: number,
    packages: string[] = []
): Promise<ExecutionResult> {
    const sessionId = uuidv4();
    const tempDir = `/tmp/js-sandbox-${sessionId}`;
    
    try {
        await fs.mkdir(tempDir, { recursive: true });
        
        const codePath = path.join(tempDir, 'main.js');
        await fs.writeFile(codePath, code);
        
        // Luo package.json jos paketteja tarvitaan
        if (packages.length > 0) {
            const packageJson = {
                name: 'sandbox',
                version: '1.0.0',
                dependencies: packages.reduce((acc, pkg) => {
                    acc[pkg] = 'latest';
                    return acc;
                }, {} as Record<string, string>)
            };
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );
        }
        
        const dockerfile = `
FROM node:18-slim
WORKDIR /app
${packages.length > 0 ? 'COPY package.json .\nRUN npm install --production' : ''}
COPY main.js .
CMD ["node", "main.js"]
`;
        await fs.writeFile(path.join(tempDir, 'Dockerfile'), dockerfile);
        
        const startTime = Date.now();
        
        const buildCmd = `docker build -t js-sandbox-${sessionId} ${tempDir}`;
        await execAsync(buildCmd, { timeout: 60000 });
        
        const runCmd = `docker run --rm --network none --memory=512m --cpus=1 js-sandbox-${sessionId}`;
        const { stdout, stderr } = await execAsync(runCmd, { timeout: timeout * 1000 });
        
        const executionTime = Date.now() - startTime;
        
        await cleanup(sessionId, tempDir);
        
        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime
        };
    } catch (error: any) {
        await cleanup(sessionId, tempDir);
        throw new Error(`JavaScript execution failed: ${error.message}`);
    }
}

/**
 * Kääntää ja suorittaa Rust-koodin Docker-kontissa
 */
async function runRustInDocker(
    code: string,
    timeout: number
): Promise<ExecutionResult> {
    const sessionId = uuidv4();
    const tempDir = `/tmp/rust-sandbox-${sessionId}`;
    
    try {
        await fs.mkdir(tempDir, { recursive: true });
        
        const codePath = path.join(tempDir, 'main.rs');
        await fs.writeFile(codePath, code);
        
        const dockerfile = `
FROM rust:1.75-slim
WORKDIR /app
COPY main.rs .
RUN rustc -O main.rs
CMD ["./main"]
`;
        await fs.writeFile(path.join(tempDir, 'Dockerfile'), dockerfile);
        
        const startTime = Date.now();
        
        const buildCmd = `docker build -t rust-sandbox-${sessionId} ${tempDir}`;
        await execAsync(buildCmd, { timeout: 120000 }); // Rust kompiloi hitaammin
        
        const runCmd = `docker run --rm --network none --memory=512m --cpus=1 rust-sandbox-${sessionId}`;
        const { stdout, stderr } = await execAsync(runCmd, { timeout: timeout * 1000 });
        
        const executionTime = Date.now() - startTime;
        
        await cleanup(sessionId, tempDir);
        
        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime
        };
    } catch (error: any) {
        await cleanup(sessionId, tempDir);
        throw new Error(`Rust execution failed: ${error.message}`);
    }
}

/**
 * Siivoa väliaikaiset tiedostot ja Docker-imaget
 */
async function cleanup(sessionId: string, tempDir: string) {
    try {
        // Poista Docker-image
        await execAsync(`docker rmi -f python-sandbox-${sessionId} js-sandbox-${sessionId} rust-sandbox-${sessionId} 2>/dev/null || true`);
        
        // Poista väliaikaiset tiedostot
        await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

export default server;

