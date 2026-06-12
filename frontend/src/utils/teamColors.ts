export const nationalTeamColors: Record<string, string> = {
  'ALGERIA': '#006233',
  'ARGENTINA': '#43A1D5',
  'AUSTRALIA': '#FFCD00',
  'AUSTRIA': '#ED2939',
  'BANGLADESH': '#006A4E',
  'BELGIUM': '#E30613',
  'BOSNIA & HERZEGOVINA': '#002395',
  'BRAZIL': '#009B3A',
  'CANADA': '#FF0000',
  'CAPE VERDE': '#003893',
  'COLOMBIA': '#FCD116',
  'CROATIA': '#FF0000',
  'CURAÇAO': '#002B7F',
  'CZECH REPUBLIC': '#11457E',
  'DR CONGO': '#007FFF',
  'ECUADOR': '#FFD100',
  'EGYPT': '#CE1126',
  'ENGLAND': '#CE1124',
  'FRANCE': '#002395',
  'GERMANY': '#000000',
  'GHANA': '#006B3F',
  'HAITI': '#00209F',
  'INDIA': '#0000FF',
  'IRAN': '#239F40',
  'IRAQ': '#007A3D',
  'IRELAND': '#169B62',
  'IVORY COAST': '#FF8200',
  'JAPAN': '#000555',
  'JORDAN': '#CE1126',
  'MEXICO': '#006847',
  'MOROCCO': '#C1272D',
  'NETHERLANDS': '#FF4F00',
  'NEW ZEALAND': '#000000',
  'NORWAY': '#BA0C2F',
  'PAKISTAN': '#01411C',
  'PANAMA': '#C8102E',
  'PARAGUAY': '#D52B1E',
  'PORTUGAL': '#FF0000',
  'QATAR': '#8A1538',
  'SAUDI ARABIA': '#006C35',
  'SCOTLAND': '#0065BF',
  'SENEGAL': '#00853F',
  'SOUTH AFRICA': '#007749',
  'SOUTH KOREA': '#C60C30',
  'SPAIN': '#AA151B',
  'SRI LANKA': '#012169',
  'SWEDEN': '#006AA7',
  'SWITZERLAND': '#FF0000',
  'TUNISIA': '#E70013',
  'TURKEY': '#E30A17',
  'USA': '#3C3B6E',
  'URUGUAY': '#0038A8',
  'UZBEKISTAN': '#0099B5',
  'WEST INDIES': '#7B0041',
};

export const teamColors: Record<string, string> = {
  MI: '#004BA0',
  CSK: '#F4C430',
  RCB: '#CC0000',
  KKR: '#552583',
  DC: '#0078BC',
  RR: '#E91E8C',
  PBKS: '#AA0000',
  SRH: '#FF6600',
  GT: '#1B6CA8',
  LSG: '#00ADEF',
};

export const accessibleTeamColors: Record<string, string> = {
  MI: '#60A5FA',
  CSK: '#F4C430',
  RCB: '#F87171',
  KKR: '#C084FC',
  DC: '#60A5FA',
  RR: '#F472B6',
  PBKS: '#F87171',
  SRH: '#FB923C',
  GT: '#2DD4BF',
  LSG: '#38BDF8',
};

export const getAccessibleTeamTextColor = (teamName: string | null | undefined) => {
  if (teamName === undefined || teamName === null) return '#ffffff';
  const teamStr = String(teamName);
  const normalized = teamStr.trim().toUpperCase();
  if (normalized === 'DRAW' || normalized === 'TIE') return '#94A3B8'; // Slate 400
  
  // 1. Direct lookup
  if (accessibleTeamColors[normalized]) return accessibleTeamColors[normalized];
  
  // 2. Initials lookup
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (accessibleTeamColors[initials]) return accessibleTeamColors[initials];
  }
  
  // 3. Partial match
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
    if (normalized.includes(key)) return accessibleTeamColors[value];
  }

  // 4. National team lookup
  if (nationalTeamColors[normalized]) return nationalTeamColors[normalized];
  
  return '#ffffff';
};

export const getTeamColor = (teamName: string | null | undefined) => {
  if (teamName === undefined || teamName === null) return '#ffffff';
  const teamStr = String(teamName);
  
  const normalized = teamStr.trim().toUpperCase();
  if (normalized === 'DRAW' || normalized === 'TIE') return '#475569'; // Slate 600
  
  // 1. Direct lookup (MI, CSK, etc)
  if (teamColors[normalized]) return teamColors[normalized];
  
  // 2. Initials lookup (Mumbai Indians -> MI)
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (teamColors[initials]) return teamColors[initials];
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
    if (normalized.includes(key)) return teamColors[value];
  }

  // 4. National team lookup
  if (nationalTeamColors[normalized]) return nationalTeamColors[normalized];

  return '#ffffff';
};

export const getTeamShortName = (teamName: string | null | undefined) => {
  if (teamName === undefined || teamName === null) return '';
  const teamStr = String(teamName);
  const normalized = teamStr.trim().toUpperCase();
  if (teamColors[normalized]) return normalized;
  
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (teamColors[initials]) return initials;
  }
  
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
    if (normalized.includes(key)) return value;
  }
  return teamName;
};
