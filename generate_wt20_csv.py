import json
import csv
from datetime import datetime

with open('wt20-2026.json', 'r') as f:
    data = json.load(f)

matches = data.get('data', {}).get('matches', [])

with open('wt20-2026-matches.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['id', 'team1', 'team2', 'venue', 'start_time'])
    
    for i, match in enumerate(matches):
        match_id = f"WT20-2026-{str(i+1).zfill(2)}"
        
        team1 = match.get('teama', '')
        team2 = match.get('teamb', '')
        venue = match.get('venue', '')
        
        date_str = match.get('match_date_gmt', '')
        time_str = match.get('match_time_gmt', '')
        
        start_time = ""
        if date_str and time_str:
            try:
                # Handle single digit months/days as well with %m/%d/%Y
                dt = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%Y %H:%M")
                start_time = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                # Fallback if the format is different
                start_time = f"{date_str}T{time_str}Z"
            
        writer.writerow([match_id, team1, team2, venue, start_time])

print("CSV generated successfully!")
