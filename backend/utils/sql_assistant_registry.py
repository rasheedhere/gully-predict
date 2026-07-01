import logging
from sqlalchemy import UniqueConstraint as SAUniqueConstraint
from backend.database import Base
# Import all models to ensure metadata is populated on Base.metadata
from backend import models

logger = logging.getLogger(__name__)

CUSTOM_FIELD_ANNOTATIONS = {
    "tournaments": {
        "status": "Tournament status: 'upcoming', 'active', or 'completed'.",
        "sport": "The sport name, e.g. 'cricket'.",
        "gender": "Gender category, e.g. 'mens', 'womens'."
    },
    "matches": {
        "status": "Match status: 'upcoming', 'live', 'completed', or 'cancelled'.",
        "report_method": "Method used to report match results, e.g. 'telegram', 'manual', 'api', 'agent'.",
        "raw_result_json": "JSON containing the actual graded answers/results of the match. Refer to the list of dynamic JSON keys at the end of this schema description to query specific keys."
    },
    "campaigns": {
        "type": "Campaign type: 'match' (match-specific) or 'general' (tournament-wide/non-match).",
        "status": "Campaign status: 'draft', 'active', or 'closed'.",
        "is_master": "Boolean indicating if this is the master tournament prediction campaign."
    },
    "campaign_questions": {
        "question_type": "The input type for the question: 'toggle', 'multiple_choice', 'dropdown', 'free_text', 'free_number'.",
        "options": "JSON array of options available for multiple choice / dropdown questions.",
        "scoring_rules": "JSON defining rules for scoring (e.g. points awarded for correct/incorrect answers)."
    },
    "campaign_responses": {
        "answers": "JSON dict mapping question keys or IDs to the user's answers.",
        "use_powerup": "Boolean indicating if the user applied a score multiplier/powerup on this response.",
        "is_auto_predicted": "Boolean indicating if this prediction was automatically generated."
    },
    "campaign_results": {
        "correct_answers": "JSON dict mapping campaign question keys or IDs to their correct answers."
    },
    "match_stats": {
        "stats_json": "JSON containing pre-match statistics for AI grounding."
    },
    "tournament_questions": {
        "key": "A stable string key for the question, e.g. 'match_winner', 'pp_team1', 'will_a_penalty_be_awarded'. Used to identify answers.",
        "question_text": "The natural language question presented to users.",
        "question_type": "The input type, e.g. 'multiple_choice', 'dropdown', 'toggle', 'free_text', 'free_number'."
    },
    "tournament_match_answers": {
        "correct_answers": "JSON dict mapping question keys (from tournament_questions.key) to their correct/graded answer values. E.g. '{\"match_winner\": \"France\", \"pp_team1\": 47}'."
    }
}

ALLOWED_TABLES = {
    "tournaments", "matches", "announcements", "campaigns", 
    "campaign_questions", "campaign_responses", "campaign_results", 
    "leaderboard_entries", "match_stats", "tournament_questions", 
    "tournament_match_answers"
}

from sqlalchemy.ext.asyncio import AsyncSession

async def get_db_schema_context(db: AsyncSession) -> str:
    """
    Dynamically aggregates and formats allowed tables, columns, constraints,
    foreign keys, and annotations into a clean textual prompt context.
    """
    # Fetch dynamic tournament question keys
    sport_keys = {}
    try:
        from backend.models import TournamentQuestion, Tournament
        from sqlalchemy import select
        stmt = select(TournamentQuestion.key, Tournament.sport).join(
            Tournament, TournamentQuestion.tournament_id == Tournament.id
        ).distinct()
        res = await db.execute(stmt)
        for key, sport in res.all():
            if key and sport:
                sport_keys.setdefault(sport.lower(), set()).add(key)
    except Exception as e:
        logger.error(f"Error fetching dynamic keys for schema: {e}")

    allowed_tables = ALLOWED_TABLES
    
    lines = []
    lines.append("The database has the following tables and schemas:")
    
    join_hints = set()
    table_index = 1
    
    for table_name in sorted(allowed_tables):
        if table_name not in Base.metadata.tables:
            logger.warning(f"Table '{table_name}' not found in Base.metadata.tables")
            continue
            
        table = Base.metadata.tables[table_name]
        lines.append(f"\n{table_index}. {table_name}:")
        table_index += 1
        
        # Format columns
        for column in table.columns:
            col_name = column.name
            col_type = str(column.type)
            
            attributes = []
            if column.primary_key:
                attributes.append("Primary Key")
                
            for fk in column.foreign_keys:
                target_table = fk.column.table.name
                if target_table in allowed_tables:
                    attributes.append(f"Foreign Key referencing {target_table}.{fk.column.name}")
                    join_hints.add(f"- {table_name}.{col_name} can be joined with {target_table}.{fk.column.name}")
            
            attr_str = f" ({', '.join(attributes)})" if attributes else ""
            
            # Custom field annotation
            annotation = ""
            if table_name in CUSTOM_FIELD_ANNOTATIONS and col_name in CUSTOM_FIELD_ANNOTATIONS[table_name]:
                annotation = f" - {CUSTOM_FIELD_ANNOTATIONS[table_name][col_name]}"
                
            lines.append(f"  - {col_name}: {col_type}{attr_str}{annotation}")
            
        # Collect and format table constraints (e.g. UniqueConstraints)
        table_constraints = []
        for constraint in table.constraints:
            if isinstance(constraint, SAUniqueConstraint):
                cols = [c.name for c in constraint.columns]
                # Only list composite unique constraints or distinct table-level unique constraints
                if len(cols) > 1:
                    table_constraints.append(f"UNIQUE ({', '.join(cols)})")
                    
        if table_constraints:
            lines.append("  Constraints:")
            for tc in sorted(table_constraints):
                lines.append(f"    - {tc}")
            
    if join_hints:
        lines.append("\nJOIN HINTS:")
        for hint in sorted(join_hints):
            lines.append(hint)
            
    # Add PostgreSQL JSON/JSONB guidelines
    lines.append("\nPostgreSQL JSON/JSONB Querying Guidelines:")
    lines.append("- For JSON fields (like `matches.raw_result_json`, `tournament_match_answers.correct_answers`, and `campaign_responses.answers`), use the PostgreSQL `->>` operator to extract key values as text.")
    lines.append("- Example: To get the match winner from `tournament_match_answers`, use: `correct_answers ->> 'match_winner'`.")
    lines.append("- Since database columns may be stored as JSON, cast to `jsonb` explicitly if using JSONB functions (e.g. `correct_answers::jsonb` or `raw_result_json::jsonb`).")
    lines.append("- Example query to find graded match results: `SELECT m.id, m.team1, m.team2, tma.correct_answers ->> 'match_winner' AS winner FROM matches m JOIN tournament_match_answers tma ON m.id = tma.match_id WHERE m.status = 'completed'`")

    # Add dynamic JSON keys at the very end to maximize KV Cache prefix hits
    lines.append("\nDynamic JSON Keys in `raw_result_json`, `correct_answers`, and `answers` fields based on active tournaments:")
    
    default_cricket = {"match_winner", "ppscore_team1", "ppscore_team2", "potm", "more_sixes", "more_fours", "dot_ball_team"}
    default_football = {"match_winner", "how_many_goals_team1", "how_many_goals_team2", "both_teams_to_score", "first_team_to_score", "clean_sheet", "total_goals", "team_with_ball_possession", "will_a_penalty_be_awarded"}
    
    cricket_keys = default_cricket.union(sport_keys.get("cricket", set()))
    football_keys = default_football.union(sport_keys.get("football", set()).union(sport_keys.get("soccer", set())))
    
    lines.append(f"- For cricket matches: {', '.join(repr(k) for k in sorted(cricket_keys))}")
    lines.append(f"- For football/soccer matches: {', '.join(repr(k) for k in sorted(football_keys))}")
    
    for sport, keys in sorted(sport_keys.items()):
        if sport not in ("cricket", "football", "soccer"):
            lines.append(f"- For {sport} matches: {', '.join(repr(k) for k in sorted(keys))}")

    return "\n".join(lines)
