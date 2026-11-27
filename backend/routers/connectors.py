from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from services.connectors_service import connectors_service

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

class StatusUpdateRequest(BaseModel):
    status: str

class ToggleConnectorRequest(BaseModel):
    enabled: bool

class AddMcpServerRequest(BaseModel):
    name: str
    transport: str = "stdio"
    command_or_url: str
    environment_variables: Optional[Dict[str, str]] = None

class ExecuteToolRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = {}

@router.get("")
def get_connectors():
    return connectors_service.list_connectors()

@router.put("/{connector_id}/status")
def update_status(connector_id: str, req: StatusUpdateRequest):
    try:
        return connectors_service.update_connector_status(connector_id, req.status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{connector_id}/toggle")
def toggle_connector(connector_id: str, req: ToggleConnectorRequest):
    try:
        return connectors_service.toggle_connector(connector_id, req.enabled)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{connector_id}/test")
async def test_connector(connector_id: str):
    return await connectors_service.test_connector(connector_id)

@router.post("/mcp/add")
async def add_mcp_server(req: AddMcpServerRequest):
    return await connectors_service.add_mcp_server(
        name=req.name,
        transport=req.transport,
        command_or_url=req.command_or_url,
        env_vars=req.environment_variables or {}
    )

@router.post("/execute")
async def execute_tool(req: ExecuteToolRequest):
    return await connectors_service.execute_tool(req.tool_name, req.arguments)
