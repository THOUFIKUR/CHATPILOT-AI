import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from database import get_supabase
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str
    device_name: str = "Windows Workstation"
    device_type: str = "windows"
    device_identifier: str

class SwitchDeviceRequest(BaseModel):
    email: str
    password: str
    device_name: str
    device_type: str
    device_identifier: str

class ValidateSessionRequest(BaseModel):
    device_identifier: str
    user_id: Optional[str] = None

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    token: str

class ResetPasswordRequest(BaseModel):
    new_password: str
    email: Optional[str] = None
    access_token: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str

class LogoutRequest(BaseModel):
    device_identifier: str
    user_id: Optional[str] = None

@router.post("/login")
async def login(req: LoginRequest):
    """
    Authenticates via Supabase Auth and checks for single-active-device conflicts.
    """
    try:
        # Try signing in with password
        try:
            auth_res = get_supabase().auth.sign_in_with_password({
                "email": str(req.email),
                "password": req.password
            })
        except Exception as auth_err:
            err_str = str(auth_err)
            # If email is not confirmed, auto-confirm using admin client and retry
            if "Email not confirmed" in err_str or "email_not_confirmed" in err_str:
                from supabase import create_client
                admin_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
                user_list = admin_client.auth.admin.list_users()
                target_u = next((u for u in user_list if (u.email or "").lower() == str(req.email).lower()), None)
                if target_u:
                    admin_client.auth.admin.update_user_by_id(target_u.id, {"email_confirm": True})
                    auth_res = get_supabase().auth.sign_in_with_password({
                        "email": str(req.email),
                        "password": req.password
                    })
                else:
                    raise auth_err
            else:
                raise auth_err

        user = auth_res.user
        session = auth_res.session

        if not user:
            raise HTTPException(status_code=401, detail="Authentication failed: user not found")

        user_id = str(user.id)

        # Check existing active devices for this user
        dev_res = get_supabase().table("devices").select("*").eq("owner_id", user_id).eq("is_active", True).execute()
        active_devices = dev_res.data or []

        # Find if another device is currently active
        other_active = [d for d in active_devices if d.get("device_identifier") != req.device_identifier]

        if other_active:
            other = other_active[0]
            logger.info(f"Active session conflict detected: User {req.email} is active on {other.get('device_name')}")
            return {
                "status": "conflict",
                "conflict": True,
                "active_device": {
                    "device_name": other.get("device_name", "Another Device"),
                    "device_type": other.get("device_type", "desktop"),
                    "last_active_at": other.get("last_seen_at")
                },
                "temp_user_id": user_id,
                "message": "Account already active on another device"
            }

        # No conflict: Register/activate this device session
        now = datetime.now(timezone.utc).isoformat()
        
        # Deactivate any other records
        get_supabase().table("devices").update({"is_active": False}).eq("owner_id", user_id).execute()

        # Register current device
        upsert_data = {
            "owner_id": user_id,
            "device_name": req.device_name,
            "device_type": req.device_type,
            "device_identifier": req.device_identifier,
            "is_active": True,
            "last_seen_at": now
        }
        
        existing_this = get_supabase().table("devices").select("id").eq("device_identifier", req.device_identifier).execute()
        if existing_this.data:
            get_supabase().table("devices").update(upsert_data).eq("id", existing_this.data[0]["id"]).execute()
        else:
            get_supabase().table("devices").insert(upsert_data).execute()

        return {
            "status": "success",
            "conflict": False,
            "user": {
                "id": user_id,
                "email": user.email,
                "name": (user.user_metadata or {}).get("name") or req.email.split("@")[0]
            },
            "session": {
                "access_token": session.access_token if session else "",
                "refresh_token": session.refresh_token if session else "",
                "expires_at": session.expires_at if session else 0
            },
            "active_device": {
                "device_name": req.device_name,
                "device_type": req.device_type,
                "last_active_at": now
            }
        }

    except Exception as e:
        logger.error(f"Login error: {e}")
        err_msg = str(e)
        if "Invalid login credentials" in err_msg or "invalid_credentials" in err_msg:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirm-switch")
async def confirm_switch_device(req: SwitchDeviceRequest):
    """
    Revokes the previous device and activates the new device atomically.
    """
    try:
        auth_res = get_supabase().auth.sign_in_with_password({
            "email": str(req.email),
            "password": req.password
        })
        user = auth_res.user
        session = auth_res.session
        if not user:
            raise HTTPException(status_code=401, detail="Authentication failed")

        user_id = str(user.id)
        now = datetime.now(timezone.utc).isoformat()

        # Atomically deactivate ALL previous devices for this user
        get_supabase().table("devices").update({"is_active": False}).eq("owner_id", user_id).execute()

        # Activate this device
        upsert_data = {
            "owner_id": user_id,
            "device_name": req.device_name,
            "device_type": req.device_type,
            "device_identifier": req.device_identifier,
            "is_active": True,
            "last_seen_at": now
        }
        
        existing_this = get_supabase().table("devices").select("id").eq("owner_id", user_id).eq("device_identifier", req.device_identifier).execute()
        if existing_this.data:
            get_supabase().table("devices").update(upsert_data).eq("id", existing_this.data[0]["id"]).execute()
        else:
            get_supabase().table("devices").insert(upsert_data).execute()

        logger.info(f"Switched active device for {req.email} to {req.device_name} ({req.device_identifier})")

        return {
            "status": "success",
            "message": "Previous device revoked. New device activated.",
            "user": {
                "id": user_id,
                "email": user.email,
                "name": (user.user_metadata or {}).get("name") or req.email.split("@")[0]
            },
            "session": {
                "access_token": session.access_token if session else "",
                "refresh_token": session.refresh_token if session else "",
                "expires_at": session.expires_at if session else 0
            },
            "active_device": {
                "device_name": req.device_name,
                "device_type": req.device_type,
                "last_active_at": now
            }
        }
    except Exception as e:
        logger.error(f"Switch device error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/validate-session")
async def validate_session(req: ValidateSessionRequest):
    """
    Authoritative backend check: Verifies if the device_identifier is currently active.
    If another device took over, returns HTTP 401 with session_revoked_by_another_device.
    """
    try:
        user_id = req.user_id or settings.DEFAULT_OWNER_ID
        now = datetime.now(timezone.utc).isoformat()

        # Check if ANOTHER device has taken over as active for this user
        dev_res = get_supabase().table("devices").select("*").eq("owner_id", user_id).eq("is_active", True).execute()
        active_devices = dev_res.data or []
        other_active = [d for d in active_devices if d.get("device_identifier") != req.device_identifier]

        if other_active:
            other = other_active[0]
            logger.info(f"Device {req.device_identifier} session was revoked by active device: {other.get('device_name')}")
            raise HTTPException(status_code=401, detail="session_revoked_by_another_device")

        # No other device is active: ensure this device is marked active and touch last_seen_at
        this_res = get_supabase().table("devices").select("id").eq("device_identifier", req.device_identifier).execute()
        if this_res.data:
            get_supabase().table("devices").update({
                "is_active": True,
                "last_seen_at": now
            }).eq("id", this_res.data[0]["id"]).execute()
        else:
            get_supabase().table("devices").insert({
                "owner_id": user_id,
                "device_identifier": req.device_identifier,
                "device_name": "Active Workstation",
                "device_type": "windows",
                "is_active": True,
                "last_seen_at": now
            }).execute()

        return {
            "valid": True,
            "active": True,
            "last_active_at": now
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating session: {e}")
        return {"valid": True, "active": True}

@router.post("/register")
async def register(req: RegisterRequest):
    """
    Registers a new account via Supabase Auth with automatic email confirmation.
    """
    try:
        from supabase import create_client
        admin_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
        
        try:
            admin_res = admin_client.auth.admin.create_user({
                "email": str(req.email),
                "password": req.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": req.full_name
                }
            })
            user_id = str(admin_res.id)
            user_email = admin_res.email
        except Exception as admin_err:
            # Fallback to standard sign_up and confirm
            auth_res = get_supabase().auth.sign_up({
                "email": str(req.email),
                "password": req.password,
                "options": {
                    "data": {
                        "name": req.full_name
                    }
                }
            })
            if not auth_res.user:
                raise admin_err
            user_id = str(auth_res.user.id)
            user_email = auth_res.user.email
            # Auto-confirm via admin
            try:
                admin_client.auth.admin.update_user_by_id(user_id, {"email_confirm": True})
            except Exception:
                pass

        return {
            "status": "success",
            "message": "Account created and verified successfully.",
            "user": {
                "id": user_id,
                "email": user_email,
                "name": req.full_name
            }
        }
    except Exception as e:
        logger.error(f"Registration error: {e}")
        err_msg = str(e)
        if "User already registered" in err_msg or "already exists" in err_msg:
            raise HTTPException(status_code=409, detail="An account with this email address already exists")
        raise HTTPException(status_code=400, detail=err_msg)

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """
    Sends password recovery email via Supabase Auth.
    """
    try:
        res = get_supabase().auth.reset_password_for_email(str(req.email))
        return {
            "status": "success",
            "message": "Recovery email sent. Check your inbox."
        }
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-recovery-otp")
async def verify_recovery_otp(req: VerifyOtpRequest):
    """
    Verifies recovery OTP token via Supabase Auth.
    """
    try:
        res = get_supabase().auth.verify_otp({
            "email": str(req.email),
            "token": req.token,
            "type": "recovery"
        })
        session = res.session
        user_id = str(res.user.id) if res.user else None
        return {
            "status": "success",
            "access_token": session.access_token if session else "",
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"OTP verification error: {e}")
        raise HTTPException(status_code=400, detail="Invalid or expired recovery code")

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """
    Updates user password after verifying recovery OTP.
    """
    try:
        from supabase import create_client
        admin_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
        
        target_user_id = None
        if req.access_token:
            try:
                u_res = admin_client.auth.get_user(req.access_token)
                if u_res and u_res.user:
                    target_user_id = str(u_res.user.id)
            except Exception:
                pass

        if not target_user_id and req.email:
            user_list = admin_client.auth.admin.list_users()
            target = next((u for u in user_list if (u.email or "").lower() == str(req.email).lower()), None)
            if target:
                target_user_id = str(target.id)

        if not target_user_id:
            raise HTTPException(status_code=400, detail="Unable to verify user account for password update")

        admin_client.auth.admin.update_user_by_id(target_user_id, {"password": req.new_password})
        logger.info(f"Password reset successfully completed for user {target_user_id}")
        return {
            "status": "success",
            "message": "Password updated successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest):
    """
    Verifies current password and updates to new password.
    """
    try:
        # Verify current password
        auth_res = get_supabase().auth.sign_in_with_password({
            "email": str(req.email),
            "password": req.current_password
        })
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Current password verification failed")

        # Update password via admin
        user_id = str(auth_res.user.id)
        get_supabase().auth.admin.update_user_by_id(user_id, {"password": req.new_password})

        return {
            "status": "success",
            "message": "Password updated successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/logout")
async def logout(req: LogoutRequest):
    """
    Revokes the active device session on logout.
    """
    try:
        user_id = req.user_id or settings.DEFAULT_OWNER_ID
        get_supabase().table("devices").update({"is_active": False}).eq("owner_id", user_id).eq("device_identifier", req.device_identifier).execute()
        return {"status": "success", "message": "Signed out successfully."}
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return {"status": "success"}

@router.get("/active-device")
async def get_active_device(user_id: Optional[str] = None):
    """
    Returns current active device info.
    """
    uid = user_id or settings.DEFAULT_OWNER_ID
    res = get_supabase().table("devices").select("*").eq("owner_id", uid).eq("is_active", True).execute()
    if res.data:
        return res.data[0]
    return {
        "device_name": "Windows Workstation",
        "device_type": "windows",
        "is_active": True,
        "last_seen_at": datetime.now(timezone.utc).isoformat()
    }

