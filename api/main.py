#!/usr/bin/env python3
# Ajatuskumppani — built in Finland, by the free minds of Pinnacore.

"""
AjatusServer - Main FastAPI Application

This is the central API and orchestrator for the Ajatuskumppani ecosystem.
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

# Initialize FastAPI app
app = FastAPI(
    title="AjatusServer",
    description="The central API for the Ajatuskumppani ecosystem",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class ChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


class HealthResponse(BaseModel):
    status: str
    version: str


# Routes
@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "0.1.0"
    }


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint for interacting with the AI.
    
    This endpoint:
    1. Receives a user message
    2. Retrieves relevant memories from AjatusMemory
    3. Sends the prompt to AjatusCore
    4. Stores the interaction
    5. Returns the response
    """
    # TODO: Implement actual logic
    # For now, return a placeholder response
    
    return {
        "response": f"Echo: {request.message}",
        "conversation_id": request.conversation_id or "new-conversation-id"
    }


@app.get("/api/v1/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "services": {
            "database": "connected",  # TODO: Check actual DB connection
            "llm": "ready",           # TODO: Check LLM availability
            "memory": "ready"         # TODO: Check memory service
        }
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

