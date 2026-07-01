import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.router.admin_router import sql_assistant_session_chat, SQLAssistantRequest
from backend.models import User, AdminChatSession, AdminChatMessage

class MockTx:
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class TestSQLAssistantCharts(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Create a mock admin user
        self.mock_admin = User(id="admin-123", is_admin=True)
        
        # Create mock DB session
        self.mock_db = AsyncMock()
        self.mock_db.in_transaction.return_value = False
        
        # Mock bind.url to contain sqlite to avoid Postgres transaction setup calls
        self.mock_db.bind.url = "sqlite://"
        
        # Mock transaction context managers properly
        self.mock_db.begin = MagicMock(return_value=MockTx())
        self.mock_db.begin_nested = MagicMock(return_value=MockTx())

    @patch("backend.utils.llm_client.GeminiLLMClient")
    @patch("backend.router.admin_router.backend_cache")
    @patch("backend.utils.sql_assistant_registry.get_db_schema_context")
    async def test_chart_recommendation_no_results(self, mock_get_schema, mock_cache, mock_llm_class):
        mock_get_schema.return_value = "Mocked schema"
        # 0 rows returned -> should not call LLM for chart and should return 'none' chart type
        mock_llm = MagicMock()
        mock_llm.generate_chat_response = AsyncMock(return_value="SELECT * FROM matches;")
        mock_llm.generate_text = AsyncMock(return_value="Summary of findings")
        mock_llm_class.return_value = mock_llm

        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        # Mock database execute returning empty list
        mock_res = MagicMock()
        mock_res.returns_rows = True
        mock_res.all.return_value = []
        self.mock_db.execute.return_value = mock_res

        # Mock AdminChatSession creation/fetch
        mock_session = AdminChatSession(id=1, user_id="admin-123", title="Test query")
        self.mock_db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: mock_session)), # Session check
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),           # Message history
            mock_res                                                         # SQL execution
        ]

        payload = SQLAssistantRequest(query="how many matches are there?")
        response = await sql_assistant_session_chat(
            session_id="1",
            payload=payload,
            db=self.mock_db,
            current_admin=self.mock_admin
        )

        # Assert no chart generation LLM call (generate_text is only called for summary)
        mock_llm.generate_text.assert_called_once()
        self.assertEqual(response.chart_config["chart_type"], "none")
        self.assertIsNone(response.chart_config["x_key"])
        self.assertIsNone(response.chart_config["y_key"])

    @patch("backend.utils.llm_client.GeminiLLMClient")
    @patch("backend.router.admin_router.backend_cache")
    @patch("backend.utils.sql_assistant_registry.get_db_schema_context")
    async def test_chart_recommendation_single_result(self, mock_get_schema, mock_cache, mock_llm_class):
        mock_get_schema.return_value = "Mocked schema"
        # 1 row returned -> should not call LLM for chart and should return 'none' chart type
        mock_llm = MagicMock()
        mock_llm.generate_chat_response = AsyncMock(return_value="SELECT count(*) FROM matches;")
        mock_llm.generate_text = AsyncMock(return_value="There is 1 match.")
        mock_llm_class.return_value = mock_llm

        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        # Mock database execute returning 1 row
        mock_row = MagicMock()
        mock_row._mapping = {"count": 1}
        mock_res = MagicMock()
        mock_res.returns_rows = True
        mock_res.all.return_value = [mock_row]
        self.mock_db.execute.return_value = mock_res

        # Mock AdminChatSession creation/fetch
        mock_session = AdminChatSession(id=1, user_id="admin-123", title="Test query")
        self.mock_db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: mock_session)), # Session check
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),           # Message history
            mock_res                                                         # SQL execution
        ]

        payload = SQLAssistantRequest(query="how many matches are there?")
        response = await sql_assistant_session_chat(
            session_id="1",
            payload=payload,
            db=self.mock_db,
            current_admin=self.mock_admin
        )

        # Assert no chart generation LLM call (generate_text is only called for summary)
        mock_llm.generate_text.assert_called_once()
        self.assertEqual(response.chart_config["chart_type"], "none")

    @patch("backend.utils.llm_client.GeminiLLMClient")
    @patch("backend.router.admin_router.backend_cache")
    @patch("backend.utils.sql_assistant_registry.get_db_schema_context")
    async def test_chart_recommendation_multiple_results(self, mock_get_schema, mock_cache, mock_llm_class):
        mock_get_schema.return_value = "Mocked schema"
        # > 1 row returned -> should call LLM for chart recommendation and parse it
        mock_llm = MagicMock()
        mock_llm.generate_chat_response = AsyncMock(return_value="SELECT name, sport FROM tournaments;")
        mock_llm.generate_text = AsyncMock()
        # generate_text will be called twice: first for summary, second for chart config recommendation
        mock_llm.generate_text.side_effect = [
            "Summary of tournaments",
            '{"chart_type": "bar", "x_key": "name", "y_key": "sport"}'
        ]
        mock_llm_class.return_value = mock_llm

        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        # Mock database execute returning 2 rows
        mock_row1 = MagicMock()
        mock_row1._mapping = {"name": "IPL 2026", "sport": "cricket"}
        mock_row2 = MagicMock()
        mock_row2._mapping = {"name": "FIFA 2026", "sport": "football"}
        mock_res = MagicMock()
        mock_res.returns_rows = True
        mock_res.all.return_value = [mock_row1, mock_row2]
        self.mock_db.execute.return_value = mock_res

        # Mock AdminChatSession creation/fetch
        mock_session = AdminChatSession(id=1, user_id="admin-123", title="Test query")
        self.mock_db.execute.side_effect = [
            MagicMock(scalars=lambda: MagicMock(first=lambda: mock_session)), # Session check
            MagicMock(scalars=lambda: MagicMock(all=lambda: [])),           # Message history
            mock_res                                                         # SQL execution
        ]

        payload = SQLAssistantRequest(query="list tournaments")
        response = await sql_assistant_session_chat(
            session_id="1",
            payload=payload,
            db=self.mock_db,
            current_admin=self.mock_admin
        )

        # Assert generate_text was called twice (once for summary, once for chart recommendation)
        self.assertEqual(mock_llm.generate_text.call_count, 2)
        self.assertEqual(response.chart_config["chart_type"], "bar")
        self.assertEqual(response.chart_config["x_key"], "name")
        self.assertEqual(response.chart_config["y_key"], "sport")
