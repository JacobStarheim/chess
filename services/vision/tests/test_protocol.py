import unittest

from vision_worker.protocol import WorkerMessage, make_error, make_result


class ProtocolTests(unittest.TestCase):
    def test_worker_message_parses_json(self) -> None:
        message = WorkerMessage.from_json('{"id":"abc","method":"ping","params":{"a":1}}')
        self.assertEqual(message.id, "abc")
        self.assertEqual(message.method, "ping")
        self.assertEqual(message.params, {"a": 1})

    def test_make_result_and_error(self) -> None:
        self.assertIn('"result"', make_result("1", {"ok": True}))
        self.assertIn('"error"', make_error("1", "boom"))


if __name__ == "__main__":
    unittest.main()
