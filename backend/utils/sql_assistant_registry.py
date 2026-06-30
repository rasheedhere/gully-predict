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
        "report_method": "Method used to report match results, e.g. 'telegram', 'manual', 'api', 'agent'."
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
    }
}

def get_db_schema_context() -> str:
    """
    Dynamically aggregates and formats allowed tables, columns, constraints,
    foreign keys, and annotations into a clean textual prompt context.
    """
    allowed_tables = {
        "tournaments", "matches", "announcements", "campaigns", 
        "campaign_questions", "campaign_responses", "campaign_results", 
        "leaderboard_entries", "match_stats"
    }
    
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
            
    return "\n".join(lines)
