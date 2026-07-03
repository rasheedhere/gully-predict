import unittest
from unittest.mock import AsyncMock, patch
from backend.utils.llm_client import log_llm_call
from backend.models import LLMCallLog

class TestLLMLogging(unittest.IsolatedAsyncioTestCase):
    @patch('backend.database.async_session')
    async def test_log_llm_call_success(self, mock_session_maker):
        # Setup mock db session
        mock_session = AsyncMock()
        mock_session_maker.return_value = mock_session
        mock_session.__aenter__.return_value = mock_session
        
        # Invoke helper
        await log_llm_call(
            caller="test_caller",
            tournament_id="test_tournament",
            prompt="Hello world",
            system_instruction="Be helpful",
            input_tokens=10,
            output_tokens=20,
            response_time_ms=100,
            raw_request={"prompt": "Hello world"},
            raw_response={"text": "Hi"},
            model="gemini-2.5-flash"
        )
        
        # Verify database insert was called
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
        
        # Verify model details
        added_log = mock_session.add.call_args[0][0]
        self.assertIsInstance(added_log, LLMCallLog)
        self.assertEqual(added_log.caller, "test_caller")
        self.assertEqual(added_log.tournament_id, "test_tournament")
        self.assertEqual(added_log.model, "gemini-2.5-flash")
        self.assertEqual(added_log.prompt, "Hello world")
        self.assertEqual(added_log.system_instruction, "Be helpful")
        self.assertEqual(added_log.input_tokens, 10)
        self.assertEqual(added_log.output_tokens, 20)
        self.assertEqual(added_log.response_time_ms, 100)
        self.assertEqual(added_log.raw_request, {"prompt": "Hello world"})
        self.assertEqual(added_log.raw_response, {"text": "Hi"})
