export const iplTeamLogos: Record<string, string> = {
  DC: 'https://documents.iplt20.com/ipl/DC/Logos/LogoOutline/DCoutline.png',
  GT: 'https://documents.iplt20.com/ipl/GT/Logos/Logooutline/GToutline.png',
  MI: 'https://documents.iplt20.com/ipl/MI/Logos/Logooutline/MIoutline.png',
  CSK: 'https://documents.iplt20.com/ipl/CSK/Logos/Logooutline/CSKoutline.png',
  RCB: 'https://documents.iplt20.com/ipl/RCB/Logos/Logooutline/RCBoutline.png',
  KKR: 'https://documents.iplt20.com/ipl/KKR/Logos/Logooutline/KKRoutline.png',
  RR: 'https://documents.iplt20.com/ipl/RR/Logos/Logooutline/RRoutline.png',
  PBKS: 'https://documents.iplt20.com/ipl/PBKS/Logos/Logooutline/PBKSoutline.png',
  SRH: 'https://documents.iplt20.com/ipl/SRH/Logos/Logooutline/SRHoutline.png',
  LSG: 'https://documents.iplt20.com/ipl/LSG/Logos/Logooutline/LSGoutline.png',
};

export const getTeamLogo = (teamName: any): string | null => {
  if (!teamName) return null;
  const teamStr = String(teamName).trim().toUpperCase();
  
  // 1. Direct lookup
  if (iplTeamLogos[teamStr]) return iplTeamLogos[teamStr];
  
  // 2. Initials lookup (Mumbai Indians -> MI)
  const words = teamStr.split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (iplTeamLogos[initials]) return iplTeamLogos[initials];
  }

  // 3. Partial match (Chennai -> CSK, etc)
  const teamMapping: Record<string, string> = {
    'MUMBAI': 'MI',
    'CHENNAI': 'CSK',
    'BANGALORE': 'RCB',
    'BENGALURU': 'RCB',
    'KOLKATA': 'KKR',
    'DELHI': 'DC',
    'RAJASTHAN': 'RR',
    'PUNJAB': 'PBKS',
    'HYDERABAD': 'SRH',
    'GUJARAT': 'GT',
    'LUCKNOW': 'LSG'
  };

  for (const [key, value] of Object.entries(teamMapping)) {
    if (teamStr.includes(key)) return iplTeamLogos[value];
  }

  return null;
};
