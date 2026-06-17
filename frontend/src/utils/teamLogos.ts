export const nationalTeamLogos: Record<string, string> = {
  'ALGERIA': 'https://flagcdn.com/w320/dz.png',
  'ARGENTINA': 'https://flagcdn.com/w320/ar.png',
  'AUSTRALIA': 'https://flagcdn.com/w320/au.png',
  'AUSTRIA': 'https://flagcdn.com/w320/at.png',
  'BANGLADESH': 'https://flagcdn.com/w320/bd.png',
  'BELGIUM': 'https://flagcdn.com/w320/be.png',
  'BOSNIA & HERZEGOVINA': 'https://flagcdn.com/w320/ba.png',
  'BRAZIL': 'https://flagcdn.com/w320/br.png',
  'CANADA': 'https://flagcdn.com/w320/ca.png',
  'CAPE VERDE': 'https://flagcdn.com/w320/cv.png',
  'COLOMBIA': 'https://flagcdn.com/w320/co.png',
  'CROATIA': 'https://flagcdn.com/w320/hr.png',
  'CURAÇAO': 'https://flagcdn.com/w320/cw.png',
  'CZECH REPUBLIC': 'https://flagcdn.com/w320/cz.png',
  'DR CONGO': 'https://flagcdn.com/w320/cd.png',
  'ECUADOR': 'https://flagcdn.com/w320/ec.png',
  'EGYPT': 'https://flagcdn.com/w320/eg.png',
  'ENGLAND': 'https://flagcdn.com/w320/gb-eng.png',
  'FRANCE': 'https://flagcdn.com/w320/fr.png',
  'GERMANY': 'https://flagcdn.com/w320/de.png',
  'GHANA': 'https://flagcdn.com/w320/gh.png',
  'HAITI': 'https://flagcdn.com/w320/ht.png',
  'INDIA': 'https://flagcdn.com/w320/in.png',
  'IRAN': 'https://flagcdn.com/w320/ir.png',
  'IRAQ': 'https://flagcdn.com/w320/iq.png',
  'IRELAND': 'https://flagcdn.com/w320/ie.png',
  'IVORY COAST': 'https://flagcdn.com/w320/ci.png',
  'JAPAN': 'https://flagcdn.com/w320/jp.png',
  'JORDAN': 'https://flagcdn.com/w320/jo.png',
  'MEXICO': 'https://flagcdn.com/w320/mx.png',
  'MOROCCO': 'https://flagcdn.com/w320/ma.png',
  'NETHERLANDS': 'https://flagcdn.com/w320/nl.png',
  'NEW ZEALAND': 'https://flagcdn.com/w320/nz.png',
  'NORWAY': 'https://flagcdn.com/w320/no.png',
  'PAKISTAN': 'https://flagcdn.com/w320/pk.png',
  'PANAMA': 'https://flagcdn.com/w320/pa.png',
  'PARAGUAY': 'https://flagcdn.com/w320/py.png',
  'PORTUGAL': 'https://flagcdn.com/w320/pt.png',
  'QATAR': 'https://flagcdn.com/w320/qa.png',
  'SAUDI ARABIA': 'https://flagcdn.com/w320/sa.png',
  'SCOTLAND': 'https://flagcdn.com/w320/gb-sct.png',
  'SENEGAL': 'https://flagcdn.com/w320/sn.png',
  'SOUTH AFRICA': 'https://flagcdn.com/w320/za.png',
  'SOUTH KOREA': 'https://flagcdn.com/w320/kr.png',
  'SPAIN': 'https://flagcdn.com/w320/es.png',
  'SRI LANKA': 'https://flagcdn.com/w320/lk.png',
  'SWEDEN': 'https://flagcdn.com/w320/se.png',
  'SWITZERLAND': 'https://flagcdn.com/w320/ch.png',
  'TUNISIA': 'https://flagcdn.com/w320/tn.png',
  'TURKEY': 'https://flagcdn.com/w320/tr.png',
  'USA': 'https://flagcdn.com/w320/us.png',
  'URUGUAY': 'https://flagcdn.com/w320/uy.png',
  'UZBEKISTAN': 'https://flagcdn.com/w320/uz.png',
  'WEST INDIES': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Cricket_West_Indies_Logo_2017.svg/250px-Cricket_West_Indies_Logo_2017.svg.png',
};

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

export const getTeamLogo = (teamName: string | null | undefined): string | null => {
  if (!teamName) return null;
  const teamStr = String(teamName).trim().toUpperCase();
  
  // 1. National team lookup
  if (nationalTeamLogos[teamStr]) return nationalTeamLogos[teamStr];
  
  // 2. Direct lookup
  if (iplTeamLogos[teamStr]) return iplTeamLogos[teamStr];
  
  // 3. Initials lookup (Mumbai Indians -> MI)
  const words = teamStr.split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (iplTeamLogos[initials]) return iplTeamLogos[initials];
  }

  // 4. Partial match (Chennai -> CSK, etc)
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
