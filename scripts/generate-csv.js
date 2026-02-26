const fs = require('fs');
const path = require('path');

const FIRST_NAMES_M = [
  'Jan','Petr','Tomáš','Martin','Lukáš','Jakub','David','Filip','Michal','Ondřej',
  'Marek','Pavel','Jiří','Adam','Šimon','Matěj','Vojtěch','Daniel','Radek','Josef',
  'Karel','Milan','Vladimír','Zdeněk','Jaroslav','Stanislav','Roman','Miroslav','František','Aleš',
  'Libor','Igor','Radim','Patrik','Dominik','Robert','Richard','Vlastimil','Antonín','Kamil',
];
const FIRST_NAMES_F = [
  'Anna','Marie','Eva','Kateřina','Lucie','Tereza','Barbora','Veronika','Hana','Alena',
  'Jana','Petra','Monika','Lenka','Markéta','Simona','Ivana','Martina','Klára','Zuzana',
  'Michaela','Kristýna','Nikola','Adéla','Eliška','Dagmar','Helena','Božena','Jitka','Renata',
  'Dana','Gabriela','Vladimíra','Pavlína','Soňa','Blanka','Olga','Marta','Věra','Irena',
];
const LAST_NAMES_M = [
  'Novák','Svoboda','Dvořák','Černý','Procházka','Kučera','Veselý','Horák','Němec','Pokorný',
  'Marek','Pospíšil','Hájek','Jelínek','Král','Růžička','Beneš','Fiala','Sedláček','Doležal',
  'Zeman','Kolář','Navrátil','Čermák','Vaněk','Kopecký','Šťastný','Kovář','Urban','Kratochvíl',
  'Bartoš','Vlček','Havlíček','Polák','Musil','Kadlec','Novotný','Říha','Holub','Kříž',
];
const LAST_NAMES_F = [
  'Nováková','Svobodová','Dvořáková','Černá','Procházková','Kučerová','Veselá','Horáková',
  'Němcová','Pokorná','Marková','Pospíšilová','Hájková','Jelínková','Králová','Růžičková',
  'Benešová','Fialová','Sedláčková','Doležalová','Zemanová','Kolářová','Navrátilová','Čermáková',
  'Vaňková','Kopecká','Šťastná','Kovářová','Urbanová','Kratochvílová','Bartošová','Vlčková',
  'Havlíčková','Poláková','Musilová','Kadlecová','Novotná','Říhová','Holubová','Křížová',
];

const JOB_TITLES = [
  'Specialista klientského servisu','Senior analytik','Projektový manažer','Bankéř',
  'Risk analytik','IT konzultant','Relationship Manager','Produktový manažer',
  'Compliance officer','Finanční poradce','Klientský poradce','HR Business Partner',
  'Data analytik','Marketingový specialista','Interní auditor','Softwarový inženýr',
  'Správce portfolia','Obchodní manažer','Účetní','Právník','Operátor call centra',
  'Pojistný matematik','Credit Officer','Manažer kvality','Bezpečnostní specialista',
];

const JOB_CODES = [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018,1019,1020,1021,1022,1023,1024,1025];

const L2_UNITS = [
  { code: 2001, short: 'RB', name: 'Retail banking' },
  { code: 2002, short: 'KB', name: 'Korporátní bankovnictví' },
  { code: 2003, short: 'RR', name: 'Řízení rizik' },
  { code: 2004, short: 'ITD', name: 'IT & Digitalizace' },
  { code: 2005, short: 'FIN', name: 'Finance a controlling' },
  { code: 2006, short: 'HR', name: 'Lidské zdroje' },
  { code: 2007, short: 'OP', name: 'Operace a back-office' },
  { code: 2008, short: 'LEG', name: 'Právní a compliance' },
];

const L3_MAP = {
  'Retail banking': ['Pobočková síť','Přímé bankovnictví','Klientský servis','Hypotéky'],
  'Korporátní bankovnictví': ['Firemní klienti','Velké korporace','Strukturované financování','Trade finance'],
  'Řízení rizik': ['Kreditní riziko','Operační riziko','Tržní riziko','Modelování rizik'],
  'IT & Digitalizace': ['Vývoj aplikací','Infrastruktura','Digitální produkty','Kybernetická bezpečnost'],
  'Finance a controlling': ['Účetnictví','Controlling','Treasury','Reporting'],
  'Lidské zdroje': ['Nábor','Rozvoj a vzdělávání','Mzdy a benefity','HR operations'],
  'Operace a back-office': ['Platební styk','Dokumentace','Centrální operace','Reklamace'],
  'Právní a compliance': ['Právní oddělení','Compliance','AML','Interní audit'],
};

const L4_UNITS = ['Tým Alpha','Tým Beta','Tým Gamma','Tým Delta','Tým Epsilon','Tým Zeta'];

const L2_HEADS = [
  { id: 'H2001', name: 'Ing. Karel Novotný' },
  { id: 'H2002', name: 'Mgr. Petra Říhová' },
  { id: 'H2003', name: 'Ing. Tomáš Bartoš' },
  { id: 'H2004', name: 'Ing. Lucie Marková' },
  { id: 'H2005', name: 'Ing. Jan Kratochvíl' },
  { id: 'H2006', name: 'Mgr. Alena Polášková' },
  { id: 'H2007', name: 'Ing. Roman Musil' },
  { id: 'H2008', name: 'JUDr. David Šimek' },
];

const L3_HEADS = [
  { id: 'H3001', name: 'Mgr. Jana Veselá' },{ id: 'H3002', name: 'Ing. Pavel Kříž' },
  { id: 'H3003', name: 'Ing. Martin Holub' },{ id: 'H3004', name: 'Mgr. Eva Pokorná' },
  { id: 'H3005', name: 'Ing. Michal Kadlec' },{ id: 'H3006', name: 'Mgr. Barbora Fialová' },
  { id: 'H3007', name: 'Ing. Radek Bartoň' },{ id: 'H3008', name: 'Mgr. Klára Dvořáčková' },
];

const L4_HEADS = [
  { id: 'H4001', name: 'Jan Malý' },{ id: 'H4002', name: 'Tereza Vlčková' },
  { id: 'H4003', name: 'Ondřej Hruška' },{ id: 'H4004', name: 'Simona Tichá' },
  { id: 'H4005', name: 'Petr Doležal' },{ id: 'H4006', name: 'Markéta Urbanová' },
];

const POTENCIAL = ['nízký','střední','vysoký'];
const PRAVDEPODOBNOST = ['nízká','střední','vysoká'];
const MES_STATUSES = ['Aktivní','Aktivní','Aktivní','Aktivní','Mateřská','Rodičovská'];
const LEGAL_ENTITIES = ['CZ01','CZ02','CZ03'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escapeCsv(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

console.log('Generating employees...');

const EMPLOYEE_COUNT = 10000;
const MANAGER_COUNT = 500;
const YEARS = [2023, 2024, 2025, 2026];
const EVALUATIONS = [1];

const usedEmails = new Set();
const people = [];

for (let i = 0; i < EMPLOYEE_COUNT + MANAGER_COUNT; i++) {
  const isFemale = Math.random() > 0.5;
  const first = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  const last = isFemale ? pick(LAST_NAMES_F) : pick(LAST_NAMES_M);
  const fullName = `${first} ${last}`;
  let emailBase = `${normalize(first)}.${normalize(last)}`;
  let email = `${emailBase}@csas.cz`;
  let attempt = 0;
  while (usedEmails.has(email)) {
    attempt++;
    email = `${emailBase}${attempt}@csas.cz`;
  }
  usedEmails.add(email);

  const l2Idx = i % L2_UNITS.length;
  const l2 = L2_UNITS[l2Idx];
  const l3Options = L3_MAP[l2.name];
  const l3Name = l3Options[i % l3Options.length];
  const l3Idx = i % L3_HEADS.length;
  const l4Idx = i % L4_HEADS.length;

  people.push({
    userId: String(10000 + i),
    firstName: first,
    lastName: last,
    fullName,
    email,
    login: `CEN${String(10000 + i)}`,
    username: `${normalize(first)}${last.charAt(0).toLowerCase()}`,
    isManager: i < MANAGER_COUNT,
    jobTitle: pick(JOB_TITLES),
    jobCode: pick(JOB_CODES),
    l2Idx, l2, l3Name, l3Idx, l4Idx,
    l4Name: pick(L4_UNITS),
    teamCode: `T${String(l2Idx * 1000 + randInt(1, 999)).padStart(5, '0')}`,
  });
}

const managers = people.filter(p => p.isManager);
const allEmployees = people.slice(MANAGER_COUNT);

const schema = Object.keys(JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'src', 'lib', 'expectedSchema.json'), 'utf-8'
)));

const rows = [];

for (const emp of allEmployees) {
  const mgr = managers[Math.floor(Math.random() * managers.length)];
  const l2 = emp.l2;
  const l2Head = L2_HEADS[emp.l2Idx];
  const l3Head = L3_HEADS[emp.l3Idx];
  const l4Head = L4_HEADS[emp.l4Idx];
  const entryYear = 2010 + randInt(0, 14);
  const entryDate = `${entryYear}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')} 00:00:00.000`;
  const mesStatus = pick(MES_STATUSES);

  for (const year of YEARS) {
    for (const evaluation of EVALUATIONS) {
      const vykonSys = randInt(1, 5);
      const hodnotySys = randInt(1, 5);
      const vykon = Math.random() > 0.3 ? vykonSys : randInt(1, 5);
      const hodnoty = Math.random() > 0.3 ? hodnotySys : randInt(1, 5);
      const isLocked = year < 2026 ? (Math.random() > 0.4 ? 1 : 0) : 0;
      const isLastLocked = year === 2025 && isLocked ? 1 : 0;

      const row = {
        USER_ID: emp.userId,
        YEAR: year,
        FULL_NAME: emp.fullName,
        EVALUATION: evaluation,
        LOGIN: emp.login,
        USERNAME: emp.username,
        LAST_NAME: emp.lastName,
        FIRST_NAME: emp.firstName,
        LEGAL_ENTITY_CODE: pick(LEGAL_ENTITIES),
        IS_MANAGER: emp.isManager ? 'Y' : 'N',
        EMPLOYEE_STATUS: mesStatus === 'Aktivní' ? 'Active' : 'Leave',
        JOB_CODE: emp.jobCode,
        JOB_SHORT_TEXT_CZ: emp.jobTitle.substring(0, 20),
        JOB_TITLE_CZ: emp.jobTitle,
        ORGANIZATION_UNIT: String(l2.code * 100 + randInt(1, 99)),
        ORGANIZATION_UNIT_NAME_CZ: `${emp.l3Name} - ${emp.l4Name}`,
        L0_ORGANIZATION_UNIT_CODE: 1000,
        L0_ORGANIZATION_UNIT_SHORT_TEXT_CZ: 'CS',
        L0_ORGANIZATION_UNIT_NAME_CZ: 'Česká spořitelna',
        L1_ORGANIZATION_UNIT_CODE: 1100,
        L1_ORGANIZATION_UNIT_SHORT_TEXT_CZ: 'CSAS',
        L1_ORGANIZATION_UNIT_NAME_CZ: 'Česká spořitelna a.s.',
        L2_ORGANIZATION_UNIT_CODE: l2.code,
        L2_ORGANIZATION_UNIT_SHORT_TEXT_CZ: l2.short,
        L2_ORGANIZATION_UNIT_NAME_CZ: l2.name,
        L3_ORGANIZATION_UNIT_CODE: l2.code * 10 + (emp.l3Idx % 4),
        L3_ORGANIZATION_UNIT_SHORT_TEXT_CZ: emp.l3Name.substring(0, 10),
        L3_ORGANIZATION_UNIT_NAME_CZ: emp.l3Name,
        L4_ORGANIZATION_UNIT_CODE: l2.code * 100 + emp.l4Idx,
        L4_ORGANIZATION_UNIT_SHORT_TEXT_CZ: emp.l4Name.substring(0, 10),
        L4_ORGANIZATION_UNIT_NAME_CZ: emp.l4Name,
        L5_ORGANIZATION_UNIT_CODE: 0,
        L5_ORGANIZATION_UNIT_SHORT_TEXT_CZ: '',
        L5_ORGANIZATION_UNIT_NAME_CZ: '',
        L6_ORGANIZATION_UNIT_CODE: 0,
        L6_ORGANIZATION_UNIT_SHORT_TEXT_CZ: '',
        L6_ORGANIZATION_UNIT_NAME_CZ: '',
        EMAIL_ADDRESS: emp.email,
        EMAIL_ADDRESS_REDIM: emp.email,
        TEAM_CODE: emp.teamCode,
        TEAM_NAME: `${emp.l3Name} ${emp.l4Name}`,
        TEAM_LEADER_USER_ID: mgr.userId,
        DIRECT_MANAGER_USER_ID: mgr.userId,
        DIRECT_MANAGER_FULL_NAME: mgr.fullName,
        DIRECT_MANAGER_EMAIL: mgr.email,
        L0_HEAD_OF_UNIT_USER_ID: 'H0001',
        L0_HEAD_OF_UNIT_FULL_NAME: 'Ing. Tomáš Salomon',
        L1_HEAD_OF_UNIT_USER_ID: 'H1001',
        L1_HEAD_OF_UNIT_FULL_NAME: 'Ing. Tomáš Salomon',
        L2_HEAD_OF_UNIT_USER_ID: l2Head.id,
        L2_HEAD_OF_UNIT_FULL_NAME: l2Head.name,
        L3_HEAD_OF_UNIT_USER_ID: l3Head.id,
        L3_HEAD_OF_UNIT_FULL_NAME: l3Head.name,
        L4_HEAD_OF_UNIT_USER_ID: l4Head.id,
        L4_HEAD_OF_UNIT_FULL_NAME: l4Head.name,
        L5_HEAD_OF_UNIT_USER_ID: 0,
        L5_HEAD_OF_UNIT_FULL_NAME: '',
        L6_HEAD_OF_UNIT_USER_ID: '',
        L6_HEAD_OF_UNIT_FULL_NAME: '',
        HODNOTY: hodnoty,
        VYKON: vykon,
        POTENCIAL: pick(POTENCIAL),
        HODNOTY_SYSTEM: hodnotySys,
        VYKON_SYSTEM: vykonSys,
        PRAVDEPODOBNOST_ODCHODU: pick([...PRAVDEPODOBNOST, '']),
        MOZNY_KARIERNI_POSUN: pick(['Ano', 'Ne', '']),
        NASTUPCE: pick(['Ano', 'Ne', '']),
        POZNAMKY: '',
        IS_LOCKED: isLocked,
        LOCKED_TIMESTAMP: isLocked ? `${year}-06-${String(randInt(1,28)).padStart(2,'0')} ${String(randInt(8,17)).padStart(2,'0')}:${String(randInt(0,59)).padStart(2,'0')}:00.000` : '1970-01-01 00:00:00.000',
        VYKON_PREVIOUS: randInt(0, 5),
        HODNOTY_PREVIOUS: randInt(0, 5),
        POTENCIAL_PREVIOUS: pick([...POTENCIAL, '']),
        LAST_EVALUATION: evaluation === 2 ? `${year}-1` : year > YEARS[0] ? `${year - 1}-1` : '',
        HIST_DATA_MODIFIED_BY: '',
        HIST_DATA_MODIFIED_WHEN: '1970-01-01 00:00:00.000',
        JOB_ENTRY_DATE: entryDate,
        IS_LAST_LOCKED: isLastLocked,
        MES_DPP_STATUS: mesStatus,
        TM_DATE: '1970-01-01 00:00:00.000',
      };

      rows.push(row);
    }
  }
}

console.log(`Generated ${rows.length} rows for ${allEmployees.length} employees.`);

// Write source CSV
const header = schema.join(',');
const csvLines = [header];
for (const row of rows) {
  const line = schema.map(col => escapeCsv(row[col] ?? '')).join(',');
  csvLines.push(line);
}

const outDir = path.join(__dirname, '..', 'data-upload');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'source_table.csv'), csvLines.join('\n'), 'utf-8');
console.log(`Written: data-upload/source_table.csv (${rows.length} rows)`);

// Write filters CSV
const filterRows = [
  { FILTER_NAME: 'Retail tým', FILTER_CREATOR: 'admin@csas.cz', FILTERED_VALUES: JSON.stringify({ L2_ORGANIZATION_UNIT_NAME_CZ: ['Retail banking'] }) },
  { FILTER_NAME: 'IT oddělení', FILTER_CREATOR: 'admin@csas.cz', FILTERED_VALUES: JSON.stringify({ L2_ORGANIZATION_UNIT_NAME_CZ: ['IT & Digitalizace'] }) },
  { FILTER_NAME: 'Risk management', FILTER_CREATOR: 'admin@csas.cz', FILTERED_VALUES: JSON.stringify({ L2_ORGANIZATION_UNIT_NAME_CZ: ['Řízení rizik'] }) },
];

const filterHeader = 'FILTER_NAME,FILTER_CREATOR,FILTERED_VALUES';
const filterLines = [filterHeader];
for (const f of filterRows) {
  filterLines.push(`${escapeCsv(f.FILTER_NAME)},${escapeCsv(f.FILTER_CREATOR)},${escapeCsv(f.FILTERED_VALUES)}`);
}

fs.writeFileSync(path.join(outDir, 'filter_table.csv'), filterLines.join('\n'), 'utf-8');
console.log(`Written: data-upload/filter_table.csv (${filterRows.length} rows)`);
