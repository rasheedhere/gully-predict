import sqlglot
from sqlglot import exp, parse_one, ParseError
from sqlglot.optimizer.scope import build_scope
from backend.utils.sql_assistant_registry import ALLOWED_TABLES

def validate_and_sanitize_sql(sql: str) -> str:
    """
    Parses the query using sqlglot, enforces it is strictly a single SELECT query,
    validates that each referenced table belongs to ALLOWED_TABLES,
    and automatically injects/caps a LIMIT 100 clause.
    """
    # 1. Check for empty or blank query
    if not sql or not sql.strip():
        raise ValueError("Query cannot be empty.")

    # 2. Parse using sqlglot to check for syntax errors and multiple statements
    try:
        statements = sqlglot.parse(sql, read="postgres")
    except ParseError as e:
        raise ValueError(f"Invalid SQL syntax: {str(e)}")

    if not statements:
        raise ValueError("No valid SQL statement found.")
    if len(statements) > 1:
        raise ValueError("Multi-statement queries are strictly prohibited.")

    # 3. Parse a single statement AST
    try:
        parsed = parse_one(sql, read="postgres")
    except ParseError as e:
        raise ValueError(f"Invalid SQL syntax: {str(e)}")

    # 4. Enforce SELECT only
    if not isinstance(parsed, exp.Select):
        raise ValueError("Only SELECT queries are allowed.")

    # 5. Validate tables against ALLOWED_TABLES using scope traversal
    try:
        root_scope = build_scope(parsed)
        for scope in root_scope.traverse():
            for alias, (node, source) in scope.selected_sources.items():
                if isinstance(source, exp.Table):
                    table_name = source.name.lower()
                    if table_name not in ALLOWED_TABLES:
                        raise ValueError(f"Table '{table_name}' is not in the allowed tables list.")
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        # Fallback to direct Table AST node check if build_scope fails for any reason
        for table in parsed.find_all(exp.Table):
            table_name = table.name.lower()
            if table_name not in ALLOWED_TABLES:
                raise ValueError(f"Table '{table_name}' is not in the allowed tables list.")

    # 6. Apply or cap LIMIT 100
    limit_clause = parsed.args.get("limit")
    if limit_clause is None:
        parsed = parsed.limit(100)
    else:
        try:
            limit_val = int(limit_clause.expression.this)
            if limit_val > 100 or limit_val < 0:
                parsed.set("limit", exp.Limit(expression=exp.Literal.number(100)))
        except (ValueError, TypeError, AttributeError):
            parsed.set("limit", exp.Limit(expression=exp.Literal.number(100)))

    return parsed.sql(dialect="postgres")
