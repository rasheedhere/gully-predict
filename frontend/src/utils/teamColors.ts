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


export const nationalTeamAltColors: Record<string, string> = {
  'ALGERIA': '#D21034',
  'ARGENTINA': '#000080',
  'AUSTRALIA': '#008751',
  'AUSTRIA': '#000000',
  'BANGLADESH': '#F42A41',
  'BELGIUM': '#FFD200',
  'BOSNIA & HERZEGOVINA': '#FFCD00',
  'BRAZIL': '#002776',
  'CANADA': '#000000',
  'CAPE VERDE': '#CF0921',
  'COLOMBIA': '#003893',
  'CROATIA': '#1C3B8B',
  'CURAÇAO': '#F9E814',
  'CZECH REPUBLIC': '#D7141A',
  'DR CONGO': '#F7D116',
  'ECUADOR': '#0033A0',
  'EGYPT': '#000000',
  'ENGLAND': '#5CBFEB',
  'FRANCE': '#ED2939',
  'GERMANY': '#008000',
  'GHANA': '#FCD116',
  'HAITI': '#D21034',
  'INDIA': '#FF8200',
  'IRAN': '#DA0000',
  'IRAQ': '#000000',
  'IRELAND': '#FF883E',
  'IVORY COAST': '#009E60',
  'JAPAN': '#FF007F',
  'JORDAN': '#000000',
  'MEXICO': '#CE1126',
  'MOROCCO': '#006233',
  'NETHERLANDS': '#0000FF',
  'NEW ZEALAND': '#00BFFF',
  'NORWAY': '#00205B',
  'PAKISTAN': '#81C784',
  'PANAMA': '#00205B',
  'PARAGUAY': '#0038A8',
  'PORTUGAL': '#006600',
  'QATAR': '#F2A900',
  'SAUDI ARABIA': '#D4AF37',
  'SCOTLAND': '#FFC000',
  'SENEGAL': '#FDEF42',
  'SOUTH AFRICA': '#FFB81C',
  'SOUTH KOREA': '#003478',
  'SPAIN': '#F1BF00',
  'SRI LANKA': '#FFBE00',
  'SWEDEN': '#FECC00',
  'SWITZERLAND': '#A0A0A0',
  'TUNISIA': '#000000',
  'TURKEY': '#000000',
  'USA': '#B22234',
  'URUGUAY': '#000000',
  'UZBEKISTAN': '#1EB53A',
  'WEST INDIES': '#F2A900',
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

const getPrimaryAccessibleTeamTextColor = (teamName: string | null | undefined) => {
  if (teamName === undefined || teamName === null) return '#ffffff';
  const teamStr = String(teamName);
  const normalized = teamStr.trim().toUpperCase();
  if (normalized === 'DRAW' || normalized === 'TIE') return '#94A3B8';
  if (accessibleTeamColors[normalized]) return accessibleTeamColors[normalized];
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (accessibleTeamColors[initials]) return accessibleTeamColors[initials];
  }
  const teamMapping: Record<string, string> = {
    'MUMBAI': 'MI', 'CHENNAI': 'CSK', 'BANGALORE': 'RCB', 'BENGALURU': 'RCB',
    'KOLKATA': 'KKR', 'DELHI': 'DC', 'RAJASTHAN': 'RR', 'PUNJAB': 'PBKS',
    'HYDERABAD': 'SRH', 'GUJARAT': 'GT', 'LUCKNOW': 'LSG'
  };
  for (const [key, value] of Object.entries(teamMapping)) {
    if (normalized.includes(key)) return accessibleTeamColors[value];
  }
  if (nationalTeamColors[normalized]) return nationalTeamColors[normalized];
  return '#ffffff';
};

export const getAccessibleTeamTextColor = (teamName: string | null | undefined, opponentName?: string | null) => {
  const primaryColor = getPrimaryAccessibleTeamTextColor(teamName);

  if (opponentName && teamName) {
    const normalizedTeam = String(teamName).trim().toUpperCase();
    const opponentPrimaryColor = getPrimaryAccessibleTeamTextColor(opponentName);
    const distance = getColorDistance(primaryColor, opponentPrimaryColor);

    if (distance < COLOR_DISTANCE_THRESHOLD) {
      const normalizedOpponent = String(opponentName).trim().toUpperCase();
      const thisHasAlt = !!nationalTeamAltColors[normalizedTeam];
      const opponentHasAlt = !!nationalTeamAltColors[normalizedOpponent];

      let shouldSwitch = false;
      if (thisHasAlt && !opponentHasAlt) {
        shouldSwitch = true;
      } else if (thisHasAlt && opponentHasAlt) {
        if (normalizedTeam > normalizedOpponent) {
          shouldSwitch = true;
        }
      }
      if (shouldSwitch) {
         return nationalTeamAltColors[normalizedTeam];
      }
    }
  }

  return primaryColor;
};

const COLOR_DISTANCE_THRESHOLD = 60;

const hexToRgb = (hexStr: string) => {
  if (!hexStr) return [0, 0, 0];
  const hex = hexStr.replace('#', '');
  if (hex.length !== 6) return [0, 0, 0];
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
};

export const getColorDistance = (hex1: string, hex2: string) => {
  if (!hex1 || !hex2) return 1000;
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const rmean = (r1 + r2) / 2;
  const r = r1 - r2;
  const g = g1 - g2;
  const b = b1 - b2;
  return Math.sqrt((((512 + rmean) * r * r) / 256) + 4 * g * g + (((767 - rmean) * b * b) / 256));
};

const getPrimaryTeamColor = (teamName: string | null | undefined) => {
  if (teamName === undefined || teamName === null) return '#ffffff';
  const teamStr = String(teamName);
  const normalized = teamStr.trim().toUpperCase();
  if (normalized === 'DRAW' || normalized === 'TIE') return '#475569';
  if (teamColors[normalized]) return teamColors[normalized];
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (teamColors[initials]) return teamColors[initials];
  }
  const teamMapping: Record<string, string> = {
    'MUMBAI': 'MI', 'CHENNAI': 'CSK', 'BANGALORE': 'RCB', 'BENGALURU': 'RCB',
    'KOLKATA': 'KKR', 'DELHI': 'DC', 'RAJASTHAN': 'RR', 'PUNJAB': 'PBKS',
    'HYDERABAD': 'SRH', 'GUJARAT': 'GT', 'LUCKNOW': 'LSG'
  };
  for (const [key, value] of Object.entries(teamMapping)) {
    if (normalized.includes(key)) return teamColors[value];
  }
  if (nationalTeamColors[normalized]) return nationalTeamColors[normalized];
  return '#ffffff';
};

export const getTeamColor = (teamName: string | null | undefined, opponentName?: string | null) => {
  const primaryColor = getPrimaryTeamColor(teamName);

  if (opponentName && teamName) {
    const normalizedTeam = String(teamName).trim().toUpperCase();
    const opponentPrimaryColor = getPrimaryTeamColor(opponentName);
    const distance = getColorDistance(primaryColor, opponentPrimaryColor);

    if (distance < COLOR_DISTANCE_THRESHOLD) {
      const normalizedOpponent = String(opponentName).trim().toUpperCase();
      const thisHasAlt = !!nationalTeamAltColors[normalizedTeam];
      const opponentHasAlt = !!nationalTeamAltColors[normalizedOpponent];

      let shouldSwitch = false;
      if (thisHasAlt && !opponentHasAlt) {
        shouldSwitch = true;
      } else if (thisHasAlt && opponentHasAlt) {
        if (normalizedTeam > normalizedOpponent) {
          shouldSwitch = true;
        }
      }
      if (shouldSwitch) {
         return nationalTeamAltColors[normalizedTeam];
      }
    }
  }

  return primaryColor;
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
