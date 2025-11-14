"""
MCP Client for Ajatuskumppani
Connects to MCP Code Sandbox server
"""

import httpx
import json
from typing import Optional, Dict, Any, List


class MCPClient:
    """Client for MCP Code Sandbox"""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=120.0)
    
    async def execute_python(
        self,
        code: str,
        timeout: int = 30,
        packages: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Execute Python code in sandbox
        
        Args:
            code: Python code to execute
            timeout: Execution timeout in seconds
            packages: List of pip packages to install
        
        Returns:
            Dict with success, output, error, and executionTime
        """
        return await self._execute(
            tool="run_python_code",
            params={
                "code": code,
                "timeout": timeout,
                "packages": packages or []
            }
        )
    
    async def execute_javascript(
        self,
        code: str,
        timeout: int = 30,
        packages: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Execute JavaScript code in sandbox
        
        Args:
            code: JavaScript code to execute
            timeout: Execution timeout in seconds
            packages: List of npm packages to install
        
        Returns:
            Dict with success, output, error, and executionTime
        """
        return await self._execute(
            tool="run_javascript_code",
            params={
                "code": code,
                "timeout": timeout,
                "packages": packages or []
            }
        )
    
    async def execute_rust(
        self,
        code: str,
        timeout: int = 60
    ) -> Dict[str, Any]:
        """
        Execute Rust code in sandbox
        
        Args:
            code: Rust code to execute
            timeout: Execution timeout in seconds
        
        Returns:
            Dict with success, output, error, and executionTime
        """
        return await self._execute(
            tool="run_rust_code",
            params={
                "code": code,
                "timeout": timeout
            }
        )
    
    async def _execute(self, tool: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute MCP tool
        
        Args:
            tool: Tool name
            params: Tool parameters
        
        Returns:
            Execution result
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {
                        "name": tool,
                        "arguments": params
                    }
                }
            )
            response.raise_for_status()
            
            result = response.json()
            
            if "error" in result:
                return {
                    "success": False,
                    "error": result["error"]["message"]
                }
            
            # Parse result from MCP response
            content = result.get("result", {}).get("contents", [{}])[0]
            text = content.get("text", "{}")
            
            return json.loads(text)
            
        except httpx.HTTPError as e:
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}"
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"JSON decode error: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
    
    async def health_check(self) -> bool:
        """
        Check if MCP server is healthy
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            response = await self.client.get(f"{self.base_url}/health")
            return response.status_code == 200
        except:
            return False
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Example usage
async def main():
    client = MCPClient()
    
    # Test Python execution
    python_code = """
print("Hello from Python!")
import math
print(f"Pi = {math.pi}")
"""
    
    result = await client.execute_python(python_code)
    print("Python result:", result)
    
    # Test JavaScript execution
    js_code = """
console.log("Hello from JavaScript!");
console.log("2 + 2 =", 2 + 2);
"""
    
    result = await client.execute_javascript(js_code)
    print("JavaScript result:", result)
    
    # Test Rust execution
    rust_code = """
fn main() {
    println!("Hello from Rust!");
    println!("2 + 2 = {}", 2 + 2);
}
"""
    
    result = await client.execute_rust(rust_code)
    print("Rust result:", result)
    
    await client.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

