import random

ADJECTIVES = [
    "Royal", "Mighty", "Swift", "Bold", "Fiery", "Cool", "Epic", "Grand", 
    "Golden", "Silver", "Rising", "Super", "Ultra", "Mega", "Alpha", "Omega"
]

NOUNS = [
    "Striker", "Hitter", "Bowler", "Spinner", "Fielder", "Keeper", "Captain", 
    "Sixer", "Fourster", "Googly", "Yorker", "Bouncer", "Doosra", "Slugger",
    "Opener", "Finisher", "Expert", "Champ", "Hero", "Legend"
]

def generate_random_alias() -> str:
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(10, 999)
    return f"{adj}{noun}{num}"
