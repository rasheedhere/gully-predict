import unittest
from unittest.mock import AsyncMock, MagicMock
from backend.utils.sql_assistant_registry import get_db_schema_context
from sqlalchemy.sql.selectable import Select

class TestSQLAssistantGrounding(unittest.IsolatedAsyncioTestCase):
    async def test_get_db_schema_context_grounding_empty(self):
        # Setup mock db session returning no tournaments and no tournament questions
        mock_db = AsyncMock()
        mock_result_tournaments = MagicMock()
        mock_result_tournaments.all.return_value = []
        
        mock_result_questions = MagicMock()
        mock_result_questions.all.return_value = []
        
        # side_effect to return tournaments result on first call, questions on second call
        mock_db.execute.side_effect = [mock_result_tournaments, mock_result_questions]

        context = await get_db_schema_context(mock_db)
        
        # Verify tournament names header is not in the context
        self.assertNotIn("Available tournaments in the database:", context)
        
        # Verify db.execute was called twice
        self.assertEqual(mock_db.execute.call_count, 2)

    async def test_get_db_schema_context_grounding_with_tournaments_and_questions(self):
        # Setup mock db session returning tournaments and questions
        mock_db = AsyncMock()
        
        mock_result_tournaments = MagicMock()
        mock_result_tournaments.all.return_value = [("IPL 2026",), ("FIFA World Cup 2026",)]
        
        mock_result_questions = MagicMock()
        mock_result_questions.all.return_value = [
            ("match_winner", "Who will win the match?", "multiple_choice"),
            ("ppscore_team1", "Powerplay score for team 1?", "free_number")
        ]
        
        mock_db.execute.side_effect = [mock_result_tournaments, mock_result_questions]

        context = await get_db_schema_context(mock_db)

        # Verify tournament names are present in the context
        self.assertIn("Available tournaments in the database:", context)
        self.assertIn("'IPL 2026'", context)
        self.assertIn("'FIFA World Cup 2026'", context)

        # Verify dynamic tournament question keys are added to matches.raw_result_json
        self.assertIn("'match_winner' (str): Who will win the match?", context)
        self.assertIn("'ppscore_team1' (int): Powerplay score for team 1?", context)

    async def test_get_db_schema_context_handles_database_exceptions_gracefully(self):
        # Setup mock db session throwing exception on execute
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database is down")

        # Calling the function should not raise an exception
        context = await get_db_schema_context(mock_db)
        
        # It should still output the schema context fallback/database structure
        self.assertIn("The database has the following tables and schemas:", context)
        self.assertNotIn("Available tournaments in the database:", context)
