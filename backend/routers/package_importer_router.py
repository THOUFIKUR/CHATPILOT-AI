from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from services.package_importer import package_importer_service
from services.policy_engine import policy_engine, PolicyClassification
from pydantic import BaseModel

router = APIRouter(prefix="/api/dataset", tags=["dataset"])

class ClassifyRequest(BaseModel):
    message: str

class ImportExecuteRequest(BaseModel):
    limit_chats: Optional[int] = None

class ReviewStyleRequest(BaseModel):
    review_status: str

class ConfirmRelationshipRequest(BaseModel):
    relationship_type: str
    notes: Optional[str] = None

@router.get("/dry-run")
def get_dataset_dry_run():
    """
    Executes a comprehensive dry run analysis on the WhatsApp dataset package.
    NO database records are created or modified.
    """
    try:
        return package_importer_service.run_dry_run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execute-import")
def execute_dataset_import(req: ImportExecuteRequest = ImportExecuteRequest()):
    """
    Executes the authorized bulk import of the WhatsApp dataset package.
    Populates contacts, conversations, sources, messages, style profiles, and relationships.
    """
    try:
        return package_importer_service.execute_bulk_import(limit_chats=req.limit_chats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/style-profiles")
def get_style_profiles():
    """
    Retrieves all imported contact style profiles.
    """
    try:
        return package_importer_service.get_style_profiles()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/style-profiles/{profile_id}/review")
def review_style_profile(profile_id: str, req: ReviewStyleRequest):
    """
    Approves or rejects a contact style profile.
    """
    try:
        return package_importer_service.review_style_profile(profile_id=profile_id, review_status=req.review_status)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/relationships")
def get_relationships():
    """
    Retrieves all contact relationships.
    """
    try:
        return package_importer_service.get_relationships()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/relationships/{relationship_id}/confirm")
def confirm_relationship(relationship_id: str, req: ConfirmRelationshipRequest):
    """
    Confirms or edits a contact relationship classification.
    """
    try:
        return package_importer_service.confirm_relationship(
            relationship_id=relationship_id,
            relationship_type=req.relationship_type,
            notes=req.notes
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/policy/classify", response_model=PolicyClassification)
def classify_message_policy(req: ClassifyRequest):
    """
    Evaluates incoming message against the 12-category safety policy engine.
    """
    return policy_engine.classify_message(req.message)
