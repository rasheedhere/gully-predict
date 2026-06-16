import random
from typing import Any, List, Dict, Optional
from backend.models import Match, Campaign, CampaignQuestion

class MatchPredictionContext:
    def __init__(
        self,
        match: Match,
        winner: str,
        loser: str,
        favored_team: str,
        simulated_stats: Optional[Dict[str, Any]] = None
    ):
        self.match = match
        self.winner = winner          # e.g., "Argentina" or "Draw"
        self.loser = loser            # e.g., "Algeria"
        self.favored_team = favored_team  # e.g. "Argentina"
        self.simulated_stats = simulated_stats or {}

class SportPredictionEngine:
    def simulate_match_context(
        self,
        match: Match,
        r1: int,
        r2: int,
        winner: str,
        actual_winner_or_draw: str,
        favored_team: str,
        loser: str
    ) -> MatchPredictionContext:
        raise NotImplementedError()

    def predict_question(
        self,
        question: CampaignQuestion,
        context: MatchPredictionContext,
        bias_prob: float
    ) -> Any:
        raise NotImplementedError()


class CricketPredictionEngine(SportPredictionEngine):
    def simulate_match_context(
        self,
        match: Match,
        r1: int,
        r2: int,
        winner: str,
        actual_winner_or_draw: str,
        favored_team: str,
        loser: str
    ) -> MatchPredictionContext:
        # For cricket, simulate average powerplay scores and sixes
        t1_avg = max(45, min(75, 60 + (r2 - r1) * 0.5))
        t2_avg = max(45, min(75, 60 + (r1 - r2) * 0.5))
        
        simulated_stats = {
            "powerplay_t1": str(int(t1_avg + random.randint(-5, 5))),
            "powerplay_t2": str(int(t2_avg + random.randint(-5, 5))),
            "sixes_t1": random.choices([0, 1, 2, 3], weights=[0.1, 0.4, 0.3, 0.2])[0],
            "sixes_t2": random.choices([0, 1, 2, 3], weights=[0.1, 0.4, 0.3, 0.2])[0]
        }
        return MatchPredictionContext(match, actual_winner_or_draw, loser, favored_team, simulated_stats)

    def predict_question(
        self,
        q: CampaignQuestion,
        context: MatchPredictionContext,
        bias_prob: float
    ) -> Any:
        match = context.match
        t1, t2 = match.team1, match.team2
        opts = [o.replace("{{Team1}}", t1).replace("{{team1}}", t1).replace("{{TEAM1}}", t1)
                 .replace("{{Team2}}", t2).replace("{{team2}}", t2).replace("{{TEAM2}}", t2)
                 for o in q.options] if q.options else []
        qtype = q.question_type
        key = q.key or ""
        text = (q.question_text or "").lower()

        fav_team = context.favored_team if random.random() < bias_prob else context.loser

        # 1. Match Winner specific
        if key == "match_winner" or "winner" in key:
            if context.winner == "Draw" and any("draw" in o.lower() for o in opts):
                return next((o for o in opts if "draw" in o.lower()), "Draw")
            elif fav_team in opts:
                return fav_team
            elif opts:
                return random.choice(opts)

        # 2. Powerplay specific
        elif "powerplay" in key or "powerplay" in text:
            if t1.lower() in text or "team1" in text:
                return context.simulated_stats.get("powerplay_t1", "55")
            elif t2.lower() in text or "team2" in text:
                return context.simulated_stats.get("powerplay_t2", "55")
            else:
                return str(random.randint(45, 65))

        # 3. Sixes or Fours
        elif "six" in key or "six" in text:
            if fav_team in opts:
                return fav_team
            elif opts:
                return random.choice(opts)

        # 4. Player of the Match
        elif "potm" in key or "player" in text or "potm" in text:
            if qtype == "free_text":
                return f"Star Player ({fav_team})"
            elif fav_team in opts:
                return fav_team

        # 5. Generic options check
        elif fav_team in opts:
            return fav_team

        # 6. Fallback options
        if qtype == "dropdown" or qtype == "multiple_choice":
            return random.choice(opts) if opts else None
        elif qtype == "free_number":
            return str(random.randint(40, 60))
        elif qtype == "free_text":
            return fav_team
        elif qtype == "toggle":
            if set(o.lower() for o in opts) == {"yes", "no"}:
                yes_opt = next(o for o in opts if o.lower() == "yes")
                no_opt = next(o for o in opts if o.lower() == "no")
                return yes_opt if random.random() < 0.5 else no_opt
            return random.choice(opts) if opts else None
        
        return None


class FootballPredictionEngine(SportPredictionEngine):
    def simulate_match_context(
        self,
        match: Match,
        r1: int,
        r2: int,
        winner: str,
        actual_winner_or_draw: str,
        favored_team: str,
        loser: str
    ) -> MatchPredictionContext:
        t1, t2 = match.team1, match.team2
        
        if actual_winner_or_draw == "Draw":
            g = random.choices([0, 1, 2], weights=[0.40, 0.45, 0.15])[0]
            t1_goals = g
            t2_goals = g
        else:
            winner_goals = random.choices([1, 2, 3, 4], weights=[0.45, 0.35, 0.15, 0.05])[0]
            loser_goals = random.choices([0, 1, 2], weights=[0.55, 0.35, 0.10])[0]
            if loser_goals >= winner_goals:
                loser_goals = winner_goals - 1
            t1_goals = winner_goals if actual_winner_or_draw == t1 else loser_goals
            t2_goals = winner_goals if actual_winner_or_draw == t2 else loser_goals

        simulated_stats = {
            "goals_t1": t1_goals,
            "goals_t2": t2_goals
        }
        return MatchPredictionContext(match, actual_winner_or_draw, loser, favored_team, simulated_stats)

    def predict_question(
        self,
        q: CampaignQuestion,
        context: MatchPredictionContext,
        bias_prob: float
    ) -> Any:
        match = context.match
        t1, t2 = match.team1, match.team2
        opts = [o.replace("{{Team1}}", t1).replace("{{team1}}", t1).replace("{{TEAM1}}", t1)
                 .replace("{{Team2}}", t2).replace("{{team2}}", t2).replace("{{TEAM2}}", t2)
                 for o in q.options] if q.options else []
        qtype = q.question_type
        key = q.key or ""
        text = (q.question_text or "").lower()

        fav_team = context.favored_team if random.random() < bias_prob else context.loser
        t1_goals = context.simulated_stats.get("goals_t1", 0)
        t2_goals = context.simulated_stats.get("goals_t2", 0)

        # 1. Match Winner specific
        if key == "match_winner" or "winner" in key:
            if context.winner == "Draw" and any("draw" in o.lower() for o in opts):
                return next((o for o in opts if "draw" in o.lower()), "Draw")
            elif fav_team in opts:
                return fav_team
            elif opts:
                return random.choice(opts)

        # 2. Team-specific Goals
        elif key == "how_many_goals_team1":
            return str(t1_goals)
        elif key == "how_many_goals_team2":
            return str(t2_goals)

        # 3. First team to score
        elif key == "first_team_to_score":
            if t1_goals == 0 and t2_goals == 0 and any("no" in o.lower() for o in opts):
                return next((o for o in opts if "no" in o.lower()), "No Goals")
            elif t1_goals > 0 and t2_goals == 0:
                return t1
            elif t2_goals > 0 and t1_goals == 0:
                return t2
            elif fav_team in opts:
                return fav_team
            elif opts:
                return random.choice(opts)

        # 4. Yes/No Toggles
        elif qtype == "toggle" and set(o.lower() for o in opts) == {"yes", "no"}:
            yes_opt = next(o for o in opts if o.lower() == "yes")
            no_opt = next(o for o in opts if o.lower() == "no")
            if key == "both_teams_to_score":
                return yes_opt if (t1_goals > 0 and t2_goals > 0) else no_opt
            elif key == "will_a_penalty_be_awarded":
                return yes_opt if random.random() < 0.18 else no_opt
            elif key == "clean_sheet":
                opp_goals = t2_goals if fav_team == t1 else t1_goals
                return yes_opt if opp_goals == 0 else no_opt
            else:
                return yes_opt if random.random() < 0.5 else no_opt

        # 5. Team match options
        elif fav_team in opts:
            return fav_team

        # 6. Fallbacks by type
        if qtype == "dropdown" or qtype == "multiple_choice":
            return random.choice(opts) if opts else None
        elif qtype == "free_number":
            if "goal" in key or "goal" in text:
                return str(random.choices([0, 1, 2, 3], weights=[0.20, 0.50, 0.20, 0.10])[0])
            return str(random.randint(0, 3))
        elif qtype == "free_text":
            if key == "potm" or "potm" in key:
                return f"Star Player ({fav_team})"
            return fav_team
            
        return None


class DefaultPredictionEngine(SportPredictionEngine):
    def simulate_match_context(
        self,
        match: Match,
        r1: int,
        r2: int,
        winner: str,
        actual_winner_or_draw: str,
        favored_team: str,
        loser: str
    ) -> MatchPredictionContext:
        # Simple default simulation
        return MatchPredictionContext(match, actual_winner_or_draw, loser, favored_team, {"score_t1": 1, "score_t2": 0})

    def predict_question(
        self,
        q: CampaignQuestion,
        context: MatchPredictionContext,
        bias_prob: float
    ) -> Any:
        match = context.match
        t1, t2 = match.team1, match.team2
        opts = [o.replace("{{Team1}}", t1).replace("{{team1}}", t1).replace("{{TEAM1}}", t1)
                 .replace("{{Team2}}", t2).replace("{{team2}}", t2).replace("{{TEAM2}}", t2)
                 for o in q.options] if q.options else []
        qtype = q.question_type
        key = q.key or ""

        fav_team = context.favored_team if random.random() < bias_prob else context.loser

        if key == "match_winner" or "winner" in key:
            if context.winner == "Draw" and any("draw" in o.lower() for o in opts):
                return next((o for o in opts if "draw" in o.lower()), "Draw")
            elif fav_team in opts:
                return fav_team
            elif opts:
                return random.choice(opts)
        elif fav_team in opts:
            return fav_team
        elif qtype == "dropdown" or qtype == "multiple_choice":
            return random.choice(opts) if opts else None
        elif qtype == "free_number":
            return str(random.randint(0, 10))
        elif qtype == "free_text":
            return fav_team
        elif qtype == "toggle":
            if set(o.lower() for o in opts) == {"yes", "no"}:
                yes_opt = next(o for o in opts if o.lower() == "yes")
                no_opt = next(o for o in opts if o.lower() == "no")
                return yes_opt if random.random() < 0.5 else no_opt
            return random.choice(opts) if opts else None
        return None


class PredictionEngineRegistry:
    def __init__(self):
        self._engines: Dict[str, SportPredictionEngine] = {
            "cricket": CricketPredictionEngine(),
            "football": FootballPredictionEngine(),
            "soccer": FootballPredictionEngine(),
        }
        self._default = DefaultPredictionEngine()

    def get_engine(self, sport: str) -> SportPredictionEngine:
        if not sport:
            return self._default
        return self._engines.get(sport.lower(), self._default)

    def register_engine(self, sport: str, engine: SportPredictionEngine):
        self._engines[sport.lower()] = engine

prediction_engine_registry = PredictionEngineRegistry()
