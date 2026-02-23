/**
 * Run this script once to generate dummy data:
 *   node src/data/generateDummy.js
 */
const fs = require('fs');
const path = require('path');

const FIRST_NAMES = [
  'Jan', 'Petr', 'Tomáš', 'Martin', 'Lukáš', 'Jakub', 'David', 'Filip',
  'Anna', 'Marie', 'Eva', 'Kateřina', 'Lucie', 'Tereza', 'Barbora', 'Veronika',
  'Michal', 'Ondřej', 'Marek', 'Pavel', 'Jiří', 'Adam', 'Šimon', 'Matěj',
  'Hana', 'Alena', 'Jana', 'Petra', 'Monika', 'Lenka', 'Markéta', 'Simona',
];

const LAST_NAMES = [
  'Novák', 'Svoboda', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák',
  'Němec', 'Pokorný', 'Marek', 'Pospíšil', 'Hájek', 'Jelínek', 'Král', 'Růžička',
  'Beneš', 'Fiala', 'Sedláček', 'Doležal', 'Zeman', 'Kolář', 'Navrátil', 'Čermák',
  'Nováková', 'Svobodová', 'Dvořáková', 'Černá', 'Procházková', 'Kučerová', 'Veselá', 'Horáková',
];

const JOB_TITLES = [
  'Specialista klientského servisu', 'Senior analytik', 'Projektový manažer',
  'Bankéř', 'Risk analytik', 'IT konzultant', 'Relationship Manager',
  'Produktový manažer', 'Compliance officer', 'Finanční poradce',
  'Klientský poradce', 'HR Business Partner', 'Data analytik',
  'Marketingový specialista', 'Interní auditor',
];

const L2_UNITS = ['Retail banking', 'Korporátní bankovnictví', 'Řízení rizik', 'IT & Digitalizace'];
const L3_UNITS = {
  'Retail banking': ['Pobočková síť', 'Přímé bankovnictví', 'Klientský servis'],
  'Korporátní bankovnictví': ['Firemní klienti', 'Velké korporace', 'Strukturované financování'],
  'Řízení rizik': ['Kreditní riziko', 'Operační riziko', 'Compliance'],
  'IT & Digitalizace': ['Vývoj aplikací', 'Infrastruktura', 'Digitální produkty'],
};
const L4_UNITS = ['Tým A', 'Tým B', 'Tým C', 'Tým D'];

const L2_HEADS = ['Ing. Karel Novotný', 'Mgr. Petra Říhová', 'Ing. Tomáš Bartoš', 'Ing. Lucie Marková'];
const L3_HEADS = [
  'Mgr. Jana Veselá', 'Ing. Pavel Kříž', 'Ing. Martin Holub',
  'Mgr. Eva Pokorná', 'Ing. David Šimek', 'Mgr. Barbora Fialová',
];
const L4_HEADS = ['Jan Malý', 'Tereza Vlčková', 'Ondřej Hruška', 'Simona Tichá'];

const POTENCIAL_VALUES = ['nízký', 'střední', 'vysoký'];
const MES_STATUSES = ['Aktivní', 'Mateřská', 'Aktivní', 'Aktivní', 'Aktivní'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmployees(count) {
  const employees = [];
  const usedEmails = new Set();

  // First, create managers (ids 1-6) and then regular employees
  const managerCount = 6;
  const allPeople = [];

  for (let i = 0; i < count + managerCount; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const fullName = `${first} ${last}`;
    let email = `${first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@csas.cz`;
    let attempt = 0;
    while (usedEmails.has(email)) {
      attempt++;
      email = `${first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${attempt}.${last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@csas.cz`;
    }
    usedEmails.add(email);

    allPeople.push({
      userId: String(1000 + i),
      firstName: first,
      lastName: last,
      fullName,
      email,
      login: `CEN${String(1000 + i)}`,
      username: `${first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${last.charAt(0).toLowerCase()}`,
      isManager: i < managerCount,
    });
  }

  // Assign managers: managers 0-5 manage regular employees 6+
  const managers = allPeople.slice(0, managerCount);
  const regulars = allPeople.slice(managerCount);

  // Create employee records for two years and two evaluations
  const years = [2024, 2025];
  const evaluations = [1, 2];

  for (const person of regulars) {
    const manager = pick(managers);
    const l2Unit = pick(L2_UNITS);
    const l2Idx = L2_UNITS.indexOf(l2Unit);
    const l3Options = L3_UNITS[l2Unit];
    const l3Unit = pick(l3Options);
    const l4Unit = pick(L4_UNITS);

    for (const year of years) {
      for (const evaluation of evaluations) {
        const vykonSys = randInt(1, 5);
        const hodnotySys = randInt(1, 5);
        const vykon = Math.random() > 0.3 ? vykonSys : randInt(1, 5);
        const hodnoty = Math.random() > 0.3 ? hodnotySys : randInt(1, 5);
        const isLocked = year === 2024 ? (Math.random() > 0.5 ? 1 : 0) : 0;

        employees.push({
          USER_ID: person.userId,
          YEAR: year,
          EVALUATION: evaluation,
          LOGIN: person.login,
          USERNAME: person.username,
          EMAIL_ADDRESS: person.email,
          FULL_NAME: person.fullName,
          JOB_TITLE_CZ: pick(JOB_TITLES),
          DIRECT_MANAGER_EMAIL: manager.email,
          DIRECT_MANAGER_FULL_NAME: manager.fullName,
          LAST_EVALUATION: evaluation === 2 ? `${year}-1` : `${year - 1}-2`,
          VYKON_PREVIOUS: randInt(0, 5),
          HODNOTY_PREVIOUS: randInt(0, 5),
          POTENCIAL_PREVIOUS: pick([...POTENCIAL_VALUES, '0']),
          VYKON_SYSTEM: vykonSys,
          HODNOTY_SYSTEM: hodnotySys,
          IS_LOCKED: isLocked,
          VYKON: vykon,
          HODNOTY: hodnoty,
          POTENCIAL: pick(POTENCIAL_VALUES),
          PRAVDEPODOBNOST_ODCHODU: pick([...POTENCIAL_VALUES, '0']),
          NASTUPCE: pick(['Ano', 'Ne']),
          MOZNY_KARIERNI_POSUN: pick(['Ano', 'Ne']),
          POZNAMKY: '',
          LOCKED_TIMESTAMP: isLocked ? '2024-06-15 10:30:00.000' : '1970-01-01 00:00:00.000',
          HIST_DATA_MODIFIED_WHEN: '1970-01-01 00:00:00.000',
          HIST_DATA_MODIFIED_BY: '',
          JOB_ENTRY_DATE: `${2015 + randInt(0, 8)}-0${randInt(1, 9)}-${String(randInt(1, 28)).padStart(2, '0')} 00:00:00.000`,
          TM_DATE: '1970-01-01 00:00:00.000',
          L2_ORGANIZATION_UNIT_NAME_CZ: l2Unit,
          L3_ORGANIZATION_UNIT_NAME_CZ: l3Unit,
          L4_ORGANIZATION_UNIT_NAME_CZ: l4Unit,
          TEAM_CODE: `T${String(l2Idx * 100 + randInt(1, 50)).padStart(4, '0')}`,
          L2_HEAD_OF_UNIT_FULL_NAME: L2_HEADS[l2Idx],
          L3_HEAD_OF_UNIT_FULL_NAME: pick(L3_HEADS),
          L4_HEAD_OF_UNIT_FULL_NAME: pick(L4_HEADS),
          MES_DPP_STATUS: pick(MES_STATUSES),
          COMPARATIO: randInt(70, 130),
        });
      }
    }
  }

  return employees;
}

// Generate and write
const employees = generateEmployees(40);
const filtersData = [];

fs.writeFileSync(
  path.join(__dirname, 'employees.json'),
  JSON.stringify(employees, null, 2),
  'utf-8'
);

fs.writeFileSync(
  path.join(__dirname, 'filters.json'),
  JSON.stringify(filtersData, null, 2),
  'utf-8'
);

console.log(`Generated ${employees.length} employee records across 2 years × 2 evaluations.`);
console.log(`Unique employees: ${new Set(employees.map(e => e.USER_ID)).size}`);
console.log('Files written: employees.json, filters.json');
