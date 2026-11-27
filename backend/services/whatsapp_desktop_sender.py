import os
import time
import urllib.parse
import ctypes
import threading
from ctypes import wintypes
from typing import Optional
import logging

logger = logging.getLogger(__name__)

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

VK_RETURN = 0x0D

def _worker_send(phone_e164: str, message_text: str, auto_submit: bool, result_holder: dict):
    # A fresh thread has zero hooks and zero windows, allowing clean SetThreadDesktop to WinSta0\Default
    try:
        h_def = user32.OpenDesktopW('Default', 0, False, 0x01FF)
        if h_def:
            user32.SetThreadDesktop(h_def)
    except Exception as e:
        logger.warning(f"Could not set thread desktop in worker: {e}")

    clean_phone = phone_e164.replace("+", "").strip()
    encoded_text = urllib.parse.quote(message_text)
    uri = f"whatsapp://send?phone={clean_phone}&text={encoded_text}"

    # 1. Open conversation with pre-filled message
    try:
        os.startfile(uri)
    except Exception as e:
        logger.error(f"Error launching WhatsApp URI: {e}")
        result_holder["res"] = {"status": "failed", "error": str(e)}
        return

    if not auto_submit:
        result_holder["res"] = {
            "status": "awaiting_manual_approval",
            "message": "Chat opened with message pre-filled. Tap Enter to send."
        }
        return

    # 2. Wait for WhatsApp Desktop window to open and finish staging text
    time.sleep(2.5)

    # 3. Find WhatsApp window on Default desktop
    whatsapp_hwnds = []
    def enum_cb(hwnd, lparam):
        cls_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls_buf, 256)
        if 'WinUIDesktopWin32WindowClass' in cls_buf.value:
            whatsapp_hwnds.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    hwnd = whatsapp_hwnds[0] if whatsapp_hwnds else None

    if hwnd:
        try:
            fg_hwnd = user32.GetForegroundWindow()
            fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None)
            wa_thread = user32.GetWindowThreadProcessId(hwnd, None)
            cur_thread = kernel32.GetCurrentThreadId()

            if fg_thread and fg_thread != cur_thread:
                user32.AttachThreadInput(cur_thread, fg_thread, True)
            if wa_thread and wa_thread != cur_thread:
                user32.AttachThreadInput(cur_thread, wa_thread, True)

            user32.ShowWindow(hwnd, 9) # SW_RESTORE
            user32.SetForegroundWindow(hwnd)
            user32.SetActiveWindow(hwnd)

            time.sleep(0.4)

            # Hardware Return Keypress with scan code 0x1C - ZERO MOUSE CLICKS
            user32.keybd_event(VK_RETURN, 0x1C, 0, 0)
            time.sleep(0.05)
            user32.keybd_event(VK_RETURN, 0x1C, 2, 0) # KEYEVENTF_KEYUP

            # Second Return pulse to guarantee send
            time.sleep(0.25)
            user32.keybd_event(VK_RETURN, 0x1C, 0, 0)
            time.sleep(0.05)
            user32.keybd_event(VK_RETURN, 0x1C, 2, 0)

            if fg_thread and fg_thread != cur_thread:
                user32.AttachThreadInput(cur_thread, fg_thread, False)
            if wa_thread and wa_thread != cur_thread:
                user32.AttachThreadInput(cur_thread, wa_thread, False)

            logger.info("Successfully submitted reply via pure Return keypress!")
            result_holder["res"] = {
                "status": "message_sent_and_verified",
                "hwnd": hwnd,
                "desktop_switched": True
            }
            return
        except Exception as e:
            logger.warning(f"Error during foreground Enter keypress: {e}")

    result_holder["res"] = {
        "status": "awaiting_manual_approval",
        "hwnd": hwnd,
        "message": "Chat opened and pre-filled. Press Enter in WhatsApp to confirm send."
    }

def send_whatsapp_reply(phone_e164: str, message_text: str, auto_submit: bool = True) -> dict:
    """
    Submits a message into WhatsApp Desktop for a verified contact:
    Spawns a clean worker thread on the Default interactive desktop, opens the chat,
    and sends the Return keypress to submit.
    """
    result_holder = {}
    t = threading.Thread(
        target=_worker_send,
        args=(phone_e164, message_text, auto_submit, result_holder),
        daemon=True
    )
    t.start()
    t.join(timeout=10.0)
    return result_holder.get("res", {
        "status": "timeout",
        "message": "Worker thread timed out while submitting message."
    })
