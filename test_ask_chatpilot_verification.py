import unittest
import urllib.request
import json
import uuid

BASE_URL = "http://127.0.0.1:8000/api/assistant"

class TestAskChatPilotCompleteSuite(unittest.TestCase):

    def test_01_create_session(self):
        req = urllib.request.Request(f"{BASE_URL}/sessions", data=json.dumps({"title": "Test Suite Session"}).encode(), headers={"Content-Type": "application/json"})
        res = json.loads(urllib.request.urlopen(req).read().decode())
        self.assertIn("id", res)
        self.assertEqual(res["title"], "Test Suite Session")
        self.sid = res["id"]

    def test_02_send_and_persist_messages(self):
        # Create session
        req1 = urllib.request.Request(f"{BASE_URL}/sessions", data=json.dumps({"title": "Parveen Context Verification"}).encode(), headers={"Content-Type": "application/json"})
        session = json.loads(urllib.request.urlopen(req1).read().decode())
        sid = session["id"]

        # Send chat asking for latest reply
        prompt = "What was my last reply to Parveen and when did I send it?"
        req2 = urllib.request.Request(f"{BASE_URL}/sessions/{sid}/chat", data=json.dumps({"prompt": prompt}).encode(), headers={"Content-Type": "application/json"})
        chat_res = json.loads(urllib.request.urlopen(req2).read().decode())

        self.assertEqual(chat_res["role"], "assistant")
        self.assertIn("+91 93819 78123", chat_res["content"])
        self.assertIn("24 Nov 2026", chat_res["content"])
        self.assertTrue(chat_res.get("whatsapp_context") is not None)

        # Reload session messages
        req3 = urllib.request.Request(f"{BASE_URL}/sessions/{sid}/messages")
        messages = json.loads(urllib.request.urlopen(req3).read().decode())

        # Verify BOTH messages are visible and intact
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["role"], "user")
        self.assertEqual(messages[0]["content"], prompt)
        self.assertEqual(messages[1]["role"], "assistant")
        self.assertIn("+91 93819 78123", messages[1]["content"])

        # Switch to another session and return
        req4 = urllib.request.Request(f"{BASE_URL}/sessions", data=json.dumps({"title": "Second Session"}).encode(), headers={"Content-Type": "application/json"})
        session2 = json.loads(urllib.request.urlopen(req4).read().decode())
        sid2 = session2["id"]

        # Reopen original session
        req5 = urllib.request.Request(f"{BASE_URL}/sessions/{sid}/messages")
        original_msgs = json.loads(urllib.request.urlopen(req5).read().decode())
        self.assertEqual(len(original_msgs), 2)
        self.assertEqual(original_msgs[0]["content"], prompt)

        # Rename session
        req_rename = urllib.request.Request(f"{BASE_URL}/sessions/{sid}", data=json.dumps({"title": "Renamed Verified Session"}).encode(), headers={"Content-Type": "application/json"}, method="PATCH")
        renamed = json.loads(urllib.request.urlopen(req_rename).read().decode())
        self.assertEqual(renamed["title"], "Renamed Verified Session")

        # Delete session
        req_del = urllib.request.Request(f"{BASE_URL}/sessions/{sid2}", method="DELETE")
        del_res = json.loads(urllib.request.urlopen(req_del).read().decode())
        self.assertTrue(del_res["success"])

    def test_03_whatsapp_retrieval_service_direct(self):
        from services.whatsapp_retrieval_service import whatsapp_retrieval_service
        
        # Test Parveen resolution
        contact = whatsapp_retrieval_service.resolve_contact("Parveen")
        self.assertIsNotNone(contact)
        self.assertEqual(contact["display_name"], "Parveen")

        # Test latest outgoing reply retrieval
        outgoing = whatsapp_retrieval_service.get_latest_outgoing_reply(contact["id"])
        self.assertIsNotNone(outgoing)
        self.assertEqual(outgoing["direction"], "outgoing")
        self.assertEqual(outgoing["body"], "+91 93819 78123")
        self.assertEqual(outgoing["formatted_time"], "24 Nov 2026, 01:32 PM")

        # Test latest incoming message retrieval
        incoming = whatsapp_retrieval_service.get_latest_incoming_message(contact["id"])
        self.assertIsNotNone(incoming)
        self.assertEqual(incoming["direction"], "incoming")
        self.assertIn("Eppa varuviga", incoming["body"])

        # Test chronological ordering of recent messages
        recent = whatsapp_retrieval_service.get_recent_conversation_history(contact["id"], limit=6)
        self.assertGreater(len(recent), 0)
        # Verify chronological order (timestamps ascending)
        for i in range(len(recent) - 1):
            t1 = recent[i]["timestamp"]
            t2 = recent[i + 1]["timestamp"]
            if t1 and t2:
                self.assertLessEqual(t1, t2)

        # Test missing contact handling
        missing = whatsapp_retrieval_service.resolve_contact("NonExistentPerson123456")
        self.assertIsNone(missing)

if __name__ == "__main__":
    unittest.main()

