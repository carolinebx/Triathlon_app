import React, { useState, useMemo, useEffect, useRef } from 'react';
import { loadLocal, saveLocal, loadRemote, saveRemote, hasRemote } from './lib/sheetsApi.js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import {
  Waves, Bike, Footprints, Dumbbell, Moon, ChevronLeft, ChevronRight, Plus, X,
  Check, TrendingUp, Award, Calendar, Target, ArrowLeftRight, Flag, Sparkles,
  AlertTriangle, Edit3, Trash2, Settings, Grid3x3, RefreshCw, GripVertical,
  Utensils, Upload, Medal, Sun, Droplets, Trophy, Activity, Info, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ============================== CONSTANTS ============================== */

const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DAYS_FULL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

const RACE_TYPES = {
  sprint: { label: 'Sprint', swim: 0.75, bike: 20, run: 5 },
  olympic: { label: 'Olympisch', swim: 1.5, bike: 40, run: 10 },
  half: { label: 'Halve triatlon (70.3)', swim: 1.9, bike: 90, run: 21.1 },
  full: { label: 'Volledige triatlon', swim: 3.8, bike: 180, run: 42.2 },
};

const DISCIPLINE_META = {
  zwemmen: { label: 'Zwemmen', icon: Waves, color: '#2E7D8F' },
  fietsen: { label: 'Fietsen', icon: Bike, color: '#C1552C' },
  hardlopen: { label: 'Hardlopen', icon: Footprints, color: '#D9A441' },
  kracht: { label: 'Kracht', icon: Dumbbell, color: '#8A5A44' },
  wedstrijd: { label: 'Wedstrijd', icon: Flag, color: '#9C3D54' },
  rust: { label: 'Rust', icon: Moon, color: '#8A7460' },
};

const RACE_ADD_TYPES = [
  { key: 'sprint', label: 'Sprint triatlon', totalKm: RACE_TYPES.sprint.swim + RACE_TYPES.sprint.bike + RACE_TYPES.sprint.run },
  { key: 'olympic', label: 'Olympische triatlon', totalKm: RACE_TYPES.olympic.swim + RACE_TYPES.olympic.bike + RACE_TYPES.olympic.run },
  { key: 'half', label: 'Halve triatlon (70.3)', totalKm: RACE_TYPES.half.swim + RACE_TYPES.half.bike + RACE_TYPES.half.run },
  { key: 'full', label: 'Volledige triatlon', totalKm: RACE_TYPES.full.swim + RACE_TYPES.full.bike + RACE_TYPES.full.run },
  { key: 'hardloop', label: 'Hardloopwedstrijd', manual: true, unit: 'km' },
  { key: 'zwem', label: 'Zwemwedstrijd', manual: true, unit: 'm' },
  { key: 'overig', label: 'Andere wedstrijd', manual: true, unit: 'km' },
];

const TEMPLATES = {
  3: ['zwemmen', 'fietsen', 'hardlopen'],
  4: ['zwemmen', 'fietsen', 'hardlopen', 'kracht'],
  5: ['zwemmen', 'fietsen', 'hardlopen', 'fietsen', 'hardlopen'],
  6: ['zwemmen', 'fietsen', 'hardlopen', 'kracht', 'fietsen', 'hardlopen'],
};
const DAY_ASSIGN = {
  3: [1, 3, 6],
  4: [1, 2, 4, 6],
  5: [0, 2, 3, 4, 6],
  6: [0, 1, 3, 4, 5, 6],
};

const MOD = { duurloop: 1, interval: 0.65, herstel: 0.5, tempo: 0.85, techniek: 0.55, 'lange training': 1.5, kracht: 1, fartlek: 0.75, heuveltraining: 0.6, brick: 1.2, openwater: 0.7, klimtraining: 0.75, mobiliteit: 1, core: 1 };
const HARDNESS = { duurloop: 1, interval: 3, herstel: 0, tempo: 2, techniek: 1, 'lange training': 2, kracht: 1, fartlek: 2, heuveltraining: 3, brick: 3, openwater: 1, klimtraining: 2, mobiliteit: 0, core: 1, rust: 0 };
// Hoe ver de langste sessie van het jaar t.o.v. de wedstrijdafstand moet komen, per wedstrijdtype.
const PEAK_LONG_FACTOR = {
  sprint: { zwemmen: 1.0, fietsen: 1.3, hardlopen: 1.4 },
  olympic: { zwemmen: 1.0, fietsen: 1.2, hardlopen: 1.3 },
  half: { zwemmen: 0.65, fietsen: 0.95, hardlopen: 0.85 },
  full: { zwemmen: 0.55, fietsen: 0.85, hardlopen: 0.75 },
};
// Welk aandeel van het wekelijks volume de lange/kwaliteitssessie normaal gesproken vormt.
const SESSION_SHARE = {
  zwemmen: { basis: 1, lang: 0.6, kwaliteit: 0.4 },
  fietsen: { basis: 1, lang: 0.62, kwaliteit: 0.38 },
  hardlopen: { basis: 1, lang: 0.58, kwaliteit: 0.42 },
};
const MIN_SESSION_KM = { zwemmen: 0.3, fietsen: 8, hardlopen: 2 };
// Taperlengte schaalt mee met de wedstrijdafstand: hoe langer de wedstrijd, hoe meer rust vooraf nodig is.
const TAPER_WEEKS = { sprint: 1, olympic: 1, half: 2, full: 3 };
const TAPER_FACTORS = { 1: [0.4], 2: [0.55, 0.35], 3: [0.65, 0.5, 0.35] };
const RIEGEL_EXPONENT = 1.06; // standaard exponent voor het schalen van duurprestaties naar een andere afstand
const NUTRITION_TIPS = {
  'lange training': 'Voeding: neem vanaf ~60-90 min elke 30-45 min zo\'n 30-60g koolhydraten en drink regelmatig — oefen hiermee je wedstrijdvoeding.',
  interval: 'Voeding: zorg dat je 1,5-2 uur van tevoren goed gegeten hebt; tijdens de sessie zelf is voeding meestal niet nodig.',
  tempo: 'Voeding: een lichte koolhydraatsnack 60-90 min vooraf helpt dit tempo vol te houden.',
  brick: 'Voeding: oefen hier je wedstrijdvoeding — eet/drink op de fiets zoals je dat op wedstrijddag zou doen.',
  duurloop: 'Voeding: bij meer dan een uur, neem water mee en drink/eet elke 30-40 min iets kleins.',
  'lange duurtraining': 'Voeding: neem vanaf ~60-90 min elke 30-45 min zo\'n 30-60g koolhydraten.',
  herstel: 'Voeding: focus na afloop op koolhydraten + eiwitten binnen 30-60 minuten voor herstel.',
  techniek: 'Voeding: een normale maaltijd 2 uur vooraf is voldoende, dit is geen belastende sessie.',
  klimtraining: 'Voeding: zorg voor voldoende koolhydraten vooraf, dit vraagt veel spierglycogeen.',
  heuveltraining: 'Voeding: eet 1-2 uur vooraf iets lichts verteerbaars.',
  fartlek: 'Voeding: een normale maaltijd 1,5-2 uur vooraf volstaat.',
  openwater: 'Voeding: neem indien >60 min een koolhydraatgel mee die je kunt nuttigen bij een keerpunt.',
  wedstrijd: 'Voeding: volg je geoefende wedstrijdvoeding — probeer op de dag zelf niets nieuws.',
  kracht: 'Voeding: eet 1-2 uur vooraf een lichte maaltijd en hydrateer goed.',
};
const PHASE_MULT = { basis: 1, opbouw: 1.12, piek: 1.22, taper: 0.55 };
const PHASE_LABEL = { basis: 'Conditiefase', opbouw: 'Opbouwfase', piek: 'Piekfase', taper: 'Taper' };
const PHASE_TEXT = {
  basis: 'We zitten in de conditiefase: rustig volume opbouwen als basis-conditie.',
  opbouw: 'In de opbouwfase draaien we volume en intensiteit langzaam op.',
  piek: 'We naderen de wedstrijd: dit zijn je scherpste, meest specifieke trainingen.',
  taper: 'Tapertijd: het volume gaat omlaag zodat je fris aan de start staat.',
};
const TYPE_TEXT = {
  duurloop: 'Een rustige duurtraining bouwt je aerobe basis op.',
  interval: 'Intervallen verhogen je drempel en tempogevoel.',
  herstel: 'Een korte, hele rustige sessie om het lichaam te laten bijkomen.',
  tempo: 'Tempotraining leert je lichaam wedstrijdtempo vasthouden.',
  techniek: 'Techniekfocus maakt je efficiënter per slag.',
  'lange training': 'De lange sessie van de week: dit bouwt je uithoudingsvermogen voor de wedstrijdafstand.',
  kracht: 'Kracht ondersteunt je duurprestatie en helpt blessures voorkomen.',
  fartlek: 'Speels wisselend tempo traint je vermogen om snelheid te variëren.',
  heuveltraining: 'Herhalingen op een helling bouwen beenkracht en loopeconomie op.',
  brick: 'Direct van fietsen naar hardlopen: went je benen aan het wisselgevoel op wedstrijddag.',
  openwater: 'Zwemmen in open water bouwt vertrouwen en sighting-vaardigheid op.',
  klimtraining: 'Gerichte klimintervallen bouwen kracht op de fiets op.',
  mobiliteit: 'Mobiliteitswerk houdt je gewrichten soepel en verlaagt blessurerisico.',
  core: 'Een sterke rompstabiliteit ondersteunt je houding in alle drie de disciplines.',
  rust: 'Hersteldag: laat het lichaam de trainingsprikkels verwerken.',
};
const INTENSITY = {
  duurloop: 'Zone 2 · RPE 4-5 — rustig, gesprekstempo',
  interval: 'Zone 4 · RPE 7-8 — pittige intervallen',
  herstel: 'Zone 1 · RPE 2-3 — heel licht',
  tempo: 'Zone 3 · RPE 6 — comfortabel hard',
  techniek: 'Zone 1-2 · RPE 3 — focus op vorm',
  'lange training': 'Zone 2 · RPE 5 — lang volhouden',
  kracht: 'RPE 6 — functionele kracht',
  fartlek: 'Zone 2-4 · RPE 5-7 — wisselend tempo',
  heuveltraining: 'Zone 4 · RPE 7-8 — korte, krachtige herhalingen',
  brick: 'Zone 3 · RPE 6-7 — wedstrijdtempo, direct na elkaar',
  openwater: 'Zone 2 · RPE 4-5 — rustig, focus op oriëntatie',
  klimtraining: 'Zone 3-4 · RPE 6-8 — kracht op lage cadans',
  mobiliteit: 'RPE 2 — lenigheid en herstel',
  core: 'RPE 5 — rompstabiliteit',
  rust: 'Volledige rust of lichte mobiliteit',
};
const TYPE_OPTIONS = {
  zwemmen: ['duurloop', 'interval', 'techniek', 'tempo', 'lange training', 'openwater', 'herstel', 'anders'],
  fietsen: ['duurloop', 'interval', 'tempo', 'lange training', 'klimtraining', 'herstel', 'brick', 'anders'],
  hardlopen: ['duurloop', 'interval', 'herstel', 'tempo', 'lange training', 'fartlek', 'heuveltraining', 'brick', 'anders'],
  kracht: ['kracht', 'mobiliteit', 'core', 'anders'],
};
const DEFAULT_UNIT = { zwemmen: 'm', fietsen: 'km', hardlopen: 'km', kracht: 'min' };
const EXPERIENCE_GROWTH = { beginner: 0.65, gevorderd: 1, ervaren: 1.25 };
const EXPERIENCE_CAP = { beginner: 1.35, gevorderd: 1.6, ervaren: 1.85 };

const STATUS_META = {
  gepland: { label: 'Gepland', color: '#8A7460', bg: '#F2E9DC' },
  voltooid: { label: 'Voltooid', color: '#5C6B3E', bg: '#E4EACB' },
  overgeslagen: { label: 'Overgeslagen', color: '#B84A3E', bg: '#F7DAD3' },
  aangepast: { label: 'Aangepast', color: '#B3792A', bg: '#F6E3C0' },
};

/* ============================== HELPERS ============================== */

function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfMonth(d) { const r = new Date(d); r.setDate(1); r.setHours(0, 0, 0, 0); return r; }
function dateKey(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }

function buildDayAssignments(template, defaultDays) {
  const daysPerWeek = template.length;
  const baseAssign = DAY_ASSIGN[daysPerWeek];
  const usedDays = new Set();
  const assignment = new Array(template.length).fill(null);
  const seen = {};
  template.forEach((discipline, i) => {
    const occ = seen[discipline] || 0;
    seen[discipline] = occ + 1;
    const prefs = (defaultDays && defaultDays[discipline]) || [];
    const pref = prefs[occ];
    if (pref != null && !usedDays.has(pref)) {
      assignment[i] = pref;
      usedDays.add(pref);
    }
  });
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const pool = [...baseAssign.filter((d) => !usedDays.has(d)), ...allDays.filter((d) => !usedDays.has(d) && !baseAssign.includes(d))];
  let poolIdx = 0;
  for (let i = 0; i < assignment.length; i++) {
    if (assignment[i] == null) {
      while (poolIdx < pool.length && usedDays.has(pool[poolIdx])) poolIdx++;
      const day = poolIdx < pool.length ? pool[poolIdx] : allDays.find((d) => !usedDays.has(d));
      assignment[i] = day;
      usedDays.add(day);
      poolIdx++;
    }
  }
  return assignment;
}
// Hele kalenderdagen van een datum (Date) tot een 'JJJJ-MM-DD'-string, los van tijdzone en zomertijd
function calendarDaysUntil(fromDate, toDateStr) {
  const a = new Date(fromDate); a.setHours(0, 0, 0, 0);
  const b = new Date(`${toDateStr}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
function daysBetween(a, b) { return Math.ceil((new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24)); }
function weeksUntil(dateStr) {
  if (!dateStr) return 12;
  const d = daysBetween(dateStr, new Date());
  return Math.max(Math.ceil(d / 7), 4);
}

function paceStrToSec(str) {
  if (!str) return null;
  const parts = String(str).split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}
function secToPaceStr(sec) {
  if (sec == null || isNaN(sec)) return '-';
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function secToHMS(sec) {
  if (sec == null || isNaN(sec)) return '-';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function parseTargetTime(str) {
  if (!str) return null;
  const parts = String(str).split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return null;
}

// Weken worden in de app aangeduid met hun periode (maandag t/m zondag), niet met een weeknummer.
function weekEnd(startDate) { return addDays(new Date(startDate), 6); }

function fmtDayMonth(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function weekRangeLabel(startDate) {
  if (!startDate) return '';
  const a = new Date(startDate);
  const b = weekEnd(a);
  if (a.getFullYear() !== b.getFullYear()) {
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${a.toLocaleDateString('nl-NL', opts)} – ${b.toLocaleDateString('nl-NL', opts)}`;
  }
  // Binnen dezelfde maand is de maandnaam één keer genoeg: "22 – 28 sep"
  const left = a.getMonth() === b.getMonth() ? String(a.getDate()) : fmtDayMonth(a);
  return `${left} – ${fmtDayMonth(b)}`;
}

function weekRelativeLabel(startDate) {
  if (!startDate) return '';
  const a = startOfWeek(new Date(startDate)); a.setHours(0, 0, 0, 0);
  const b = startOfWeek(new Date()); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a - b) / 604800000);
  if (diff === 0) return 'Deze week';
  if (diff === 1) return 'Volgende week';
  if (diff === -1) return 'Vorige week';
  return '';
}

function weekMonthLabel(startDate) {
  if (!startDate) return '';
  return new Date(startDate).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
}

/* ------------------------------ vakanties ------------------------------ */
// Een vakantie is een periode waarin niet (of alleen licht) getraind kan worden.
// mode 'rust' = helemaal geen training, mode 'licht' = kortere, rustige sessies in de
// sporten die op je bestemming mogelijk zijn.
const HOLIDAY_MODE_LABEL = { rust: 'Geen training', licht: 'Licht trainen' };
const HOLIDAY_LIGHT_FACTOR = 0.6; // lichte vakantiesessies zijn ~60% van de normale omvang
const HOLIDAY_DISCIPLINES = ['zwemmen', 'fietsen', 'hardlopen', 'kracht'];

function holidayForDate(date, holidays) {
  if (!holidays || !holidays.length) return null;
  const key = dateKey(date);
  return holidays.find((h) => h.from && h.to && key >= h.from && key <= h.to) || null;
}

function holidayAllowsDiscipline(holiday, discipline) {
  if (!holiday || holiday.mode === 'rust') return false;
  const allowed = holiday.disciplines && holiday.disciplines.length ? holiday.disciplines : HOLIDAY_DISCIPLINES;
  return allowed.includes(discipline);
}

function weekHolidayInfo(startDate, holidays) {
  const days = Array.from({ length: 7 }, (_, d) => holidayForDate(addDays(new Date(startDate), d), holidays));
  const restDays = days.filter((h) => h && h.mode === 'rust').length;
  const lightDays = days.filter((h) => h && h.mode === 'licht').length;
  const names = [...new Set(days.filter(Boolean).map((h) => h.label || 'Vakantie'))];
  return { days, restDays, lightDays, names, active: restDays + lightDays > 0 };
}

function softTypeFor(discipline) {
  if (discipline === 'zwemmen') return 'techniek';
  if (discipline === 'hardlopen') return 'herstel';
  if (discipline === 'kracht') return 'mobiliteit';
  return 'duurloop';
}

function scaleTarget(target, factor) {
  if (!target) return null;
  if (target.unit === 'm') {
    const amount = Math.max(Math.round((target.amount * factor) / 50) * 50, 200);
    return { amount, unit: 'm', label: `${amount} m` };
  }
  const amount = Math.max(Math.round(target.amount * factor * 10) / 10, target.unit === 'min' ? 15 : 1);
  return { amount, unit: target.unit, label: `${amount} ${target.unit}` };
}

function holidayRangeLabel(h) {
  if (!h || !h.from || !h.to) return '';
  const a = new Date(`${h.from}T00:00:00`);
  const b = new Date(`${h.to}T00:00:00`);
  const days = Math.round((b - a) / 86400000) + 1;
  return `${fmtDayMonth(a)} – ${fmtDayMonth(b)} (${days} ${days === 1 ? 'dag' : 'dagen'})`;
}

function paceGuidance(discipline, type, intake) {
  if (!intake) return null;
  if (discipline === 'zwemmen') {
    const base = paceStrToSec(intake.swim.pace);
    if (!base) return null;
    const mult = SWIM_MULT[type] ?? SWIM_MULT.default;
    const target = base * mult;
    return `${secToPaceStr(target * 0.97)}-${secToPaceStr(target * 1.03)} /100m`;
  }
  if (discipline === 'fietsen') {
    const base = intake.bike.speedKmh;
    if (!base) return null;
    const mult = BIKE_MULT[type] ?? BIKE_MULT.default;
    return `~${Math.round(base * mult)} km/u`;
  }
  if (discipline === 'hardlopen') {
    const base = paceStrToSec(intake.run.paceMinKm);
    if (!base) return null;
    const mult = RUN_MULT[type] ?? RUN_MULT.default;
    const target = base * mult;
    return `${secToPaceStr(target * 0.97)}-${secToPaceStr(target * 1.03)} /km`;
  }
  return null;
}

function computeAdaptationBase(prevWeek) {
  if (!prevWeek) return { factor: 1, note: 'Eerste week — gebaseerd op je intake.' };
  if (prevWeek.holiday && prevWeek.holiday.restDays >= 4) {
    return { factor: 0.9, note: `Je komt terug van vakantie (${prevWeek.holiday.names.join(', ')}) — we pakken het volume rustig weer op in plaats van meteen door te bouwen.` };
  }
  if (prevWeek.holiday && prevWeek.holiday.restDays + prevWeek.holiday.lightDays >= 4) {
    return { factor: 0.95, note: 'Vorige week stond in het teken van je vakantie — we bouwen voorzichtig verder.' };
  }
  const trainSessions = prevWeek.sessions.filter((s) => s.discipline !== 'rust');
  const completed = trainSessions.filter((s) => s.status === 'voltooid' || s.status === 'aangepast');
  const completionRate = trainSessions.length ? completed.length / trainSessions.length : 1;
  const rpes = completed.filter((s) => s.result && s.result.rpe).map((s) => Number(s.result.rpe));
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 5;
  const pct = Math.round(completionRate * 100);
  if (completionRate >= 0.9 && avgRpe <= 6.5) return { factor: 1.1, note: `Sterke week (${pct}% afgerond, gem. RPE ${avgRpe.toFixed(1)}). We bouwen verder op.` };
  if (completionRate < 0.5 || avgRpe >= 8.5) return { factor: 0.8, note: `Pittige week (${pct}% afgerond, gem. RPE ${avgRpe.toFixed(1)}). We nemen gas terug voor herstel.` };
  if (completionRate >= 0.7) return { factor: 1.04, note: `Goede week (${pct}% afgerond). Gestage opbouw.` };
  return { factor: 0.93, note: `Wisselvallige week (${pct}% afgerond). Kleine correctie naar beneden.` };
}

function getPhase(weeksRemaining, totalWeeks, taperWeeks) {
  if (weeksRemaining <= taperWeeks) return 'taper';
  if (weeksRemaining > totalWeeks * 0.66) return 'basis';
  if (weeksRemaining > totalWeeks * 0.3) return 'opbouw';
  return 'piek';
}

function sumDisciplineVolumeKm(week, discipline) {
  if (!week) return 0;
  return week.sessions.filter((s) => s.discipline === discipline && s.target)
    .reduce((a, s) => a + (s.target.unit === 'm' ? s.target.amount / 1000 : s.target.unit === 'km' ? s.target.amount : 0), 0);
}

function computeGoalWeeklyPeak(discipline, raceType, baseWeekly, expCap) {
  const raceKey = discipline === 'zwemmen' ? 'swim' : discipline === 'fietsen' ? 'bike' : 'run';
  const raceDist = RACE_TYPES[raceType][raceKey];
  const factor = (PEAK_LONG_FACTOR[raceType] || PEAK_LONG_FACTOR.olympic)[discipline];
  const share = SESSION_SHARE[discipline].lang;
  const requiredWeekly = (raceDist * factor) / share;
  const safeCeiling = Math.max(baseWeekly, 0.1) * expCap;
  const peak = Math.min(Math.max(requiredWeekly, baseWeekly), safeCeiling);
  return { peak, requiredWeekly, ambitious: requiredWeekly > safeCeiling };
}

// refWeek is de laatste 'normale' week (dus niet een vakantieweek): daaraan meten we
// af hoe snel het volume mag stijgen, zodat een vakantie de opbouw niet blijvend afknijpt.
function computeWeeklyVolumes(intake, mainGoal, phase, weekNumber, totalWeeks, adaptFactor, isDeload, refWeek) {
  const bases = { zwemmen: intake.swim.volumeKm, fietsen: intake.bike.volumeKm, hardlopen: intake.run.volumeKm };
  const manualTargets = { zwemmen: intake.swim.targetVolumeKm, fietsen: intake.bike.targetVolumeKm, hardlopen: intake.run.targetVolumeKm };
  const exps = { zwemmen: intake.swim.experience, fietsen: intake.bike.experience, hardlopen: intake.run.experience };
  const result = {}; const meta = {};
  const taperWeeks = TAPER_WEEKS[mainGoal.raceType] ?? 2;
  const taperFactors = TAPER_FACTORS[taperWeeks] || TAPER_FACTORS[2];
  const peakWeekNumber = Math.max(totalWeeks - taperWeeks, 1); // laatste taperWeeks weken zijn taper
  ['zwemmen', 'fietsen', 'hardlopen'].forEach((disc) => {
    const base = Math.max(bases[disc] || 0, 0);
    const cap = EXPERIENCE_CAP[exps[disc]] ?? 1.6;
    const goal = computeGoalWeeklyPeak(disc, mainGoal.raceType, base, cap);
    const manual = manualTargets[disc];
    // Piekvolume: handmatige instelling > wat de wedstrijdafstand vereist (nooit meer dan veilig, nooit minder dan nu)
    const peak = manual && manual > 0 ? Math.max(manual, base) : goal.peak;
    let vol;
    const weeksFromEnd = totalWeeks - weekNumber; // 0 = laatste (races)week
    if (weeksFromEnd < taperWeeks) {
      vol = peak * taperFactors[Math.min(weeksFromEnd, taperFactors.length - 1)];
    } else {
      const frac = Math.min(Math.max((weekNumber - 1) / Math.max(peakWeekNumber - 1, 1), 0), 1);
      vol = base + (peak - base) * frac; // gelijkmatige opbouw van je huidige niveau naar het piekvolume
    }
    if (isDeload) vol *= 0.7;
    vol *= Math.min(Math.max(adaptFactor, 0.85), 1.12); // resultaten sturen licht bij, de doelcurve blijft leidend
    if (refWeek && phase !== 'taper' && !isDeload) {
      const prevVol = sumDisciplineVolumeKm(refWeek, disc);
      if (prevVol > 0.5) vol = Math.min(vol, prevVol * 1.15); // nooit meer dan ~15% erbij t.o.v. vorige week
    }
    if (disc === 'hardlopen' && (intake.injuries || '').trim()) vol *= 0.85;
    result[disc] = Math.max(vol, base * 0.35, MIN_SESSION_KM[disc]);
    meta[disc] = { base, peak, required: goal.requiredWeekly, ambitious: !manual && goal.ambitious, manualOverride: Boolean(manual) };
  });
  result.__meta = meta;
  return result;
}

function computeTargetValue(discipline, type, role, weeklyVolumes, weekNumber, phase) {
  if (discipline === 'rust') return null;
  if (discipline === 'kracht' || type === 'mobiliteit' || type === 'core') {
    const dur = Math.round(Math.min(35 + weekNumber * 1.5, 60) * (phase === 'taper' ? 0.7 : 1));
    return { amount: dur, unit: 'min', label: `${dur} min` };
  }
  const weeklyVol = weeklyVolumes[discipline] || 0;
  const shareMap = SESSION_SHARE[discipline] || { basis: 1 };
  const share = shareMap[role] ?? shareMap.basis ?? 1;
  const perSessionKm = Math.max(weeklyVol * share, MIN_SESSION_KM[discipline] || 1);
  if (discipline === 'zwemmen') {
    const amount = Math.max(Math.round((perSessionKm * 1000) / 50) * 50, 300);
    return { amount, unit: 'm', label: `${amount} m` };
  }
  const amount = Math.max(Math.round(perSessionKm * 10) / 10, MIN_SESSION_KM[discipline] || 1);
  return { amount, unit: 'km', label: `${amount} km` };
}

function buildCoachNote(discipline, type, phase, weekNumber, adaptNote, isFirstOfWeek, intake, isDeload, wasDowngraded, brickNote) {
  let note = `${TYPE_TEXT[type] || 'Gerichte training voor je opbouw.'} ${PHASE_TEXT[phase]}`;
  if (isDeload) note += ' Dit is een ingebouwde hersteweek: minder volume, zodat je lichaam de vorige weken kan verwerken.';
  if (wasDowngraded) note += typeof wasDowngraded === 'string' ? ` ${wasDowngraded}` : ' Aangepast in intensiteit omdat er de dag ervoor al een pittige training stond — zo blijft herstel op orde.';
  if (brickNote) note += ' ' + brickNote;
  if (discipline === 'hardlopen' && (intake.injuries || '').trim()) note += ` Met het oog op je opgegeven aandachtspunt ("${intake.injuries.trim()}") bouwen we het hardloopvolume voorzichtiger op — stop bij pijn.`;
  if (weekNumber === 1) note += ' Gebaseerd op je intake.';
  if (isFirstOfWeek) note += ` ${adaptNote}`;
  return note;
}

const QUALITY_ROTATION = {
  zwemmen: ['interval', 'tempo', 'techniek'],
  fietsen: ['interval', 'tempo', 'klimtraining'],
  hardlopen: ['interval', 'fartlek', 'heuveltraining'],
};

function generateWeek(weekNumber, startDate, intake, mainGoal, prevWeek, totalWeeks, defaultDays, holidays = [], refWeek = prevWeek, extraLog = []) {
  const { factor: adaptFactor, note: baseAdaptNote } = computeAdaptation(prevWeek, extraLog, intake);
  const hol = weekHolidayInfo(startDate, holidays);
  // Weeknummers lopen door over alle doelen heen (zodat geschiedenis en grafieken kloppen);
  // fase, volumeopbouw en hersteweken tellen vanaf de start van het huidige doel.
  const goalWeek = weekNumber - ((mainGoal.startWeek || 1) - 1);
  const adaptNote = goalWeek === 1 && prevWeek ? `Eerste week richting je nieuwe doel. ${baseAdaptNote}` : baseAdaptNote;
  const weeksRemaining = Math.max(totalWeeks - goalWeek + 1, 1);
  const taperWeeks = TAPER_WEEKS[mainGoal.raceType] ?? 2;
  const phase = getPhase(weeksRemaining, totalWeeks, taperWeeks);
  const isDeload = phase !== 'taper' && goalWeek % 4 === 0;
  const isLongCourse = mainGoal.raceType === 'half' || mainGoal.raceType === 'full';
  const daysPerWeek = Math.min(Math.max(intake.daysPerWeek, 3), 6);
  const template = TEMPLATES[daysPerWeek];
  const dayIdx = buildDayAssignments(template, defaultDays);
  const weeklyVolumes = computeWeeklyVolumes(intake, mainGoal, phase, goalWeek, totalWeeks, adaptFactor, isDeload, refWeek);

  const counts = {};
  template.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });

  // Step 1: lay out disciplines onto their assigned days (no type yet)
  const seen = {};
  const daySlots = new Array(7).fill(null);
  template.forEach((discipline, i) => {
    const occurrence = seen[discipline] || 0;
    seen[discipline] = occurrence + 1;
    daySlots[dayIdx[i]] = { discipline, occurrence, total: counts[discipline], isFirstOfWeek: i === 0 };
  });

  // Step 2: for multi-session disciplines, the occurrence on the latest weekday becomes the "long" session
  ['zwemmen', 'fietsen', 'hardlopen'].forEach((disc) => {
    const days = daySlots.map((s, d) => (s && s.discipline === disc ? d : null)).filter((d) => d != null);
    if (days.length > 1) {
      const longDay = Math.max(...days);
      daySlots.forEach((s, d) => { if (s && s.discipline === disc) s.role = d === longDay ? 'lang' : 'kwaliteit'; });
    } else if (days.length === 1) {
      daySlots[days[0]].role = 'basis';
    }
  });

  // Extra activiteiten per dag (waterpolo, fietsen, ...): hoe zwaar, en is het een wedstrijd?
  const dayExtra = Array.from({ length: 7 }, (_, d) => {
    const key = dateKey(addDays(startDate, d));
    const list = (extraLog || []).filter((e) => e.date === key);
    return {
      hardness: list.reduce((m, e) => Math.max(m, extraHardness(e)), 0),
      match: list.some((e) => e.kind === 'waterpolo_wedstrijd'),
      names: list.filter((e) => extraHardness(e) >= 2).map(extraLabel),
    };
  });

  // Step 3: walk through the week day by day, choosing a type and downgrading it if the previous day was already hard
  let prevHardness = 0, prevExtraNames = null;
  const daySessions = new Array(7).fill(null);
  for (let d = 0; d < 7; d++) {
    const slot = daySlots[d];
    if (!slot) {
      daySessions[d] = { id: uid('s'), day: d, discipline: 'rust', type: 'rust', target: null, intensity: INTENSITY.rust, coachNote: TYPE_TEXT.rust, status: 'gepland', result: null };
      prevHardness = dayExtra[d].hardness;
      prevExtraNames = dayExtra[d].hardness >= 2 ? dayExtra[d].names : null;
      continue;
    }
    const { discipline, occurrence, total, isFirstOfWeek, role } = slot;
    let type = discipline === 'kracht' ? 'kracht'
      : role === 'lang' ? 'lange training'
      : role === 'kwaliteit' ? QUALITY_ROTATION[discipline][(goalWeek - 1) % QUALITY_ROTATION[discipline].length]
      : (discipline === 'zwemmen' ? 'techniek' : 'duurloop');
    let wasDowngraded = false;
    const extraToday = dayExtra[d];
    const extraTomorrow = d < 6 ? dayExtra[d + 1] : null;
    let extraReason = null;
    if (extraToday.hardness >= 2) extraReason = `Aangepast omdat je die dag ook ${extraToday.names.join(' en ').toLowerCase()} hebt — twee pittige belastingen op één dag is te veel.`;
    else if (extraTomorrow && extraTomorrow.match) extraReason = 'Aangepast omdat je morgen een waterpolowedstrijd hebt — zo sta je fris aan de start.';
    else if (prevHardness >= 2 && prevExtraNames) extraReason = `Aangepast omdat je gisteren ${prevExtraNames.join(' en ').toLowerCase()} had en dat nog doorwerkt.`;
    if (HARDNESS[type] >= 2 && (prevHardness >= 2 || extraReason)) {
      type = discipline === 'zwemmen' ? 'techniek' : discipline === 'hardlopen' ? 'herstel' : 'duurloop';
      wasDowngraded = extraReason || true;
    }
    // Near race day, turn the long bike/run session of long-course races into a brick session
    let brickNote = null;
    if (isLongCourse && role === 'lang' && (phase === 'piek' || (phase === 'opbouw' && weeksRemaining <= 5)) && (discipline === 'fietsen')) {
      type = 'brick';
      brickNote = 'Sluit af met 10-15 minuten hardlopen op wedstrijdtempo direct na het fietsen — dat traint je "wisselbenen".';
      wasDowngraded = false;
    }
    const target = computeTargetValue(discipline, type, role, weeklyVolumes, goalWeek, phase);
    const guide = paceGuidance(discipline, type, intake);
    daySessions[d] = {
      id: uid('s'),
      day: d,
      discipline,
      type,
      target,
      intensity: `${INTENSITY[type] || 'Naar eigen inschatting'}${guide ? ` · Doeltempo ${guide}` : ''}`,
      coachNote: buildCoachNote(discipline, type, phase, weekNumber, adaptNote, isFirstOfWeek, intake, isDeload, wasDowngraded, brickNote),
      nutritionTip: NUTRITION_TIPS[type] || null,
      status: 'gepland',
      result: null,
    };
    prevHardness = Math.max(HARDNESS[type] ?? 1, dayExtra[d].hardness);
    prevExtraNames = dayExtra[d].hardness >= 2 ? dayExtra[d].names : null;
  }

  // Step 4: leg de vakantie over de week heen — rustdagen worden echt rust, en op lichte
  // dagen blijft alleen wat op je bestemming kan, korter en rustiger. Sessies in een sport
  // die daar niet kan vervallen (ze worden niet naar een andere sport verplaatst, want dan
  // zou je vakantieweek juist zwaarder worden dan een normale week).
  const finalSessions = daySessions.map((s, d) => {
    const h = hol.days[d];
    if (!h) return s;
    const name = h.label || 'Vakantie';
    if (s.discipline === 'rust') {
      return { ...s, holidayName: name, coachNote: `Vakantie (${name}): rustdag, zoals gepland.` };
    }
    if (h.mode === 'rust') {
      return {
        ...s, discipline: 'rust', type: 'rust', target: null, intensity: INTENSITY.rust,
        coachNote: `Vakantie (${name}): geen training ingepland. Rust of wat losse beweging is hier het beste — na je vakantie pakken we de opbouw rustig weer op.`,
        nutritionTip: null, holidayName: name, status: 'gepland', result: null,
      };
    }
    if (!holidayAllowsDiscipline(h, s.discipline)) {
      return {
        ...s, discipline: 'rust', type: 'rust', target: null, intensity: INTENSITY.rust,
        coachNote: `Vakantie (${name}): ${DISCIPLINE_META[s.discipline].label.toLowerCase()} kan hier niet, dus dit wordt een rustdag. Wat je wél kunt doen staat op de andere dagen van deze week.`,
        nutritionTip: null, holidayName: name, status: 'gepland', result: null,
      };
    }
    const type = (HARDNESS[s.type] ?? 1) >= 2 ? softTypeFor(s.discipline) : s.type;
    const target = scaleTarget(s.target, HOLIDAY_LIGHT_FACTOR);
    const guide = paceGuidance(s.discipline, type, intake);
    return {
      ...s, type, target,
      intensity: `${INTENSITY[type] || 'Naar eigen inschatting'}${guide ? ` · Doeltempo ${guide}` : ''}`,
      coachNote: `Vakantie (${name}): een kortere, rustige sessie zodat je je ritme houdt zonder je vakantie te laten overheersen. ${TYPE_TEXT[type] || ''}`,
      nutritionTip: NUTRITION_TIPS[type] || null,
      holidayName: name,
      status: 'gepland', result: null,
    };
  });

  return {
    id: uid('w'), weekNumber, startDate: startDate.toISOString(), phase, isDeload, adaptFactor, adaptNote,
    weeklyVolumeMeta: weeklyVolumes.__meta,
    holiday: hol.active ? { names: hol.names, restDays: hol.restDays, lightDays: hol.lightDays } : null,
    sessions: finalSessions,
  };
}

function linreg(points) {
  const n = points.length;
  if (n === 0) return null;
  if (n === 1) return { slope: 0, intercept: points[0].y };
  const sx = points.reduce((a, p) => a + p.x, 0), sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0), sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

function getDisciplineSeries(weeks, discipline) {
  const series = [];
  weeks.forEach((w) => {
    w.sessions.filter((s) => s.discipline === discipline && s.status === 'voltooid' && s.result).forEach((s) => {
      let value = null;
      if (discipline === 'zwemmen') value = paceStrToSec(s.result.pace);
      if (discipline === 'fietsen') value = parseFloat(s.result.speed);
      if (discipline === 'hardlopen') value = paceStrToSec(s.result.pace);
      if (value != null && !isNaN(value)) series.push({ week: w.weekNumber, value, hr: s.result.hr ? Number(s.result.hr) : null });
    });
  });
  return series;
}

function parseDurationCell(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s); // Strava-export: 'moving time' vaak in hele seconden
  const parts = s.split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function mapActivityTypeToDiscipline(type) {
  const t = (type || '').toLowerCase();
  if (/run|hardloop|jog/.test(t)) return 'hardlopen';
  if (/ride|bike|cycl|fiets/.test(t)) return 'fietsen';
  if (/swim|zwem/.test(t)) return 'zwemmen';
  return null;
}

function splitCsvLine(line) {
  const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
  return cells.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).filter((_, i, arr) => i < arr.length);
}

function parseActivitiesCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const dateIdx = idx(['activity date', 'date', 'datum']);
  const typeIdx = idx(['activity type', 'type']);
  const distIdx = idx(['distance']);
  const timeIdx = idx(['moving time', 'elapsed time', 'time', 'duur']);
  const hrIdx = idx(['average heart rate', 'avg heart rate', 'hartslag', 'heart rate']);
  const nameIdx = idx(['activity name', 'name', 'naam']);
  if (dateIdx === -1 || typeIdx === -1) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (!cells.length) continue;
    const date = new Date(cells[dateIdx]);
    if (isNaN(date)) continue;
    const rawDist = distIdx !== -1 ? parseFloat((cells[distIdx] || '').replace(',', '.')) : null;
    const distanceKm = rawDist != null && !isNaN(rawDist) ? (rawDist > 200 ? rawDist / 1000 : rawDist) : null;
    const durationSec = timeIdx !== -1 ? parseDurationCell(cells[timeIdx]) : null;
    const hr = hrIdx !== -1 ? parseFloat(cells[hrIdx]) : null;
    rows.push({ date, type: cells[typeIdx] || '', distanceKm, durationSec, hr: isNaN(hr) ? null : hr, name: nameIdx !== -1 ? cells[nameIdx] : '' });
  }
  return rows;
}

function matchImportedActivities(weeks, activities) {
  const plannedSessions = [];
  weeks.forEach((w) => w.sessions.forEach((s) => {
    if (s.discipline === 'rust' || s.status !== 'gepland') return;
    plannedSessions.push({ weekId: w.id, session: s, date: addDays(new Date(w.startDate), s.day) });
  }));
  const matches = [];
  activities.forEach((act) => {
    const disc = mapActivityTypeToDiscipline(act.type);
    if (!disc) return;
    let best = null, bestDiff = Infinity;
    plannedSessions.forEach((p) => {
      if (p.session.discipline !== disc) return;
      const diff = Math.abs(daysBetween(p.date, act.date));
      if (diff <= 1 && diff < bestDiff) { best = p; bestDiff = diff; }
    });
    if (best) matches.push({ activity: act, weekId: best.weekId, session: best.session, sessionDate: best.date });
  });
  return matches;
}

function buildResultFromActivity(session, act) {
  const result = {
    distance: act.distanceKm != null ? String(Math.round(act.distanceKm * 100) / 100) : '',
    duration: act.durationSec != null ? secToHMS(act.durationSec) : '',
    pace: '', speed: '',
    hr: act.hr != null ? String(Math.round(act.hr)) : '',
    notes: `Geïmporteerd${act.name ? `: ${act.name}` : ''}`,
  };
  if (act.distanceKm && act.durationSec) {
    if (session.discipline === 'fietsen') result.speed = String(Math.round((act.distanceKm / (act.durationSec / 3600)) * 10) / 10);
    else if (session.discipline === 'zwemmen') result.pace = secToPaceStr(act.durationSec / (act.distanceKm * 1000 / 100));
    else if (session.discipline === 'hardlopen') result.pace = secToPaceStr(act.durationSec / act.distanceKm);
  }
  return result;
}

function computeBlockComparison(weeks) {
  const n = weeks.length;
  const blockSize = Math.min(4, Math.floor(n / 2));
  if (blockSize < 2) return null;
  const recentBlock = weeks.slice(n - blockSize);
  const priorBlock = weeks.slice(n - blockSize * 2, n - blockSize);
  if (priorBlock.length < blockSize) return null;
  function stats(block) {
    let totalKm = 0, completed = 0, total = 0; const rpes = [];
    block.forEach((w) => w.sessions.forEach((s) => {
      if (s.discipline === 'rust') return;
      total++;
      if (s.status === 'voltooid' || s.status === 'aangepast') {
        completed++;
        const d = parseFloat(s.result?.distance);
        if (!isNaN(d)) totalKm += d > 100 ? d / 1000 : d;
        if (s.result?.rpe) rpes.push(Number(s.result.rpe));
      }
    }));
    return {
      totalKm: Math.round(totalKm * 10) / 10,
      completionPct: total ? Math.round((completed / total) * 100) : 0,
      avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
      label: `${fmtDayMonth(block[0].startDate)} – ${fmtDayMonth(weekEnd(block[block.length - 1].startDate))}`,
    };
  }
  return { recent: stats(recentBlock), prior: stats(priorBlock) };
}

/* ============================== EXTRA ACTIVITEITEN & BELASTING ============================== */

// Extra activiteiten naast je triatlonschema. Ze tellen mee in je belasting (duur × RPE, de "session-RPE"-methode),
// sturen je schema bij (geen zware training op dezelfde dag of vlak voor een wedstrijd) en geven een kleine
// conditiebonus in de voorspelling. `spec` is hoe specifiek de activiteit is voor elke triatlononderdeel (0-1).
const EXTRA_KINDS = {
  fiets_transport: {
    label: 'Fietsen (transport)', short: 'Fietsen', icon: Bike, color: '#6E8B3D',
    hint: 'Naar werk, school, training of de winkel.',
    defaultRpe: 3, defaultMinutes: null, speedKmh: 18,
    spec: { zwemmen: 0, fietsen: 0.5, hardlopen: 0.1 },
  },
  waterpolo_training: {
    label: 'Waterpolo training', short: 'Training', icon: Droplets, color: '#2E7D8F',
    hint: 'Een gewone trainingsavond.',
    defaultRpe: 6, defaultMinutes: 90,
    spec: { zwemmen: 0.45, fietsen: 0.1, hardlopen: 0.15 },
  },
  waterpolo_wedstrijd: {
    label: 'Waterpolo wedstrijd', short: 'Wedstrijd', icon: Trophy, color: '#9C3D54',
    hint: 'Competitie- of toernooiwedstrijd.',
    defaultRpe: 8, defaultMinutes: 60,
    spec: { zwemmen: 0.5, fietsen: 0.1, hardlopen: 0.15 },
  },
  overig: {
    label: 'Andere activiteit', short: 'Overig', icon: Activity, color: '#8A5A44',
    hint: 'Voetbal, wandelen, klimmen, ...',
    defaultRpe: 5, defaultMinutes: 45,
    spec: { zwemmen: 0.1, fietsen: 0.1, hardlopen: 0.1 },
  },
};
const EXTRA_KIND_ORDER = ['fiets_transport', 'waterpolo_training', 'waterpolo_wedstrijd', 'overig'];

const SWIM_MULT = { duurloop: 1.15, interval: 0.9, techniek: 1.2, herstel: 1.3, 'lange training': 1.1, tempo: 1.0, openwater: 1.15, default: 1.1 };
const BIKE_MULT = { duurloop: 0.85, interval: 1.12, tempo: 1.0, herstel: 0.75, 'lange training': 0.9, klimtraining: 0.8, brick: 0.9, default: 0.9 };
const RUN_MULT = { duurloop: 1.1, interval: 0.9, tempo: 1.0, herstel: 1.2, 'lange training': 1.08, fartlek: 1.0, heuveltraining: 1.1, brick: 1.05, default: 1.05 };

// Voorspelling: referentieafstand van het intake-tempo en hoe sterk het tempo zakt naarmate de afstand toeneemt.
const PRED_DISCIPLINES = ['zwemmen', 'fietsen', 'hardlopen'];
const REF_KM = { zwemmen: 1.5, fietsen: 40, hardlopen: 10 };
const FATIGUE_EXP = { zwemmen: 1.04, fietsen: 1.03, hardlopen: 1.06 };
const RUN_OFF_BIKE = { sprint: 0.02, olympic: 0.03, half: 0.05, full: 0.08 };
const TRANSITION_SEC = { sprint: 240, olympic: 300, half: 360, full: 480 };
const DAMP_PHI = 0.85;          // verbetering vlakt af: elke week telt 85% van de vorige
const MAX_SLOPE_PER_WEEK = 0.012; // nooit meer dan 1,2% verbetering per week extrapoleren
const MAX_TOTAL_CHANGE = 0.1;     // en nooit meer dan 10% verbetering/verslechtering in totaal
const FITNESS_K = 0.05;
const FITNESS_CAP = 0.03;         // extra activiteiten geven maximaal 3% winst per onderdeel
const DEFAULT_SD = { zwemmen: 0.05, fietsen: 0.04, hardlopen: 0.045 };

function clamp(x, lo, hi) { return Math.min(Math.max(x, lo), hi); }
function toNum(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; }
function nl1(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

function extraMinutes(e) {
  const m = toNum(e.minutes);
  if (m && m > 0) return m;
  const km = toNum(e.km);
  if (e.kind === 'fiets_transport') return km && km > 0 ? (km / EXTRA_KINDS.fiets_transport.speedKmh) * 60 : 0;
  return EXTRA_KINDS[e.kind]?.defaultMinutes || 0;
}
function extraRpe(e) { return toNum(e.rpe) || EXTRA_KINDS[e.kind]?.defaultRpe || 5; }
function extraLoad(e) { return extraMinutes(e) * extraRpe(e); }
function extraLabel(e) { return e.kind === 'overig' && e.name ? e.name : (EXTRA_KINDS[e.kind]?.label || 'Activiteit'); }
// 0 = nauwelijks belasting, 1 = licht, 2 = pittig, 3 = wedstrijd
function extraHardness(e) {
  if (e.kind === 'waterpolo_wedstrijd') return 3;
  const rpe = extraRpe(e), min = extraMinutes(e);
  if (rpe >= 7 || (rpe >= 6 && min >= 75)) return 2;
  if (rpe >= 5) return 1;
  return 0;
}
function extraDetail(e) {
  const parts = [];
  const km = toNum(e.km);
  if (e.kind === 'fiets_transport' && km) parts.push(`${nl1(km)} km`);
  parts.push(`${Math.round(extraMinutes(e))} min`);
  parts.push(`RPE ${extraRpe(e)}`);
  return parts.join(' · ');
}

function sessionRpe(s) { return toNum(s.result?.rpe) || (s.discipline === 'wedstrijd' ? 8 : 5); }

// Geschatte duur (minuten) van een afgeronde schema-sessie, uit duur, of afstand + tempo.
function sessionMinutes(s, intake) {
  const r = s.result;
  if (!r || (s.status !== 'voltooid' && s.status !== 'aangepast')) return 0;
  if (s.discipline === 'kracht') {
    const m = toNum(r.duration) ?? toNum(r.distance) ?? s.target?.amount ?? 0;
    return m > 0 ? m : 0;
  }
  if (s.discipline === 'wedstrijd') { const sec = parseTargetTime(r.duration); return sec ? sec / 60 : 60; }
  if (r.duration && String(r.duration).includes(':')) { const sec = parseDurationCell(r.duration); if (sec) return sec / 60; }
  const raw = toNum(r.distance);
  let km = null;
  if (raw != null) km = s.discipline === 'zwemmen' ? (raw >= 20 ? raw / 1000 : raw) : (raw > 100 ? raw / 1000 : raw);
  if (!km && s.target) km = s.target.unit === 'm' ? s.target.amount / 1000 : s.target.unit === 'km' ? s.target.amount : null;
  if (!km) return 0;
  if (s.discipline === 'zwemmen') {
    const p = paceStrToSec(r.pace) || (paceStrToSec(intake.swim.pace) || 135) * SWIM_MULT.default;
    return (km * 10 * p) / 60;
  }
  if (s.discipline === 'fietsen') {
    const v = toNum(r.speed) || (intake.bike.speedKmh || 25) * BIKE_MULT.default;
    return (km / v) * 60;
  }
  const p = paceStrToSec(r.pace) || (paceStrToSec(intake.run.paceMinKm) || 330) * RUN_MULT.default;
  return (km * p) / 60;
}

// Belasting van één kalenderweek: afgeronde schema-sessies + extra activiteiten tot en met vandaag.
function weekLoadSummary(week, extraLog, intake, todayKey = dateKey(new Date())) {
  const start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
  const keys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
  let planMin = 0, planLoad = 0, planCount = 0;
  (week.sessions || []).forEach((s) => {
    const m = sessionMinutes(s, intake);
    if (m > 0) { planMin += m; planLoad += m * sessionRpe(s); planCount += 1; }
  });
  const inWeek = (extraLog || []).filter((e) => keys.includes(e.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const extras = inWeek.filter((e) => e.date <= todayKey);
  const upcoming = inWeek.filter((e) => e.date > todayKey);
  let exMin = 0, exLoad = 0;
  const byKind = {};
  extras.forEach((e) => {
    const m = extraMinutes(e);
    exMin += m; exLoad += extraLoad(e);
    const b = byKind[e.kind] || (byKind[e.kind] = { count: 0, minutes: 0, km: 0 });
    b.count += 1; b.minutes += m; b.km += toNum(e.km) || 0;
  });
  return { keys, planMin, planLoad, planCount, exMin, exLoad, totalMin: planMin + exMin, totalLoad: planLoad + exLoad, byKind, extras, upcoming, inWeek };
}

function weeklyLoadSeries(weeks, extraLog, intake, count = 8, endDate = new Date()) {
  const thisMonday = startOfWeek(endDate); thisMonday.setHours(0, 0, 0, 0);
  const byStart = {};
  weeks.forEach((w) => { byStart[dateKey(new Date(w.startDate))] = w; });
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(thisMonday, -7 * (count - 1 - i));
    const w = byStart[dateKey(start)] || { startDate: start.toISOString(), sessions: [] };
    return { start, label: fmtDayMonth(start), ...weekLoadSummary(w, extraLog, intake, dateKey(endDate)) };
  });
}

// Past de adaptatie van de volgende week aan op de extra belasting van de vorige week.
function computeAdaptation(prevWeek, extraLog, intake) {
  const base = computeAdaptationBase(prevWeek);
  if (!prevWeek || !extraLog || !extraLog.length) return base;
  const s = weekLoadSummary(prevWeek, extraLog, intake);
  if (s.exLoad <= 0) return base;
  const share = s.totalLoad ? s.exLoad / s.totalLoad : 0;
  const hardCount = s.extras.filter((e) => extraHardness(e) >= 2).length;
  let factor = base.factor;
  let note = `${base.note} Je extra activiteiten telden vorige week mee (${Math.round(s.exMin)} min, ${Math.round(share * 100)}% van je totale belasting).`;
  if (hardCount >= 3 || share >= 0.45) {
    if (factor > 0.95) { factor = 0.95; note += ' Dat was veel naast je schema, dus we bouwen deze week iets voorzichtiger op.'; }
  } else if (hardCount >= 2 && share >= 0.3) {
    if (factor > 1.0) { factor = 1.0; note += ' Omdat die pittig waren, houden we het volume deze week gelijk in plaats van op te bouwen.'; }
  }
  return { factor, note };
}

// Welke geplande, nog niet afgeronde sessies moeten verzacht worden vanwege een zware extra activiteit?
function planSoftening(weeks, entries) {
  const todayKey = dateKey(new Date());
  const changes = [], seen = new Set();
  entries.forEach((e) => {
    if (extraHardness(e) < 2) return;
    const targets = [{ key: e.date, why: `Aangepast omdat je die dag ook ${extraLabel(e).toLowerCase()} hebt — twee pittige belastingen op één dag is te veel.` }];
    if (e.kind === 'waterpolo_wedstrijd') {
      targets.push({ key: dateKey(addDays(new Date(`${e.date}T12:00:00`), -1)), why: 'Aangepast omdat je morgen een waterpolowedstrijd hebt — zo sta je fris aan de start.' });
    }
    targets.forEach((t) => {
      if (t.key < todayKey) return;
      weeks.forEach((w) => w.sessions.forEach((s) => {
        if (s.discipline === 'rust' || s.discipline === 'wedstrijd' || s.status !== 'gepland') return;
        if ((HARDNESS[s.type] ?? 0) < 2 || seen.has(s.id)) return;
        if (dateKey(addDays(new Date(w.startDate), s.day)) !== t.key) return;
        seen.add(s.id);
        changes.push({ weekId: w.id, sessionId: s.id, why: t.why });
      }));
    });
  });
  return changes;
}

function applySoftening(weeks, changes) {
  return weeks.map((w) => {
    const mine = changes.filter((c) => c.weekId === w.id);
    if (!mine.length) return w;
    return {
      ...w,
      sessions: w.sessions.map((s) => {
        const c = mine.find((m) => m.sessionId === s.id);
        if (!c) return s;
        const softType = softTypeFor(s.discipline);
        const guide = paceGuidance(s.discipline, softType, null);
        return {
          ...s, type: softType, intensity: `${INTENSITY[softType]}${guide ? ` · Doeltempo ${guide}` : ''}`,
          nutritionTip: NUTRITION_TIPS[softType] || null,
          coachNote: `${TYPE_TEXT[softType]} ${c.why}`,
        };
      }),
    };
  });
}

// Hint in het logboek als de nieuwe activiteit botst met een zware geplande training.
function conflictHint(dateStr, kind, rpe, minutes, weeks) {
  if (!dateStr || dateStr < dateKey(new Date())) return null;
  if (extraHardness({ kind, rpe, minutes }) < 2) return null;
  const sessionOn = (key) => {
    for (const w of weeks) for (const s of w.sessions) {
      if (dateKey(addDays(new Date(w.startDate), s.day)) === key) return s;
    }
    return null;
  };
  const isHard = (s) => s && s.discipline !== 'rust' && s.discipline !== 'wedstrijd' && s.status === 'gepland' && (HARDNESS[s.type] ?? 0) >= 2;
  const same = sessionOn(dateStr);
  if (isHard(same)) return `Op deze dag staat al een pittige training (${same.type} ${DISCIPLINE_META[same.discipline].label.toLowerCase()}). Die wordt automatisch verzacht, zodat je niet twee zware belastingen op één dag hebt.`;
  if (kind === 'waterpolo_wedstrijd') {
    const before = sessionOn(dateKey(addDays(new Date(`${dateStr}T12:00:00`), -1)));
    if (isHard(before)) return `De dag ervoor staat een pittige training (${before.type} ${DISCIPLINE_META[before.discipline].label.toLowerCase()}). Die wordt automatisch verzacht, zodat je fris aan de wedstrijd begint.`;
  }
  return null;
}

/* ============================== VOORSPELLING ============================== */

function weightedFit(points, latestX, halfLife = 4) {
  const w = points.map((p) => Math.pow(0.5, (latestX - p.x) / halfLife));
  const sw = w.reduce((a, b) => a + b, 0);
  const mx = points.reduce((a, p, i) => a + w[i] * p.x, 0) / sw;
  const my = points.reduce((a, p, i) => a + w[i] * p.y, 0) / sw;
  const sxx = points.reduce((a, p, i) => a + w[i] * (p.x - mx) ** 2, 0);
  const sxy = points.reduce((a, p, i) => a + w[i] * (p.x - mx) * (p.y - my), 0);
  return { w, sw, mx, my, sxx, sxy };
}

// Schat voor één onderdeel het huidige niveau en het niveau op wedstrijddag.
// Recente resultaten wegen zwaarder (halfwaardetijd 4 weken), je intake telt als "prior" (gewicht 2 resultaten),
// en de trend vlakt af naar de wedstrijd toe (gedempte trend) in plaats van rechtdoor te extrapoleren.
function estimateDiscipline(points, prior, goalEndWeek, discipline) {
  const n = points.length;
  if (!n) {
    return { n: 0, current: prior, projected: prior, slope: 0, trendUsed: false, priorShare: 1, sdRel: DEFAULT_SD[discipline], firstWeek: null, lastWeek: null, h: null };
  }
  const pts = points.map((p) => ({ x: p.week, y: p.value }));
  const xs = pts.map((p) => p.x);
  const latestX = Math.max(...xs), firstX = Math.min(...xs);
  const f = weightedFit(pts, latestX);
  const trendUsed = n >= 4 && new Set(xs).size >= 3 && f.sxx > 0;
  const rawSlope = trendUsed ? f.sxy / f.sxx : 0;
  const dataLevel = trendUsed ? f.my + rawSlope * (latestX - f.mx) : f.my;
  const slope = clamp(rawSlope, -Math.abs(dataLevel) * MAX_SLOPE_PER_WEEK, Math.abs(dataLevel) * MAX_SLOPE_PER_WEEK);
  const resSd = Math.sqrt(pts.reduce((a, p, i) => a + f.w[i] * (p.y - (f.my + rawSlope * (p.x - f.mx))) ** 2, 0) / f.sw);
  const priorShare = 2 / (n + 2);
  const current = dataLevel * (1 - priorShare) + prior * priorShare;
  const h = Math.max(goalEndWeek - latestX, 0);
  const damp = h > 0 ? (DAMP_PHI * (1 - Math.pow(DAMP_PHI, h))) / (1 - DAMP_PHI) : 0;
  const projected = clamp(current + slope * damp, current * (1 - MAX_TOTAL_CHANGE), current * (1 + MAX_TOTAL_CHANGE));
  const sdRel = n >= 3 ? clamp(resSd / dataLevel, 0.02, 0.08) : DEFAULT_SD[discipline];
  return { n, current, projected, slope, trendUsed, priorShare, sdRel, firstWeek: firstX, lastWeek: latestX, h, damp };
}

// Conditiebonus uit extra activiteiten van de afgelopen 4 weken (alleen wat al geweest is).
function computeFitnessBonus(extraLog, intake, today, nByDisc) {
  const todayKey = dateKey(today);
  const fromKey = dateKey(addDays(today, -27));
  const recent = (extraLog || []).filter((e) => e.date >= fromKey && e.date <= todayKey);
  const out = { active: false, perDisc: {}, counts: {}, spanWeeks: 0 };
  if (!recent.length) return out;
  const first = recent.reduce((m, e) => (e.date < m ? e.date : m), recent[0].date);
  const spanWeeks = clamp((calendarDaysUntil(new Date(`${first}T00:00:00`), todayKey) + 1) / 7, 1, 4);
  const baseMin = {
    zwemmen: Math.max(((intake.swim.volumeKm || 0) * 10 * (paceStrToSec(intake.swim.pace) || 135)) / 60, 45),
    fietsen: Math.max(((intake.bike.volumeKm || 0) / (intake.bike.speedKmh || 25)) * 60, 60),
    hardlopen: Math.max(((intake.run.volumeKm || 0) * (paceStrToSec(intake.run.paceMinKm) || 330)) / 60, 45),
  };
  PRED_DISCIPLINES.forEach((d) => {
    let eq = 0;
    recent.forEach((e) => { eq += extraMinutes(e) * (EXTRA_KINDS[e.kind]?.spec?.[d] || 0) * clamp(extraRpe(e) / 6, 0.5, 1.4); });
    eq /= spanWeeks;
    const raw = Math.min(FITNESS_CAP, (FITNESS_K * eq) / baseMin[d]);
    const dataWeight = 1 - Math.min(0.6, (nByDisc[d] || 0) / 10);
    out.perDisc[d] = { bonus: raw * dataWeight, rawBonus: raw, dataWeight, equivMin: eq, baseMin: baseMin[d] };
  });
  recent.forEach((e) => {
    const b = out.counts[e.kind] || (out.counts[e.kind] = { count: 0, minutes: 0, km: 0 });
    b.count += 1; b.minutes += extraMinutes(e); b.km += toNum(e.km) || 0;
  });
  out.active = true; out.spanWeeks = spanWeeks;
  return out;
}

function raceBasedEstimate(weeks, mainGoal, today) {
  const dist = RACE_TYPES[mainGoal.raceType];
  const targetKm = dist.swim + dist.bike + dist.run;
  const races = [];
  weeks.forEach((w) => w.sessions.forEach((s) => {
    if (s.discipline !== 'wedstrijd' || s.status !== 'voltooid' || !s.result || !s.result.duration) return;
    const sec = parseTargetTime(s.result.duration);
    const rt = RACE_ADD_TYPES.find((t) => t.label === s.type && !t.manual);
    if (!sec || !rt) return;
    const date = addDays(new Date(w.startDate), s.day);
    const ageWeeks = Math.max(daysBetween(today, date) / 7, 0);
    const sameType = rt.key === mainGoal.raceType;
    const scaled = sameType ? sec : sec * Math.pow(targetKm / rt.totalKm, RIEGEL_EXPONENT);
    const score = Math.pow(0.5, ageWeeks / 10) * (sameType ? 1 : 0.75);
    races.push({ sec, scaled, date, name: s.raceName || s.type, sameType, score, srcKm: rt.totalKm, ageWeeks });
  }));
  if (!races.length) return null;
  const sumScore = races.reduce((a, r) => a + r.score, 0);
  const seconds = races.reduce((a, r) => a + r.scaled * r.score, 0) / (sumScore || 1);
  const best = races.reduce((m, r) => (r.score > m.score ? r : m), races[0]);
  return { seconds, weight: clamp(0.7 * best.score, 0.2, 0.7), best, count: races.length, sourceName: best.name, sourceDate: best.date, sameType: best.sameType };
}

function fmtDiscVal(d, v) {
  if (d === 'fietsen') return `${nl1(v)} km/u`;
  return `${secToPaceStr(v)} /${d === 'zwemmen' ? '100m' : 'km'}`;
}

function buildPrediction({ weeks, intake, mainGoal, goalEndWeek, extraLog = [], today = new Date() }) {
  if (!weeks.length) return null;
  const raceType = mainGoal.raceType;
  const dist = RACE_TYPES[raceType];
  const MULTS = { zwemmen: SWIM_MULT, fietsen: BIKE_MULT, hardlopen: RUN_MULT };
  const priors = {
    zwemmen: paceStrToSec(intake.swim.pace) || 135,
    fietsen: Number(intake.bike.speedKmh) || 25,
    hardlopen: paceStrToSec(intake.run.paceMinKm) || 330,
  };

  // 1. Resultaten omrekenen naar één vergelijkbaar niveau (een rustige duurtraining is langzamer dan een tempotraining)
  const series = {}, ignored = {};
  PRED_DISCIPLINES.forEach((d) => {
    const pts = []; ignored[d] = 0;
    weeks.forEach((w) => w.sessions.forEach((s) => {
      if (s.discipline !== d || s.status !== 'voltooid' || !s.result) return;
      const raw = d === 'fietsen' ? toNum(s.result.speed) : paceStrToSec(s.result.pace);
      if (raw == null || raw <= 0) return;
      const v = raw / (MULTS[d][s.type] ?? MULTS[d].default);
      if (v < priors[d] * 0.6 || v > priors[d] * 1.6) { ignored[d] += 1; return; } // waarschijnlijk een typfout
      pts.push({ week: w.weekNumber, value: v });
    }));
    series[d] = pts;
  });

  // 2. Niveau + gedempte trend per onderdeel
  const est = {};
  PRED_DISCIPLINES.forEach((d) => { est[d] = estimateDiscipline(series[d], priors[d], goalEndWeek, d); est[d].prior = priors[d]; est[d].ignored = ignored[d]; });

  // 3. Conditiebonus uit extra activiteiten
  const fit = computeFitnessBonus(extraLog, intake, today, { zwemmen: est.zwemmen.n, fietsen: est.fietsen.n, hardlopen: est.hardlopen.n });
  PRED_DISCIPLINES.forEach((d) => {
    const b = fit.perDisc[d]?.bonus || 0;
    est[d].bonus = b;
    est[d].final = d === 'fietsen' ? est[d].projected * (1 + b) : est[d].projected * (1 - b);
  });

  // 4. Naar de wedstrijdafstand rekenen: tempo zakt bij langere afstanden, en je loopt na het fietsen langzamer
  const scale = {};
  PRED_DISCIPLINES.forEach((d) => {
    const km = d === 'zwemmen' ? dist.swim : d === 'fietsen' ? dist.bike : dist.run;
    scale[d] = { km, factor: Math.pow(km / REF_KM[d], FATIGUE_EXP[d] - 1) };
  });
  const offBike = RUN_OFF_BIKE[raceType] ?? 0.03;
  const swimPace = est.zwemmen.final * scale.zwemmen.factor;
  const bikeSpeed = est.fietsen.final / scale.fietsen.factor;
  const runPace = est.hardlopen.final * scale.hardlopen.factor * (1 + offBike);
  let swimTime = scale.zwemmen.km * 10 * swimPace;
  let bikeTime = (scale.fietsen.km / bikeSpeed) * 3600;
  let runTime = scale.hardlopen.km * runPace;
  const transition = TRANSITION_SEC[raceType] ?? 300;
  const paceBasedTotal = swimTime + bikeTime + runTime + transition;

  // 5. Eventueel een recent wedstrijdresultaat meewegen
  const raceBased = raceBasedEstimate(weeks, mainGoal, today);
  const wRace = raceBased ? raceBased.weight : 0;
  const total = raceBased ? paceBasedTotal * (1 - wRace) + raceBased.seconds * wRace : paceBasedTotal;
  if (raceBased) { // splits optellen tot het totaal
    const k = (total - transition) / (swimTime + bikeTime + runTime);
    swimTime *= k; bikeTime *= k; runTime *= k;
  }

  // 6. Marge en betrouwbaarheid
  const lastWeekNum = weeks[weeks.length - 1].weekNumber;
  const hMax = Math.max(goalEndWeek - lastWeekNum, 0);
  const sd = Math.sqrt(
    (swimTime * est.zwemmen.sdRel) ** 2 + (bikeTime * est.fietsen.sdRel) ** 2 + (runTime * est.hardlopen.sdRel) ** 2
    + (total * 0.007 * Math.sqrt(Math.max(hMax, 1))) ** 2,
  );
  const margin = 1.28 * sd * (raceBased ? 1 - 0.3 * wRace : 1);

  const nTotal = PRED_DISCIPLINES.reduce((a, d) => a + est[d].n, 0);
  const withData = PRED_DISCIPLINES.filter((d) => est[d].n >= 2);
  const missing = PRED_DISCIPLINES.filter((d) => est[d].n < 2).map((d) => DISCIPLINE_META[d].label.toLowerCase());
  const latestResultWeek = Math.max(0, ...PRED_DISCIPLINES.map((d) => est[d].lastWeek || 0));
  let score = 0;
  const reasons = [];
  if (nTotal >= 12) score += 3; else if (nTotal >= 6) score += 2; else if (nTotal >= 3) score += 1;
  reasons.push(nTotal === 0 ? 'Nog geen trainingsresultaten ingevuld — de voorspelling rust op je intake.' : `${nTotal} trainingsresultaten verwerkt.`);
  if (withData.length === 3) score += 2; else if (withData.length === 2) score += 1;
  if (missing.length) reasons.push(`Te weinig resultaten voor ${missing.join(' en ')} (minimaal 2 nodig).`);
  if (nTotal > 0 && lastWeekNum - latestResultWeek <= 2) score += 1;
  else if (nTotal > 0) reasons.push('Je laatste resultaat is al wat ouder.');
  if (raceBased) { score += 2; reasons.push('Een wedstrijdresultaat is meegewogen.'); }
  if (hMax > 16) { score -= 1; reasons.push(`Nog ${hMax} weken te gaan: ver vooruit voorspellen is onzekerder.`); }
  else if (hMax <= 6) score += 1;
  const level = score >= 6 ? 'goed' : score >= 3 ? 'redelijk' : 'laag';

  let statusLabel = null;
  if (mainGoal.ambition === 'target' && mainGoal.targetTime) {
    const targetSec = parseTargetTime(mainGoal.targetTime);
    if (targetSec) {
      if (total <= targetSec * 1.03) statusLabel = 'op koers';
      else if (total <= targetSec * 1.12) statusLabel = 'lichte achterstand';
      else statusLabel = 'actie nodig';
    }
  }

  // 7. Uitleg: waar is het op gebaseerd?
  const disciplineBasis = {};
  PRED_DISCIPLINES.forEach((d) => {
    const e = est[d], parts = [];
    if (e.n === 0) {
      parts.push(`Nog geen resultaten ingevuld: gebaseerd op het tempo uit je intake (${fmtDiscVal(d, e.prior)}).`);
    } else {
      parts.push(`${e.n} ${e.n === 1 ? 'resultaat' : 'resultaten'} uit week ${e.firstWeek}${e.lastWeek !== e.firstWeek ? `–${e.lastWeek}` : ''}, omgerekend naar vergelijkbaar wedstrijdniveau. Huidig niveau: ${fmtDiscVal(d, e.current)}${e.priorShare >= 0.15 ? ` (je intake telt nog voor ${Math.round(e.priorShare * 100)}% mee)` : ''}.`);
      if (e.trendUsed) {
        const perWeek = d === 'fietsen'
          ? `${e.slope >= 0 ? '+' : '−'}${(Math.abs(e.slope)).toFixed(2).replace('.', ',')} km/u`
          : `${e.slope <= 0 ? '−' : '+'}${Math.abs(e.slope).toFixed(1).replace('.', ',')} sec/${d === 'zwemmen' ? '100m' : 'km'}`;
        parts.push(`Trend: ${perWeek} per week${e.h > 0 ? `, gedempt over de ${e.h} weken tot de wedstrijd omdat verbetering afvlakt` : ''}.`);
      } else {
        parts.push('Nog geen betrouwbare trend (daarvoor zijn minstens 4 resultaten over 3 weken nodig), dus rekenen we met je huidige niveau.');
      }
    }
    if (e.bonus > 0.0005) parts.push(`Extra activiteiten: ${nl1(e.bonus * 100)}% sneller meegerekend.`);
    if (e.ignored) parts.push(`${e.ignored} onwaarschijnlijke ${e.ignored === 1 ? 'waarde' : 'waarden'} genegeerd (typfout?).`);
    disciplineBasis[d] = parts.join(' ');
  });

  const extras = [];
  if (fit.active) {
    const per = Object.entries(fit.counts).map(([k, c]) => `${nl1(c.count / fit.spanWeeks)}× ${EXTRA_KINDS[k].label.toLowerCase()}${c.km ? ` (${nl1(c.km / fit.spanWeeks)} km)` : ''}`);
    const eq = PRED_DISCIPLINES.map((d) => `${Math.round(fit.perDisc[d].equivMin)} min ${d === 'zwemmen' ? 'zwem' : d === 'fietsen' ? 'fiets' : 'loop'}-`).join(', ');
    extras.push({
      title: 'Extra activiteiten',
      text: `Gemiddeld per week in de afgelopen ${nl1(fit.spanWeeks)} ${fit.spanWeeks <= 1 ? 'week' : 'weken'}: ${per.join(', ')}. Dat telt als ongeveer ${eq}training-equivalent per week (naar hoe specifiek de activiteit is en hoe hard die was). Dat levert maximaal ${Math.round(FITNESS_CAP * 100)}% winst per onderdeel op, en minder naarmate je meer resultaten invult — die laten je conditie dan al zien.`,
    });
  } else {
    extras.push({ title: 'Extra activiteiten', text: 'Geen extra activiteiten in de afgelopen 4 weken. Log je fietsritten naar werk en waterpolo in het Logboek: die tellen mee voor je conditie.' });
  }
  if (raceBased) {
    extras.push({
      title: 'Wedstrijdresultaat',
      text: `${raceBased.sourceName} (${fmtDate(raceBased.sourceDate)}) weegt voor ${Math.round(wRace * 100)}% mee${raceBased.sameType ? '' : ', omgerekend naar jouw wedstrijdafstand'}. Een oudere wedstrijd telt minder zwaar.`,
    });
  }
  const pct = (x) => `${x >= 0 ? '+' : '−'}${nl1(Math.abs(x * 100))}%`;
  const corr = [];
  if (Math.abs(scale.zwemmen.factor - 1) >= 0.0025) corr.push(`zwemtempo ${pct(scale.zwemmen.factor - 1)}`);
  if (Math.abs(scale.fietsen.factor - 1) >= 0.0025) corr.push(`fietssnelheid ${pct(1 / scale.fietsen.factor - 1)}`);
  if (Math.abs(scale.hardlopen.factor - 1) >= 0.0025) corr.push(`looptempo ${pct(scale.hardlopen.factor - 1)}`);
  extras.push({
    title: 'Afstand en wissels',
    text: `Wedstrijdafstand: ${nl1(dist.swim)} km zwemmen, ${nl1(dist.bike)} km fietsen, ${nl1(dist.run)} km hardlopen. ${corr.length ? `Omdat je tempo zakt naarmate de afstand toeneemt, is gerekend met ${corr.join(', ')} ten opzichte van een olympische afstand. ` : 'Dat is de afstand waar je intake-tempo voor geldt, dus daar is niets voor gecorrigeerd. '}Hardlopen is daarnaast ${Math.round(offBike * 100)}% langzamer gerekend omdat je van de fiets komt. Wissels: ${Math.round(transition / 60)} min.`,
  });
  const assumptions = [
    'Je intake-tempo geldt als wedstrijdniveau op een olympische afstand; trainingen zijn daarop omgerekend per type (rustig, interval, lang).',
    'Verbetering vlakt af en we gaan nooit uit van meer dan 10% winst op een onderdeel.',
    'Geen rekening met weer, golven, wetsuit, parcours of dagvorm.',
  ];

  return {
    swimTime, bikeTime, runTime, transition, total, low: total - margin, high: total + margin, margin,
    paceBasedTotal, statusLabel, hasData: true, hasResults: nTotal > 0, raceBased,
    confidence: { level, score, reasons },
    disciplines: est, disciplineBasis, extras, assumptions, fitness: fit,
  };
}

function PredictionDetails({ prediction, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!prediction) return null;
  const conf = prediction.confidence;
  const c = { laag: { bg: '#F7DAD3', fg: 'var(--danger)' }, redelijk: { bg: '#F6E3C0', fg: 'var(--warning)' }, goed: { bg: 'var(--success-bg)', fg: 'var(--success)' } }[conf.level];
  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="tri-pill" onClick={() => setOpen((o) => !o)}
        style={{ background: 'var(--sand)', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>
        <Info size={14} /> Waarop is dit gebaseerd? {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="tri-badge" style={{ background: c.bg, color: c.fg }}>Betrouwbaarheid: {conf.level}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>indicatieve marge ± {Math.max(Math.round(prediction.margin / 60), 1)} min</span>
          </div>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>
            {conf.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {PRED_DISCIPLINES.map((d) => {
            const meta = DISCIPLINE_META[d];
            const time = d === 'zwemmen' ? prediction.swimTime : d === 'fietsen' ? prediction.bikeTime : prediction.runTime;
            return (
              <div key={d} style={{ padding: '10px 0', borderTop: '1px solid var(--sand)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                  <meta.icon size={16} color={meta.color} /><span style={{ flex: 1 }}>{meta.label}</span>
                  <span style={{ fontFamily: 'Fraunces, serif' }}>{secToHMS(time)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Verwacht niveau op wedstrijddag: {fmtDiscVal(d, prediction.disciplines[d].final)}. {prediction.disciplineBasis[d]}
                </div>
              </div>
            );
          })}
          {prediction.extras.map((x) => (
            <div key={x.title} style={{ padding: '10px 0', borderTop: '1px solid var(--sand)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{x.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{x.text}</div>
            </div>
          ))}
          <div style={{ padding: '10px 0 0', borderTop: '1px solid var(--sand)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Aannames</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>
              {prediction.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== LOGBOEK (extra activiteiten) ============================== */

function LogTab({ extraLog, weeks, intake, onAdd, onRemove, onGoSchedule }) {
  const todayKey = dateKey(new Date());
  const lastOfKind = (k) => [...extraLog].filter((e) => e.kind === k).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const initFor = (k) => {
    const l = lastOfKind(k), d = EXTRA_KINDS[k];
    return {
      km: k === 'fiets_transport' ? (l?.km ?? '') : '',
      minutes: k === 'fiets_transport' ? '' : (l?.minutes ?? d.defaultMinutes ?? ''),
      rpe: l?.rpe ?? d.defaultRpe,
      name: k === 'overig' ? (l?.name ?? '') : '',
    };
  };
  const weekdayOf = (dateStr) => (new Date(`${dateStr}T12:00:00`).getDay() + 6) % 7;

  const [kind, setKind] = useState('fiets_transport');
  const [date, setDate] = useState(todayKey);
  const [days, setDays] = useState([weekdayOf(todayKey)]);
  const [form, setForm] = useState(() => initFor('fiets_transport'));
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState(0);
  const [msg, setMsg] = useState('');

  const meta = EXTRA_KINDS[kind];
  const kmNum = toNum(form.km), minNum = toNum(form.minutes);
  const valid = kind === 'fiets_transport' ? kmNum > 0 : minNum > 0;
  const weekStart = startOfWeek(new Date(`${date}T12:00:00`));
  const chosenDates = [];
  for (let i = 0; i <= repeat; i++) days.forEach((dIdx) => chosenDates.push(dateKey(addDays(weekStart, dIdx + 7 * i))));
  chosenDates.sort();
  const hint = valid && chosenDates.length ? conflictHint(chosenDates[0], kind, form.rpe, minNum, weeks) : null;

  function pickKind(k) { setKind(k); setForm(initFor(k)); setRepeat(0); setMsg(''); }
  function pickDate(v) { setDate(v); if (v) setDays([weekdayOf(v)]); setMsg(''); }
  function toggleDay(i) { setDays((cur) => (cur.includes(i) ? (cur.length > 1 ? cur.filter((x) => x !== i) : cur) : [...cur, i].sort((a, b) => a - b))); }

  function save() {
    if (!valid || !chosenDates.length) return;
    const entries = chosenDates.map((d) => ({
      id: uid('x'), date: d, kind,
      km: kind === 'fiets_transport' ? kmNum : null,
      minutes: minNum > 0 ? minNum : null,
      rpe: Number(form.rpe),
      name: kind === 'overig' ? form.name.trim() : '',
      notes: notes.trim(),
    }));
    const softened = onAdd(entries);
    setMsg(`${entries.length === 1 ? 'Activiteit' : `${entries.length} activiteiten`} toegevoegd.${softened ? ` ${softened === 1 ? 'Eén training is' : `${softened} trainingen zijn`} verzacht in je schema.` : ''}`);
    setNotes(''); setRepeat(0);
  }

  const series = useMemo(() => weeklyLoadSeries(weeks, extraLog, intake, 8), [weeks, extraLog, intake]);
  const thisWeek = series[series.length - 1];
  const lastFull = series[series.length - 2];
  const before = series.slice(-6, -2).filter((s) => s.totalLoad > 0);
  const beforeAvg = before.length ? before.reduce((a, s) => a + s.totalLoad, 0) / before.length : 0;
  const ratio = lastFull && beforeAvg > 0 ? lastFull.totalLoad / beforeAvg : null;
  const chartData = series.map((s) => ({ week: s.label, Schema: Math.round(s.planMin), Extra: Math.round(s.exMin) }));
  const recent = [...extraLog].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);

  return (
    <div className="tri-scroll">
      <div className="tri-card">
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Activiteit toevoegen</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Alles wat bijdraagt aan je conditie, ook buiten je trainingsschema. Een datum in de toekomst mag ook: dan houdt je schema er rekening mee.</p>
        <div className="tri-choice-grid" style={{ marginBottom: 14 }}>
          {EXTRA_KIND_ORDER.map((k) => {
            const m = EXTRA_KINDS[k];
            return (
              <button key={k} className={`tri-choice ${kind === k ? 'selected' : ''}`} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => pickKind(k)}>
                <m.icon size={20} color={kind === k ? 'var(--terracotta)' : m.color} />{m.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-6px 0 12px' }}>{meta.hint}</p>

        <div className="tri-field"><label className="tri-label">Datum</label>
          <input type="date" className="tri-input" value={date} onChange={(e) => pickDate(e.target.value)} /></div>
        <div className="tri-field"><label className="tri-label">Dagen in die week</label>
          <div className="tri-daytab">
            {DAYS.map((label, i) => {
              const sel = days.includes(i);
              return (
                <button key={i} className="tri-choice" style={{ padding: '8px 12px', fontSize: 13, minHeight: 40, borderColor: sel ? 'var(--terracotta)' : undefined, background: sel ? '#FDEEE4' : undefined, color: sel ? 'var(--terracotta)' : undefined }}
                  onClick={() => toggleDay(i)}>{label}</button>
              );
            })}
          </div>
        </div>

        {kind === 'fiets_transport' ? (
          <div className="tri-row">
            <div className="tri-field"><label className="tri-label">Afstand per dag (km)</label>
              <input type="number" inputMode="decimal" step="0.5" min="0" className="tri-input" placeholder="bv. 12" value={form.km} onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))} /></div>
            <div className="tri-field"><label className="tri-label">Duur (min, optioneel)</label>
              <input type="number" inputMode="numeric" min="0" className="tri-input" placeholder={kmNum > 0 ? `≈ ${Math.round((kmNum / EXTRA_KINDS.fiets_transport.speedKmh) * 60)}` : 'automatisch'} value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} /></div>
          </div>
        ) : (
          <>
            {kind === 'overig' && (
              <div className="tri-field"><label className="tri-label">Wat deed je?</label>
                <input className="tri-input" placeholder="bv. voetbal, wandelen" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            )}
            <div className="tri-field"><label className="tri-label">Duur (min)</label>
              <input type="number" inputMode="numeric" min="0" className="tri-input" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} /></div>
          </>
        )}
        <div className="tri-field"><label className="tri-label">Hoe zwaar? RPE (1-10): {form.rpe}</label>
          <input type="range" min="1" max="10" value={form.rpe} onChange={(e) => setForm((f) => ({ ...f, rpe: e.target.value }))} style={{ width: '100%' }} /></div>
        <div className="tri-field"><label className="tri-label">Herhalen</label>
          <select className="tri-select" value={repeat} onChange={(e) => setRepeat(+e.target.value)}>
            <option value={0}>Alleen die week</option>
            {[1, 2, 3, 5, 7, 11].map((n) => <option key={n} value={n}>Nog {n} {n === 1 ? 'week' : 'weken'} erbij</option>)}
          </select></div>
        <div className="tri-field"><label className="tri-label">Notitie (optioneel)</label>
          <input className="tri-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        {hint && (
          <div style={{ background: '#F6E3C0', borderRadius: 12, padding: 10, fontSize: 13, marginBottom: 12, display: 'flex', gap: 8 }}>
            <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} /><span>{hint}</span>
          </div>
        )}
        <button className="tri-btn tri-btn-primary tri-btn-block" disabled={!valid} onClick={save} style={{ opacity: valid ? 1 : 0.5 }}>
          <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {chosenDates.length > 1 ? `${chosenDates.length} activiteiten toevoegen` : 'Toevoegen'}
        </button>
        {msg && <p style={{ fontSize: 13, color: 'var(--success)', margin: '10px 0 0' }}>{msg}</p>}
      </div>

      <div className="tri-card">
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Deze week tot nu toe</h3>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center', background: '#F2E9DC', borderRadius: 12, padding: '10px 4px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif' }}>{Math.round(thisWeek.planMin)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>min schema</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: '#DCEBEE', borderRadius: 12, padding: '10px 4px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: '#2E7D8F' }}>{Math.round(thisWeek.exMin)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>min extra</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: '#FDEEE4', borderRadius: 12, padding: '10px 4px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: 'var(--terracotta)' }}>{Math.round(thisWeek.totalLoad)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>belasting</div>
          </div>
        </div>
        {Object.keys(thisWeek.byKind).length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Nog geen extra activiteiten deze week.</p>}
        {EXTRA_KIND_ORDER.filter((k) => thisWeek.byKind[k]).map((k) => {
          const b = thisWeek.byKind[k], m = EXTRA_KINDS[k];
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
              <m.icon size={16} color={m.color} />
              <span style={{ flex: 1 }}>{m.label}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{b.count}× · {b.km ? `${nl1(b.km)} km · ` : ''}{Math.round(b.minutes)} min</span>
            </div>
          );
        })}
        {thisWeek.upcoming.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>Nog gepland deze week: {thisWeek.upcoming.map((e) => `${DAYS[weekdayOf(e.date)]} ${extraLabel(e).toLowerCase()}`).join(', ')}.</p>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>Belasting = duur × RPE, van je afgeronde schema-trainingen en extra activiteiten samen.</p>
        {ratio != null && ratio > 1.3 && (
          <p style={{ fontSize: 13, color: 'var(--warning)', margin: '10px 0 0' }}>Vorige week was je totale belasting {Math.round((ratio - 1) * 100)}% hoger dan je gemiddelde van de weken ervoor. Gun jezelf voldoende herstel.</p>
        )}
        {ratio != null && ratio < 0.7 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>Vorige week lag je totale belasting {Math.round((1 - ratio) * 100)}% onder je gemiddelde van de weken ervoor.</p>
        )}
        <button className="tri-btn tri-btn-secondary" style={{ marginTop: 12, minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={onGoSchedule}>Naar weekschema</button>
      </div>

      <div className="tri-card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Trainingstijd per week (min)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#EFE2CB" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8A7460' }} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tick={{ fontSize: 12, fill: '#8A7460' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Schema" stackId="a" fill="#E9D7B8" />
            <Bar dataKey="Extra" stackId="a" fill="#2E7D8F" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="tri-card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Laatste activiteiten</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Geplande activiteiten tellen mee zodra de datum voorbij is. Was je er niet? Verwijder ze dan.</p>
        {recent.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Nog niets toegevoegd.</p>}
        {recent.map((e) => {
          const m = EXTRA_KINDS[e.kind] || EXTRA_KINDS.overig;
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--sand)' }}>
              <m.icon size={18} color={m.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{extraLabel(e)} {e.date > todayKey && <span className="tri-badge" style={{ background: 'var(--sand)', color: 'var(--muted)', marginLeft: 4 }}>gepland</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(e.date)} · {extraDetail(e)}{e.notes ? ` · ${e.notes}` : ''}</div>
              </div>
              <button className="tri-btn tri-btn-secondary" style={{ minHeight: 36, padding: '6px 10px' }} onClick={() => onRemove(e.id)} aria-label="Verwijderen"><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== APP ============================== */

export default function App() {
  const [stage, setStage] = useState('onboarding');
  const [obStep, setObStep] = useState(0);
  const [mainGoal, setMainGoal] = useState({ raceType: 'olympic', raceDate: '', ambition: 'finish', targetTime: '' });
  const [subGoals, setSubGoals] = useState([]);
  const [pastGoals, setPastGoals] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [extraLog, setExtraLog] = useState([]);
  const [ngStep, setNgStep] = useState(0);
  const [ngDraft, setNgDraft] = useState({ raceType: 'olympic', raceDate: '', ambition: 'finish', targetTime: '' });
  const [ngFinishTime, setNgFinishTime] = useState('');
  const [newSubGoal, setNewSubGoal] = useState({ text: '', targetDate: '' });
  const [intake, setIntake] = useState({
    swim: { volumeKm: 3, pace: '2:15', experience: 'gevorderd', targetVolumeKm: null },
    bike: { volumeKm: 80, speedKmh: 28, experience: 'gevorderd', targetVolumeKm: null },
    run: { volumeKm: 25, paceMinKm: '5:30', experience: 'gevorderd', targetVolumeKm: null },
    strength: { sessionsPerWeek: 1, experience: 'gevorderd' },
    daysPerWeek: 5,
    injuries: '',
  });
  const [weeks, setWeeks] = useState([]);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dayPickerFor, setDayPickerFor] = useState(null);
  const [openResultFor, setOpenResultFor] = useState(null);
  const [progressSubTab, setProgressSubTab] = useState('tempo');
  const [progressDiscipline, setProgressDiscipline] = useState('zwemmen');
  const [editingGoal, setEditingGoal] = useState(false);
  const [resultsWeekIndex, setResultsWeekIndex] = useState(0);
  const [defaultDays, setDefaultDays] = useState({ zwemmen: [], fietsen: [], hardlopen: [], kracht: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | saving | saved | error

  // Instant load from this device, then reconcile with Google Sheets in the background
  useEffect(() => {
    const local = loadLocal();
    if (local) hydrate(local);
    (async () => {
      if (hasRemote()) {
        const remote = await loadRemote();
        if (remote) { hydrate(remote); setSyncStatus('saved'); }
        else setSyncStatus(local ? 'local-only' : 'idle');
      } else {
        setSyncStatus('local-only');
      }
      setLoaded(true);
    })();

    function hydrate(data) {
      if (data.stage) setStage(data.stage);
      if (data.mainGoal) setMainGoal(data.mainGoal);
      if (data.subGoals) setSubGoals(data.subGoals);
      if (data.pastGoals) setPastGoals(data.pastGoals);
      if (data.holidays) setHolidays(data.holidays);
      if (data.extraLog) setExtraLog(data.extraLog);
      if (data.intake) setIntake(data.intake);
      if (data.weeks) setWeeks(data.weeks);
      if (data.totalWeeks) setTotalWeeks(data.totalWeeks);
      if (data.defaultDays) setDefaultDays(data.defaultDays);
      if (typeof data.currentWeekIndex === 'number') setCurrentWeekIndex(data.currentWeekIndex);
      if (typeof data.resultsWeekIndex === 'number') setResultsWeekIndex(data.resultsWeekIndex);
    }
  }, []);

  // Autosave (debounced): always to this device instantly, and to Google Sheets when configured
  useEffect(() => {
    if (!loaded) return;
    const snapshot = { stage: stage === 'newgoal' ? 'app' : stage, mainGoal, subGoals, pastGoals, holidays, extraLog, intake, weeks, totalWeeks, defaultDays, currentWeekIndex, resultsWeekIndex };
    saveLocal(snapshot);
    if (!hasRemote()) { setSyncStatus('local-only'); return; }
    setSyncStatus('saving');
    const t = setTimeout(async () => {
      const ok = await saveRemote(snapshot);
      setSyncStatus(ok ? 'saved' : 'error');
    }, 900);
    return () => clearTimeout(t);
  }, [loaded, stage, mainGoal, subGoals, pastGoals, holidays, extraLog, intake, weeks, totalWeeks, defaultDays, currentWeekIndex, resultsWeekIndex]);

  function resetAllData() {
    saveLocal(null);
    if (hasRemote()) saveRemote({});
    setStage('onboarding'); setObStep(0);
    setMainGoal({ raceType: 'olympic', raceDate: '', ambition: 'finish', targetTime: '' });
    setSubGoals([]); setPastGoals([]); setHolidays([]); setExtraLog([]); setWeeks([]); setTotalWeeks(12); setCurrentWeekIndex(0); setResultsWeekIndex(0);
    setDefaultDays({ zwemmen: [], fietsen: [], hardlopen: [], kracht: [] });
    setShowSettings(false);
  }

  const currentWeek = weeks[currentWeekIndex];

  // De laatste week zonder (grotendeels) vakantie: die gebruiken we als ijkpunt voor de
  // volumeopbouw, zodat een vakantieweek de rest van het plan niet naar beneden trekt.
  function volumeRefWeek(list) {
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i].holiday;
      if (!h || h.restDays + h.lightDays < 3) return list[i];
    }
    return null;
  }

  function weekHasInput(w) {
    return w.sessions.some((s) => s.status !== 'gepland' || s.result);
  }

  // Na het toevoegen of verwijderen van een vakantie: alle nog niet begonnen toekomstige
  // weken opnieuw opbouwen, zodat de vakantie meteen in je planning zichtbaar is.
  function rebuildFutureWeeks(nextHolidays) {
    const thisMonday = startOfWeek(new Date()); thisMonday.setHours(0, 0, 0, 0);
    setWeeks((ws) => {
      const out = [...ws];
      let changed = false;
      for (let i = 0; i < out.length; i++) {
        const start = new Date(out[i].startDate); start.setHours(0, 0, 0, 0);
        if (start < thisMonday || weekHasInput(out[i])) continue;
        const prev = i > 0 ? out[i - 1] : null;
        const fresh = generateWeek(out[i].weekNumber, new Date(out[i].startDate), intake, mainGoal, prev, totalWeeks, defaultDays, nextHolidays, volumeRefWeek(out.slice(0, i)), extraLog);
        out[i] = { ...fresh, id: out[i].id };
        changed = true;
      }
      return changed ? out : ws;
    });
  }

  // Extra activiteiten: opslaan, en zware geplande sessies op die dag (of de dag voor een wedstrijd) verzachten.
  function addExtras(entries) {
    const changes = planSoftening(weeks, entries);
    setExtraLog((l) => [...l, ...entries].sort((a, b) => (a.date < b.date ? -1 : 1)));
    if (changes.length) setWeeks((ws) => applySoftening(ws, changes));
    return changes.length;
  }

  function removeExtra(id) {
    setExtraLog((l) => l.filter((e) => e.id !== id));
  }

  function saveHoliday(holiday) {
    const next = [...holidays.filter((h) => h.id !== holiday.id), holiday].sort((a, b) => (a.from < b.from ? -1 : 1));
    setHolidays(next);
    rebuildFutureWeeks(next);
  }

  function removeHoliday(id) {
    const next = holidays.filter((h) => h.id !== id);
    setHolidays(next);
    rebuildFutureWeeks(next);
  }

  function finishOnboarding() {
    const tw = weeksUntil(mainGoal.raceDate);
    setTotalWeeks(tw);
    const week1 = generateWeek(1, startOfWeek(new Date()), intake, mainGoal, null, tw, defaultDays, holidays, null, extraLog);
    setWeeks([week1]);
    setCurrentWeekIndex(0);
    setResultsWeekIndex(0);
    setStage('app');
  }

  function generateNextWeek() {
    const prev = weeks[weeks.length - 1];
    const nextNum = prev.weekNumber + 1;
    const nextStart = addDays(new Date(prev.startDate), 7);
    const nextWeek = generateWeek(nextNum, nextStart, intake, mainGoal, prev, totalWeeks, defaultDays, holidays, volumeRefWeek(weeks), extraLog);
    setWeeks((w) => [...w, nextWeek]);
    setCurrentWeekIndex(weeks.length);
    setResultsWeekIndex(weeks.length);
  }

  function openNewGoal() {
    setNgDraft({ raceType: mainGoal.raceType, raceDate: '', ambition: 'finish', targetTime: '' });
    setNgFinishTime('');
    setNgStep(0);
    setStage('newgoal');
  }

  function confirmNewGoal() {
    const last = weeks[weeks.length - 1];
    const today = startOfWeek(new Date());
    const afterLast = last ? addDays(new Date(last.startDate), 7) : today;
    const nextStart = afterLast > today ? afterLast : today;
    const startWeek = last ? last.weekNumber + 1 : 1;
    const tw = Math.max(Math.floor(calendarDaysUntil(nextStart, ngDraft.raceDate) / 7) + 1, 4);
    const todayKey = dateKey(new Date());

    // Subdoelen die nog lopen (niet behaald, streefdatum niet voorbij) gaan mee; de rest verhuist naar het oude doel.
    const keepSub = (sg) => sg.status !== 'achieved' && (!sg.targetDate || sg.targetDate >= todayKey);
    const carriedSubGoals = subGoals.filter(keepSub);
    const archivedSubGoals = subGoals.filter((sg) => !keepSub(sg));

    const archived = {
      id: uid('pg'),
      raceType: mainGoal.raceType, raceDate: mainGoal.raceDate, ambition: mainGoal.ambition, targetTime: mainGoal.targetTime,
      startWeek: goalStartWeek, endWeek: last ? last.weekNumber : 0,
      finishTime: ngFinishTime.trim() || null,
      subGoals: archivedSubGoals,
      archivedAt: new Date().toISOString(),
    };
    const newGoal = { ...ngDraft, startWeek };
    // Handmatige piekvolumes hoorden bij de vorige wedstrijdafstand; bij een andere afstand beginnen we opnieuw.
    const nextIntake = ngDraft.raceType === mainGoal.raceType ? intake : {
      ...intake,
      swim: { ...intake.swim, targetVolumeKm: null },
      bike: { ...intake.bike, targetVolumeKm: null },
      run: { ...intake.run, targetVolumeKm: null },
    };

    const firstWeek = generateWeek(startWeek, nextStart, nextIntake, newGoal, last || null, tw, defaultDays, holidays, volumeRefWeek(weeks), extraLog);
    setPastGoals((pg) => [...pg, archived]);
    setSubGoals(carriedSubGoals);
    setMainGoal(newGoal);
    setTotalWeeks(tw);
    setIntake(nextIntake);
    setWeeks((w) => [...w, firstWeek]);
    setCurrentWeekIndex(weeks.length);
    setResultsWeekIndex(weeks.length);
    setActiveTab('schedule');
    setStage('app');
  }

  function regenerateWeek(weekIndex) {
    setWeeks((ws) => {
      const week = ws[weekIndex];
      const prevWeek = weekIndex > 0 ? ws[weekIndex - 1] : null;
      const fresh = generateWeek(week.weekNumber, new Date(week.startDate), intake, mainGoal, prevWeek, totalWeeks, defaultDays, holidays, volumeRefWeek(ws.slice(0, weekIndex)), extraLog);
      return ws.map((w, i) => (i === weekIndex ? { ...fresh, id: w.id } : w));
    });
  }

  function addRaceToDay(weekId, sessionId, raceName, raceTypeLabel, target, priority) {
    setWeeks((ws) => ws.map((w) => {
      if (w.id !== weekId) return w;
      const raceSession = w.sessions.find((s) => s.id === sessionId);
      const raceDay = raceSession ? raceSession.day : null;
      const dayBefore = raceDay == null ? null : raceDay - 1;
      const dayAfter = raceDay == null ? null : raceDay + 1;
      // A-wedstrijd: dag ervoor én erna op rust. B-wedstrijd: alleen dag ervoor verzachten. C-wedstrijd: geen automatische aanpassing.
      const restDays = priority === 'A' ? [dayBefore, dayAfter].filter((d) => d != null && d >= 0 && d <= 6) : [];
      const softenDays = priority === 'B' && dayBefore != null && dayBefore >= 0 ? [dayBefore] : [];
      return {
        ...w,
        sessions: w.sessions.map((s) => {
          if (s.id === sessionId) {
            const priorityLabel = { A: 'hoofddoel (A)', B: 'opbouwwedstrijd (B)', C: 'trainingswedstrijd (C)' }[priority] || 'wedstrijd';
            return {
              ...s, discipline: 'wedstrijd', type: raceTypeLabel, raceName: raceName || raceTypeLabel, target, priority: priority || 'C',
              intensity: 'Wedstrijdtempo — geef het onderweg alles, maar blijf binnen je grenzen.',
              coachNote: `Wedstrijd ingepland als ${priorityLabel}: ${raceName || raceTypeLabel}. Dit is geen training maar een meetmoment voor je tempo en pacing.`,
              nutritionTip: NUTRITION_TIPS.wedstrijd, status: 'gepland', result: null,
            };
          }
          if (restDays.includes(s.day) && s.discipline !== 'rust' && s.discipline !== 'wedstrijd' && (HARDNESS[s.type] ?? 0) >= 2) {
            return {
              ...s, discipline: 'rust', type: 'rust', target: null, intensity: INTENSITY.rust, nutritionTip: null,
              coachNote: 'Automatisch op rust gezet, zodat je fris bent rond je wedstrijd.', status: 'gepland', result: null,
            };
          }
          if (softenDays.includes(s.day) && s.discipline !== 'rust' && s.discipline !== 'wedstrijd' && (HARDNESS[s.type] ?? 0) >= 2) {
            const softType = s.discipline === 'zwemmen' ? 'techniek' : s.discipline === 'hardlopen' ? 'herstel' : 'duurloop';
            return {
              ...s, type: softType, intensity: INTENSITY[softType], nutritionTip: NUTRITION_TIPS[softType] || null,
              coachNote: `${TYPE_TEXT[softType]} Verzacht omdat er morgen een wedstrijd op het programma staat.`,
            };
          }
          return s;
        }),
      };
    }));
  }

  function updateSession(weekId, sessionId, updater) {
    setWeeks((ws) => ws.map((w) => {
      if (w.id !== weekId) return w;
      return { ...w, sessions: w.sessions.map((s) => (s.id === sessionId ? updater(s) : s)) };
    }));
  }

  function applyImportedMatches(matches) {
    setWeeks((ws) => ws.map((w) => {
      const relevant = matches.filter((m) => m.weekId === w.id);
      if (!relevant.length) return w;
      return {
        ...w,
        sessions: w.sessions.map((s) => {
          const m = relevant.find((r) => r.session.id === s.id);
          if (!m) return s;
          return { ...s, status: 'voltooid', result: buildResultFromActivity(s, m.activity) };
        }),
      };
    }));
  }

  function removeSession(weekId, sessionId) {
    updateSession(weekId, sessionId, (s) => ({
      ...s, discipline: 'rust', type: 'rust', target: null,
      intensity: INTENSITY.rust, coachNote: TYPE_TEXT.rust, status: 'gepland', result: null,
    }));
  }

  function addSessionToDay(weekId, sessionId, discipline, type, amount, unit) {
    const guide = paceGuidance(discipline, type, intake);
    updateSession(weekId, sessionId, (s) => ({
      ...s, discipline, type,
      target: { amount, unit, label: `${amount} ${unit}` },
      intensity: `${INTENSITY[type] || 'Naar eigen inschatting'}${guide ? ` · Doeltempo ${guide}` : ''}`,
      coachNote: `${TYPE_TEXT[type] || 'Handmatig toegevoegde training.'} Zelf ingepland ter aanvulling op je vaste schema.`,
      nutritionTip: NUTRITION_TIPS[type] || null,
      status: 'gepland', result: null,
    }));
  }

  function swapDays(weekId, sessionIdA, targetDay) {
    setWeeks((ws) => ws.map((w) => {
      if (w.id !== weekId) return w;
      const sessions = [...w.sessions];
      const aIdx = sessions.findIndex((s) => s.id === sessionIdA);
      const bIdx = sessions.findIndex((s) => s.day === targetDay);
      if (aIdx === -1 || bIdx === -1 || aIdx === bIdx) return w;
      const a = { ...sessions[aIdx], day: sessions[bIdx].day };
      const b = { ...sessions[bIdx], day: sessions[aIdx].day };
      sessions[aIdx] = b; sessions[bIdx] = a;
      // keep array ordered by day for rendering convenience
      sessions.sort((x, y) => x.day - y.day);
      return { ...w, sessions };
    }));
    setDayPickerFor(null);
  }

  // Weeknummers lopen door over doelen heen: het eindpunt van het huidige doel ligt dus op startweek + looptijd.
  const goalStartWeek = mainGoal.startWeek || 1;
  const goalEndWeek = goalStartWeek + totalWeeks - 1;

  const prediction = useMemo(
    () => buildPrediction({ weeks, intake, mainGoal, goalEndWeek, extraLog, today: new Date() }),
    [weeks, mainGoal, goalEndWeek, intake, extraLog],
  );

  const recommendation = useMemo(() => {
    if (!prediction) return 'Vul na je trainingen resultaten in — dan geef ik een gerichte inschatting en advies.';
    const lastWeek = weeks[weeks.length - 1];
    const trainSessions = lastWeek ? lastWeek.sessions.filter((s) => s.discipline !== 'rust') : [];
    const skippedCount = trainSessions.filter((s) => s.status === 'overgeslagen').length;
    let msg = '';
    if (prediction.statusLabel === 'op koers') msg = 'Je ligt op koers voor je doeltijd — hou dit ritme vast en blijf consistent trainen.';
    else if (prediction.statusLabel === 'lichte achterstand') msg = 'Je ligt net iets achter op je doeltijd. Focus de komende weken op kwaliteit in je intervaltrainingen.';
    else if (prediction.statusLabel === 'actie nodig') msg = 'Er zit een grotere kloof tussen je verwachte tijd en je doeltijd. Overweeg extra kwaliteitstrainingen of het bijstellen van je doeltijd.';
    else if (!prediction.hasResults) msg = 'Dit is een eerste inschatting op basis van je intake. Vul na je trainingen je tempo in, dan wordt de voorspelling scherper.';
    else msg = 'Mooi bezig — blijf resultaten invullen zodat de voorspelling scherper wordt.';
    if (prediction.confidence.level === 'laag' && prediction.hasResults) {
      const missing = PRED_DISCIPLINES.filter((d) => prediction.disciplines[d].n < 2).map((d) => DISCIPLINE_META[d].label.toLowerCase());
      if (missing.length) msg += ` Vul vooral tempo’s in voor ${missing.join(' en ')}: daar mist nog data.`;
    }
    if (prediction.raceBased) msg += ` Deze inschatting houdt rekening met je wedstrijdresultaat van ${prediction.raceBased.sourceName} (${fmtDate(prediction.raceBased.sourceDate)}).`;
    const boosted = PRED_DISCIPLINES.filter((d) => prediction.disciplines[d].bonus > 0.0005).map((d) => DISCIPLINE_META[d].label.toLowerCase());
    if (boosted.length) msg += ` Je extra activiteiten geven een kleine conditiebonus voor ${boosted.join(', ')}.`;
    if (skippedCount >= 2) msg += ` Je hebt afgelopen week ${skippedCount} trainingen overgeslagen — geef volgende week de kernsessies (interval en lange training) voorrang.`;
    return msg;
  }, [prediction, weeks]);

  const daysToRace = mainGoal.raceDate ? daysBetween(mainGoal.raceDate, new Date()) : null;
  const goalPassed = Boolean(mainGoal.raceDate) && mainGoal.raceDate < dateKey(new Date());

  // Wat betekenen de ingeplande vakanties voor de weg naar je wedstrijd?
  const holidayOutlook = useMemo(() => {
    const todayKey = dateKey(new Date());
    const upcoming = holidays.filter((h) => h.to >= todayKey).sort((a, b) => (a.from < b.from ? -1 : 1));
    if (!mainGoal.raceDate || goalPassed) return { upcoming, weeksToRace: 0, restWeeks: 0, lightWeeks: 0, effectiveWeeks: 0, taperOverlap: [] };
    const race = new Date(`${mainGoal.raceDate}T00:00:00`);
    let cursor = startOfWeek(new Date()); cursor.setHours(0, 0, 0, 0);
    let weeksToRace = 0, restWeeks = 0, lightWeeks = 0;
    while (cursor <= race && weeksToRace < 120) {
      const info = weekHolidayInfo(cursor, holidays);
      weeksToRace++;
      if (info.restDays >= 4) restWeeks++;
      else if (info.restDays + info.lightDays >= 3) lightWeeks++;
      cursor = addDays(cursor, 7);
    }
    // Een vakantie in de laatste weken voor de wedstrijd raakt je piek- en taperfase.
    const taperWeeks = TAPER_WEEKS[mainGoal.raceType] ?? 2;
    const sharpStart = dateKey(addDays(race, -7 * (taperWeeks + 2)));
    const taperOverlap = upcoming.filter((h) => h.mode === 'rust' && h.to >= sharpStart && h.from <= mainGoal.raceDate);
    return { upcoming, weeksToRace, restWeeks, lightWeeks, effectiveWeeks: weeksToRace - restWeeks, taperOverlap };
  }, [holidays, mainGoal.raceDate, mainGoal.raceType, goalPassed]);

  const weeksElapsed = Math.max(weeks.length - (goalStartWeek - 1), 0);
  const dialPct = goalPassed ? 1 : totalWeeks ? Math.min(weeksElapsed / totalWeeks, 1) : 0;

  /* --------------------------- shared styles --------------------------- */
  const styleBlock = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      .tri-root {
        --bg: #FBF3E7; --surface: #FFFCF6; --card: #FFFFFF;
        --terracotta: #C1552C; --coral: #E8795A; --sand: #E9D7B8;
        --accent: #F0A356; --text: #3A2A20; --muted: #8A7460;
        --success: #5C6B3E; --success-bg:#E4EACB; --warning: #B3792A; --danger: #B84A3E;
        --radius: 18px;
        font-family: 'Inter', sans-serif; color: var(--text); background: var(--bg);
        min-height: 100vh; max-width: 480px; margin: 0 auto; position: relative;
        padding-bottom: 84px;
      }
      .tri-root h1,.tri-root h2,.tri-root h3 { font-family: 'Fraunces', serif; margin: 0; }
      .tri-scroll { padding: 20px 16px 12px; }
      .tri-card { background: var(--card); border-radius: var(--radius); padding: 18px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(58,42,32,0.06); border: 1px solid rgba(58,42,32,0.06); }
      .tri-btn { border: none; border-radius: 999px; padding: 14px 20px; font-weight: 600; font-size: 15px; cursor: pointer; min-height: 48px; font-family: 'Inter', sans-serif; }
      .tri-btn-primary { background: var(--terracotta); color: #fff; }
      .tri-btn-primary:active { background: #a8451f; }
      .tri-btn-secondary { background: var(--sand); color: var(--text); }
      .tri-btn-ghost { background: transparent; color: var(--terracotta); border: 1.5px solid var(--terracotta); }
      .tri-btn-block { width: 100%; }
      .tri-input, .tri-select, .tri-textarea { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--sand); background: var(--surface); font-size: 15px; font-family: 'Inter', sans-serif; color: var(--text); min-height: 46px; }
      .tri-input:focus, .tri-select:focus, .tri-textarea:focus { outline: 2px solid var(--accent); border-color: var(--accent); }
      .tri-label { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; display:block; }
      .tri-field { margin-bottom: 14px; }
      .tri-row { display: flex; gap: 10px; }
      .tri-row > * { flex: 1; }
      .tri-pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 600; }
      .tri-badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .tri-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: var(--card); border-top: 1px solid rgba(58,42,32,0.08); display: flex; padding: 8px 6px calc(env(safe-area-inset-bottom,0px) + 8px); box-shadow: 0 -2px 12px rgba(58,42,32,0.08); z-index: 20; }
      .tri-nav-btn { flex: 1; background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px; color: var(--muted); font-size: 11px; font-weight: 600; border-radius: 12px; min-height: 52px; }
      .tri-nav-btn.active { color: var(--terracotta); background: #FDEEE4; }
      .tri-header { padding: 18px 16px 8px; }
      .tri-eyebrow { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 700; margin-bottom: 4px; }
      .tri-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .tri-choice { border: 1.5px solid var(--sand); background: var(--surface); border-radius: 14px; padding: 14px 10px; text-align: center; font-weight: 600; font-size: 14px; min-height: 56px; }
      .tri-choice.selected { border-color: var(--terracotta); background: #FDEEE4; color: var(--terracotta); }
      .tri-progress-track { height: 8px; background: var(--sand); border-radius: 999px; overflow: hidden; }
      .tri-progress-fill { height: 100%; background: linear-gradient(90deg, var(--coral), var(--terracotta)); border-radius: 999px; }
      .tri-daytab { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
      .tri-daytab button { flex-shrink: 0; }
      .tri-icon-circle { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .tri-subgoal-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .tri-onboard-progress { display: flex; gap: 6px; padding: 0 16px 10px; }
      .tri-onboard-progress > div { flex: 1; height: 4px; border-radius: 2px; background: var(--sand); }
      .tri-onboard-progress > div.done { background: var(--terracotta); }
      .tri-modal-backdrop { position: fixed; inset: 0; background: rgba(58,42,32,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
      .tri-modal { background: var(--card); width: 100%; max-width: 480px; max-height: 82vh; overflow-y: auto; border-radius: 22px 22px 0 0; padding: 20px 18px calc(env(safe-area-inset-bottom,0px) + 20px); }
    `}</style>
  );

  if (!loaded) {
    return (
      <div className="tri-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', paddingBottom: 0 }}>
        {styleBlock}
        <div style={{ textAlign: 'center' }}>
          <Sparkles size={26} color="var(--terracotta)" />
          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>Je trainingsplan wordt geladen…</div>
        </div>
      </div>
    );
  }

  /* --------------------------- nieuw doel UI --------------------------- */
  if (stage === 'newgoal') {
    const ngSteps = ['Terugblik', 'Nieuw doel', 'Overzicht'];
    const tomorrowKey = dateKey(addDays(new Date(), 1));
    const dateOk = Boolean(ngDraft.raceDate) && ngDraft.raceDate >= tomorrowKey;
    const todayKey = dateKey(new Date());
    const carriedCount = subGoals.filter((sg) => sg.status !== 'achieved' && (!sg.targetDate || sg.targetDate >= todayKey)).length;
    const achievedCount = subGoals.filter((sg) => sg.status === 'achieved').length;
    const resetsVolumes = ngDraft.raceType !== mainGoal.raceType
      && ['swim', 'bike', 'run'].some((k) => intake[k].targetVolumeKm);
    return (
      <div className="tri-root">
        {styleBlock}
        <div className="tri-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="tri-eyebrow">Stap {ngStep + 1} van {ngSteps.length}</div>
            <h1 style={{ fontSize: 26 }}>{ngSteps[ngStep]}</h1>
          </div>
          <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px', marginTop: 4 }} onClick={() => setStage('app')}>
            <X size={18} />
          </button>
        </div>
        <div className="tri-onboard-progress">
          {ngSteps.map((_, i) => <div key={i} className={i <= ngStep ? 'done' : ''} />)}
        </div>
        <div className="tri-scroll">
          {ngStep === 0 && (
            <div className="tri-card">
              <p style={{ fontSize: 14, marginTop: 0 }}>
                Je {RACE_TYPES[mainGoal.raceType].label.toLowerCase()} van {fmtDate(mainGoal.raceDate)} is voorbij.
                {achievedCount > 0 ? ` Onderweg behaalde je ${achievedCount} subdoel${achievedCount === 1 ? '' : 'en'}.` : ''}
              </p>
              <div className="tri-field">
                <label className="tri-label">Eindtijd (optioneel, u:mm:ss)</label>
                <input className="tri-input" placeholder="bv. 5:24:10" value={ngFinishTime}
                  onChange={(e) => setNgFinishTime(e.target.value)} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 0 }}>
                Dit doel komt onder “Eerdere doelen” te staan. Al je weken en resultaten blijven bewaard.
              </p>
            </div>
          )}

          {ngStep === 1 && (
            <div className="tri-card">
              <div className="tri-field">
                <label className="tri-label">Type wedstrijd</label>
                <div className="tri-choice-grid">
                  {Object.entries(RACE_TYPES).map(([key, val]) => (
                    <button key={key} className={`tri-choice ${ngDraft.raceType === key ? 'selected' : ''}`}
                      onClick={() => setNgDraft((g) => ({ ...g, raceType: key }))}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tri-field">
                <label className="tri-label">Wedstrijddatum</label>
                <input type="date" className="tri-input" min={tomorrowKey} value={ngDraft.raceDate}
                  onChange={(e) => setNgDraft((g) => ({ ...g, raceDate: e.target.value }))} />
                {ngDraft.raceDate && !dateOk && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', margin: '6px 0 0' }}>Kies een datum in de toekomst.</p>
                )}
              </div>
              <div className="tri-field">
                <label className="tri-label">Ambitie</label>
                <div className="tri-row">
                  <button className={`tri-choice ${ngDraft.ambition === 'finish' ? 'selected' : ''}`}
                    onClick={() => setNgDraft((g) => ({ ...g, ambition: 'finish' }))}>Uitfinishen</button>
                  <button className={`tri-choice ${ngDraft.ambition === 'target' ? 'selected' : ''}`}
                    onClick={() => setNgDraft((g) => ({ ...g, ambition: 'target' }))}>Doeltijd</button>
                </div>
              </div>
              {ngDraft.ambition === 'target' && (
                <div className="tri-field">
                  <label className="tri-label">Gewenste eindtijd (u:mm of u:mm:ss)</label>
                  <input className="tri-input" placeholder="bv. 5:30:00" value={ngDraft.targetTime}
                    onChange={(e) => setNgDraft((g) => ({ ...g, targetTime: e.target.value }))} />
                </div>
              )}
            </div>
          )}

          {ngStep === 2 && (
            <div className="tri-card">
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Klaar om te starten</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Nieuw hoofddoel: <b style={{ color: 'var(--text)' }}>{RACE_TYPES[ngDraft.raceType].label}</b> op {fmtDate(ngDraft.raceDate)}.
                {ngDraft.ambition === 'target' && ngDraft.targetTime ? ` Doeltijd: ${ngDraft.targetTime}.` : ' Doel: uitfinishen.'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {carriedCount > 0
                  ? (carriedCount === 1 ? '1 lopend subdoel gaat mee naar je nieuwe doel.' : `${carriedCount} lopende subdoelen gaan mee naar je nieuwe doel.`)
                  : 'Er gaan geen lopende subdoelen mee. Je kunt er straks nieuwe toevoegen.'}
              </p>
              {resetsVolumes && (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Je handmatig ingestelde piekvolumes hoorden bij de vorige afstand en worden gewist. Je kunt ze in Instellingen opnieuw invullen.
                </p>
              )}
              <p style={{ fontSize: 14 }}>
                Ik bouw het nieuwe schema op vanaf je laatste weken. Is je niveau veranderd? Pas het wekelijkse volume aan in Instellingen.
              </p>
            </div>
          )}
        </div>
        <div style={{ padding: '4px 16px 24px', display: 'flex', gap: 10 }}>
          {ngStep > 0 && <button className="tri-btn tri-btn-secondary" onClick={() => setNgStep((n) => n - 1)}><ChevronLeft size={18} style={{ verticalAlign: 'middle' }} /></button>}
          {ngStep < ngSteps.length - 1 && (
            <button className="tri-btn tri-btn-primary tri-btn-block" disabled={ngStep === 1 && !dateOk}
              onClick={() => setNgStep((n) => n + 1)}>Volgende</button>
          )}
          {ngStep === ngSteps.length - 1 && (
            <button className="tri-btn tri-btn-primary tri-btn-block" onClick={confirmNewGoal}>
              Start mijn nieuwe doel <Sparkles size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* --------------------------- onboarding UI --------------------------- */
  if (stage === 'onboarding') {
    const steps = ['Hoofddoel', 'Subdoelen', 'Intake', 'Overzicht'];
    return (
      <div className="tri-root">
        {styleBlock}
        <div className="tri-header">
          <div className="tri-eyebrow">Stap {obStep + 1} van {steps.length}</div>
          <h1 style={{ fontSize: 26 }}>{steps[obStep]}</h1>
        </div>
        <div className="tri-onboard-progress">
          {steps.map((_, i) => <div key={i} className={i <= obStep ? 'done' : ''} />)}
        </div>
        <div className="tri-scroll">
          {obStep === 0 && (
            <div className="tri-card">
              <div className="tri-field">
                <label className="tri-label">Type wedstrijd</label>
                <div className="tri-choice-grid">
                  {Object.entries(RACE_TYPES).map(([key, val]) => (
                    <button key={key} className={`tri-choice ${mainGoal.raceType === key ? 'selected' : ''}`}
                      onClick={() => setMainGoal((g) => ({ ...g, raceType: key }))}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tri-field">
                <label className="tri-label">Wedstrijddatum</label>
                <input type="date" className="tri-input" value={mainGoal.raceDate}
                  onChange={(e) => setMainGoal((g) => ({ ...g, raceDate: e.target.value }))} />
              </div>
              <div className="tri-field">
                <label className="tri-label">Ambitie</label>
                <div className="tri-row">
                  <button className={`tri-choice ${mainGoal.ambition === 'finish' ? 'selected' : ''}`}
                    onClick={() => setMainGoal((g) => ({ ...g, ambition: 'finish' }))}>Uitfinishen</button>
                  <button className={`tri-choice ${mainGoal.ambition === 'target' ? 'selected' : ''}`}
                    onClick={() => setMainGoal((g) => ({ ...g, ambition: 'target' }))}>Doeltijd</button>
                </div>
              </div>
              {mainGoal.ambition === 'target' && (
                <div className="tri-field">
                  <label className="tri-label">Gewenste eindtijd (u:mm of u:mm:ss)</label>
                  <input className="tri-input" placeholder="bv. 5:30:00" value={mainGoal.targetTime}
                    onChange={(e) => setMainGoal((g) => ({ ...g, targetTime: e.target.value }))} />
                </div>
              )}
            </div>
          )}

          {obStep === 1 && (
            <div className="tri-card">
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>Optioneel: voeg tussentijdse doelen toe die je onderweg wilt behalen.</p>
              {subGoals.map((sg) => (
                <div key={sg.id} className="tri-subgoal-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--sand)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{sg.text}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Streefdatum: {fmtDate(sg.targetDate) || '-'}</div>
                  </div>
                  <button className="tri-btn tri-btn-secondary" style={{ padding: '8px 12px', minHeight: 36 }}
                    onClick={() => setSubGoals((sgs) => sgs.filter((x) => x.id !== sg.id))}><X size={16} /></button>
                </div>
              ))}
              <div className="tri-field" style={{ marginTop: 12 }}>
                <label className="tri-label">Subdoel</label>
                <input className="tri-input" placeholder="bv. 5 km zwemmen zonder pauze" value={newSubGoal.text}
                  onChange={(e) => setNewSubGoal((s) => ({ ...s, text: e.target.value }))} />
              </div>
              <div className="tri-field">
                <label className="tri-label">Streefdatum</label>
                <input type="date" className="tri-input" value={newSubGoal.targetDate}
                  onChange={(e) => setNewSubGoal((s) => ({ ...s, targetDate: e.target.value }))} />
              </div>
              <button className="tri-btn tri-btn-secondary tri-btn-block" disabled={!newSubGoal.text}
                onClick={() => { setSubGoals((sgs) => [...sgs, { id: uid('sg'), ...newSubGoal, status: 'not_started' }]); setNewSubGoal({ text: '', targetDate: '' }); }}>
                <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Subdoel toevoegen
              </button>
            </div>
          )}

          {obStep === 2 && (
            <>
              <div className="tri-card">
                <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Waves size={18} color="#2E7D8F" /> Zwemmen</h3>
                <div className="tri-row">
                  <div className="tri-field"><label className="tri-label">Volume / week (km)</label>
                    <input type="number" step="0.1" className="tri-input" value={intake.swim.volumeKm}
                      onChange={(e) => setIntake((i) => ({ ...i, swim: { ...i.swim, volumeKm: +e.target.value } }))} /></div>
                  <div className="tri-field"><label className="tri-label">Tempo (min/100m)</label>
                    <input className="tri-input" value={intake.swim.pace}
                      onChange={(e) => setIntake((i) => ({ ...i, swim: { ...i.swim, pace: e.target.value } }))} /></div>
                </div>
                <div className="tri-field"><label className="tri-label">Ervaring</label>
                  <select className="tri-select" value={intake.swim.experience}
                    onChange={(e) => setIntake((i) => ({ ...i, swim: { ...i.swim, experience: e.target.value } }))}>
                    <option value="beginner">Beginner</option><option value="gevorderd">Gevorderd</option><option value="ervaren">Ervaren</option>
                  </select></div>
              </div>
              <div className="tri-card">
                <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Bike size={18} color="#C1552C" /> Fietsen</h3>
                <div className="tri-row">
                  <div className="tri-field"><label className="tri-label">Volume / week (km)</label>
                    <input type="number" className="tri-input" value={intake.bike.volumeKm}
                      onChange={(e) => setIntake((i) => ({ ...i, bike: { ...i.bike, volumeKm: +e.target.value } }))} /></div>
                  <div className="tri-field"><label className="tri-label">Gem. snelheid (km/u)</label>
                    <input type="number" className="tri-input" value={intake.bike.speedKmh}
                      onChange={(e) => setIntake((i) => ({ ...i, bike: { ...i.bike, speedKmh: +e.target.value } }))} /></div>
                </div>
                <div className="tri-field"><label className="tri-label">Ervaring</label>
                  <select className="tri-select" value={intake.bike.experience}
                    onChange={(e) => setIntake((i) => ({ ...i, bike: { ...i.bike, experience: e.target.value } }))}>
                    <option value="beginner">Beginner</option><option value="gevorderd">Gevorderd</option><option value="ervaren">Ervaren</option>
                  </select></div>
              </div>
              <div className="tri-card">
                <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Footprints size={18} color="#D9A441" /> Hardlopen</h3>
                <div className="tri-row">
                  <div className="tri-field"><label className="tri-label">Volume / week (km)</label>
                    <input type="number" className="tri-input" value={intake.run.volumeKm}
                      onChange={(e) => setIntake((i) => ({ ...i, run: { ...i.run, volumeKm: +e.target.value } }))} /></div>
                  <div className="tri-field"><label className="tri-label">Tempo (min/km)</label>
                    <input className="tri-input" value={intake.run.paceMinKm}
                      onChange={(e) => setIntake((i) => ({ ...i, run: { ...i.run, paceMinKm: e.target.value } }))} /></div>
                </div>
                <div className="tri-field"><label className="tri-label">Ervaring</label>
                  <select className="tri-select" value={intake.run.experience}
                    onChange={(e) => setIntake((i) => ({ ...i, run: { ...i.run, experience: e.target.value } }))}>
                    <option value="beginner">Beginner</option><option value="gevorderd">Gevorderd</option><option value="ervaren">Ervaren</option>
                  </select></div>
              </div>
              <div className="tri-card">
                <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Dumbbell size={18} color="#8A5A44" /> Kracht & planning</h3>
                <div className="tri-field"><label className="tri-label">Krachtsessies / week (wens)</label>
                  <input type="number" min="0" max="3" className="tri-input" value={intake.strength.sessionsPerWeek}
                    onChange={(e) => setIntake((i) => ({ ...i, strength: { ...i.strength, sessionsPerWeek: +e.target.value } }))} /></div>
                <div className="tri-field"><label className="tri-label">Beschikbare traindagen / week (3-6)</label>
                  <input type="number" min="3" max="6" className="tri-input" value={intake.daysPerWeek}
                    onChange={(e) => setIntake((i) => ({ ...i, daysPerWeek: Math.min(Math.max(+e.target.value, 3), 6) }))} /></div>
                <div className="tri-field"><label className="tri-label">Blessures / beperkingen (optioneel)</label>
                  <textarea className="tri-textarea" rows={3} value={intake.injuries}
                    onChange={(e) => setIntake((i) => ({ ...i, injuries: e.target.value }))} placeholder="bv. gevoelige knie, vermijd hoge impact" /></div>
              </div>
            </>
          )}

          {obStep === 3 && (
            <div className="tri-card">
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Klaar om te starten</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Hoofddoel: <b style={{ color: 'var(--text)' }}>{RACE_TYPES[mainGoal.raceType].label}</b> op {fmtDate(mainGoal.raceDate) || 'nog geen datum'}.
                {mainGoal.ambition === 'target' && mainGoal.targetTime ? ` Doeltijd: ${mainGoal.targetTime}.` : ' Doel: uitfinishen.'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>{subGoals.length} subdoel(en) toegevoegd. {intake.daysPerWeek} traindagen per week.</p>
              <p style={{ fontSize: 14 }}>Ik stel op basis hiervan je eerste weekschema samen — dit past zich elke week aan op basis van je resultaten.</p>
            </div>
          )}
        </div>
        <div style={{ padding: '4px 16px 24px', display: 'flex', gap: 10 }}>
          {obStep > 0 && <button className="tri-btn tri-btn-secondary" onClick={() => setObStep((s) => s - 1)}><ChevronLeft size={18} style={{ verticalAlign: 'middle' }} /></button>}
          {obStep < steps.length - 1 && (
            <button className="tri-btn tri-btn-primary tri-btn-block" disabled={obStep === 0 && !mainGoal.raceDate}
              onClick={() => setObStep((s) => s + 1)}>Volgende</button>
          )}
          {obStep === steps.length - 1 && (
            <button className="tri-btn tri-btn-primary tri-btn-block" onClick={finishOnboarding}>Genereer mijn eerste week <Sparkles size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} /></button>
          )}
        </div>
      </div>
    );
  }

  /* --------------------------- shared: session card --------------------------- */
  function SessionCard({ session, week, compact, dragId, dragOverDay, onDragHandleDown }) {
    const meta = DISCIPLINE_META[session.discipline];
    const Icon = meta.icon;
    const st = STATUS_META[session.status];
    const isTraining = session.discipline !== 'rust';
    const isRace = session.discipline === 'wedstrijd';
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addDiscipline, setAddDiscipline] = useState('zwemmen');
    const [addType, setAddType] = useState(TYPE_OPTIONS.zwemmen[0]);
    const [addCustomType, setAddCustomType] = useState('');
    const [addAmount, setAddAmount] = useState('');
    const [addingRace, setAddingRace] = useState(false);
    const [raceName, setRaceName] = useState('');
    const [raceTypeKey, setRaceTypeKey] = useState('sprint');
    const [raceManualAmount, setRaceManualAmount] = useState('');
    const [racePriority, setRacePriority] = useState('A');

    function chooseAddDiscipline(d) {
      setAddDiscipline(d);
      setAddType(TYPE_OPTIONS[d][0]);
      setAddCustomType('');
    }
    function saveAdd() {
      const amt = parseFloat(addAmount);
      if (!amt || amt <= 0) return;
      const finalType = addType === 'anders' ? (addCustomType.trim() || 'eigen training') : addType;
      addSessionToDay(week.id, session.id, addDiscipline, finalType, amt, DEFAULT_UNIT[addDiscipline]);
      setAdding(false); setAddAmount(''); setAddCustomType('');
    }
    function saveRace() {
      const rt = RACE_ADD_TYPES.find((t) => t.key === raceTypeKey);
      let target;
      if (rt.manual) {
        const amt = parseFloat(raceManualAmount);
        if (!amt || amt <= 0) return;
        target = { amount: amt, unit: rt.unit, label: `${amt} ${rt.unit}` };
      } else {
        target = { amount: rt.totalKm, unit: 'km', label: `${rt.label} (${rt.totalKm} km totaal)` };
      }
      addRaceToDay(week.id, session.id, raceName.trim(), rt.label, target, racePriority);
      setAddingRace(false); setRaceName(''); setRaceManualAmount('');
    }

    return (
      <div data-day={session.day} className="tri-card" style={{
        marginBottom: 10,
        ...(isRace ? { border: `1.5px solid ${meta.color}`, background: `${meta.color}0D` } : {}),
        ...(dragId === session.id ? { opacity: 0.4 } : {}),
        ...(dragOverDay === session.day && dragId != null && dragId !== session.id ? { border: '2px dashed var(--terracotta)' } : {}),
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="tri-icon-circle" style={{ background: meta.color + '20' }}>
            <Icon size={20} color={meta.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{DAYS_FULL[session.day]}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {isRace ? (session.raceName || meta.label) : meta.label}{isTraining ? ` · ${session.type}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="tri-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {isTraining && onDragHandleDown && (
                  <button aria-label="Versleep naar andere dag" style={{ background: 'none', border: 'none', padding: 6, cursor: 'grab', touchAction: 'none', color: 'var(--muted)' }}
                    onPointerDown={() => onDragHandleDown(session.id)}>
                    <GripVertical size={18} />
                  </button>
                )}
              </div>
            </div>
            {isTraining && session.target && (
              <div style={{ fontSize: 14, marginTop: 4 }}><b>{session.target.label}</b> · {session.intensity}</div>
            )}
            {session.holidayName && (
              <span className="tri-badge" style={{ marginTop: 6, marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E4EACB', color: 'var(--success)' }}>
                <Sun size={12} />{session.holidayName}
              </span>
            )}
            {isRace && session.priority && (
              <span className="tri-badge" style={{ marginTop: 6, display: 'inline-block', background: `${meta.color}1F`, color: meta.color }}>
                {{ A: 'Hoofddoel (A)', B: 'Opbouwwedstrijd (B)', C: 'Trainingswedstrijd (C)' }[session.priority]}
              </span>
            )}
            {!compact && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>{session.coachNote}</p>}
            {!compact && session.nutritionTip && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, marginBottom: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Utensils size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>{session.nutritionTip}</span>
              </p>
            )}

            {isTraining && !compact && !confirmDelete && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="tri-btn tri-btn-primary" style={{ padding: '10px 14px', fontSize: 13, minHeight: 40 }}
                  onClick={() => { setActiveTab('results'); setResultsWeekIndex(weeks.findIndex((w) => w.id === week.id)); setOpenResultFor(session.id); }}>
                  Resultaat invullen
                </button>
                <button className="tri-btn tri-btn-secondary" style={{ padding: '10px 14px', fontSize: 13, minHeight: 40 }}
                  onClick={() => setDayPickerFor(dayPickerFor === session.id ? null : session.id)}>
                  <ArrowLeftRight size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Verplaats
                </button>
                <button className="tri-btn" style={{ padding: '10px 14px', fontSize: 13, minHeight: 40, background: '#F7DAD3', color: 'var(--danger)' }}
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Verwijderen
                </button>
              </div>
            )}

            {confirmDelete && (
              <div style={{ marginTop: 12, background: '#F7DAD3', borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 13, margin: '0 0 10px' }}>Deze training verwijderen? De dag wordt een rustdag.</p>
                <div className="tri-row">
                  <button className="tri-btn tri-btn-secondary" style={{ minHeight: 38, fontSize: 13 }} onClick={() => setConfirmDelete(false)}>Annuleren</button>
                  <button className="tri-btn" style={{ minHeight: 38, fontSize: 13, background: 'var(--danger)', color: '#fff' }}
                    onClick={() => { removeSession(week.id, session.id); setConfirmDelete(false); }}>Ja, verwijderen</button>
                </div>
              </div>
            )}

            {!isTraining && !compact && !adding && !addingRace && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="tri-btn tri-btn-secondary" style={{ padding: '10px 14px', fontSize: 13, minHeight: 40 }}
                  onClick={() => setAdding(true)}>
                  <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Training toevoegen
                </button>
                <button className="tri-btn" style={{ padding: '10px 14px', fontSize: 13, minHeight: 40, background: `${DISCIPLINE_META.wedstrijd.color}1F`, color: DISCIPLINE_META.wedstrijd.color }}
                  onClick={() => setAddingRace(true)}>
                  <Flag size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Wedstrijd toevoegen
                </button>
              </div>
            )}

            {!isTraining && addingRace && (
              <div style={{ marginTop: 12 }}>
                <div className="tri-field">
                  <label className="tri-label">Naam wedstrijd (optioneel)</label>
                  <input className="tri-input" placeholder="bv. Regio Triatlon Almere" value={raceName} onChange={(e) => setRaceName(e.target.value)} />
                </div>
                <div className="tri-field">
                  <label className="tri-label">Type wedstrijd</label>
                  <select className="tri-select" value={raceTypeKey} onChange={(e) => setRaceTypeKey(e.target.value)}>
                    {RACE_ADD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className="tri-field">
                  <label className="tri-label">Prioriteit</label>
                  <div className="tri-row">
                    {[{ v: 'A', l: 'A · hoofddoel' }, { v: 'B', l: 'B · opbouw' }, { v: 'C', l: 'C · training' }].map((p) => (
                      <button key={p.v} className={`tri-choice ${racePriority === p.v ? 'selected' : ''}`} style={{ fontSize: 12, padding: '10px 6px' }}
                        onClick={() => setRacePriority(p.v)}>{p.l}</button>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>
                    {racePriority === 'A' && 'Volledige taper: de dag ervoor én erna worden automatisch rustdagen.'}
                    {racePriority === 'B' && 'Lichte taper: alleen de dag ervoor wordt verzacht.'}
                    {racePriority === 'C' && 'Geen automatische aanpassing — puur een trainingswedstrijd.'}
                  </p>
                </div>
                {RACE_ADD_TYPES.find((t) => t.key === raceTypeKey).manual ? (
                  <div className="tri-field">
                    <label className="tri-label">Afstand ({RACE_ADD_TYPES.find((t) => t.key === raceTypeKey).unit})</label>
                    <input type="number" className="tri-input" value={raceManualAmount} onChange={(e) => setRaceManualAmount(e.target.value)}
                      placeholder={RACE_ADD_TYPES.find((t) => t.key === raceTypeKey).unit === 'm' ? 'bv. 1500' : 'bv. 10'} />
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
                    Totaalafstand: {RACE_ADD_TYPES.find((t) => t.key === raceTypeKey).totalKm} km (zwem + fiets + hardlopen)
                  </p>
                )}
                <div className="tri-row">
                  <button className="tri-btn tri-btn-secondary" onClick={() => { setAddingRace(false); setRaceName(''); setRaceManualAmount(''); }}>Annuleren</button>
                  <button className="tri-btn tri-btn-primary" disabled={RACE_ADD_TYPES.find((t) => t.key === raceTypeKey).manual && !raceManualAmount} onClick={saveRace}>Toevoegen</button>
                </div>
              </div>
            )}

            {!isTraining && adding && (
              <div style={{ marginTop: 12 }}>
                <div className="tri-label" style={{ marginBottom: 6 }}>Sport</div>
                <div className="tri-daytab" style={{ marginBottom: 10 }}>
                  {['zwemmen', 'fietsen', 'hardlopen', 'kracht'].map((d) => (
                    <button key={d} className={`tri-choice ${addDiscipline === d ? 'selected' : ''}`} style={{ padding: '8px 12px', fontSize: 13 }}
                      onClick={() => chooseAddDiscipline(d)}>{DISCIPLINE_META[d].label}</button>
                  ))}
                </div>
                <div className="tri-field">
                  <label className="tri-label">Type</label>
                  <select className="tri-select" value={addType} onChange={(e) => setAddType(e.target.value)}>
                    {TYPE_OPTIONS[addDiscipline].map((t) => <option key={t} value={t}>{t === 'anders' ? 'Eigen type…' : t}</option>)}
                  </select>
                </div>
                {addType === 'anders' && (
                  <div className="tri-field">
                    <label className="tri-label">Eigen type</label>
                    <input className="tri-input" placeholder="bv. wedstrijdsimulatie" value={addCustomType} onChange={(e) => setAddCustomType(e.target.value)} />
                  </div>
                )}
                <div className="tri-field">
                  <label className="tri-label">Doel ({DEFAULT_UNIT[addDiscipline]})</label>
                  <input type="number" className="tri-input" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
                    placeholder={DEFAULT_UNIT[addDiscipline] === 'm' ? 'bv. 1500' : DEFAULT_UNIT[addDiscipline] === 'min' ? 'bv. 45' : 'bv. 10'} />
                </div>
                <div className="tri-row">
                  <button className="tri-btn tri-btn-secondary" onClick={() => { setAdding(false); setAddAmount(''); setAddCustomType(''); }}>Annuleren</button>
                  <button className="tri-btn tri-btn-primary" disabled={!addAmount || (addType === 'anders' && !addCustomType.trim())} onClick={saveAdd}>Toevoegen</button>
                </div>
              </div>
            )}

            {dayPickerFor === session.id && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Wissel met dag:</div>
                <div className="tri-daytab">
                  {DAYS.map((d, idx) => (
                    <button key={idx} disabled={idx === session.day} className="tri-choice" style={{ padding: '8px 12px', opacity: idx === session.day ? 0.35 : 1 }}
                      onClick={() => swapDays(week.id, session.id, idx)}>{d}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------- Dashboard tab --------------------------- */
  function DashboardTab() {
    const r = 46, circ = 2 * Math.PI * r;
    return (
      <div className="tri-scroll">
        {goalPassed && (
          <div className="tri-card" style={{ background: 'var(--success-bg)', border: '1.5px solid var(--success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Flag size={18} color="var(--success)" />
              <h3 style={{ fontSize: 16 }}>Je doel is voorbij</h3>
            </div>
            <p style={{ fontSize: 14, margin: '0 0 12px' }}>
              Je {RACE_TYPES[mainGoal.raceType].label.toLowerCase()} van {fmtDate(mainGoal.raceDate)} ligt achter je. Kies een nieuw doel om verder te trainen. Je schema’s en resultaten blijven bewaard.
            </p>
            <button className="tri-btn tri-btn-primary tri-btn-block" onClick={openNewGoal}>Nieuw doel kiezen</button>
          </div>
        )}
        <div className="tri-card" style={{ background: 'linear-gradient(135deg, #C1552C, #E8795A)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
              <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - dialPct)} transform="rotate(-90 50 50)" />
              <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" fontFamily="Fraunces, serif">{goalPassed ? 'Klaar' : daysToRace ?? '-'}</text>
              <text x="50" y="63" textAnchor="middle" fontSize="10" fill="#fff" opacity="0.9">{goalPassed ? 'doel voorbij' : 'dagen te gaan'}</text>
            </svg>
            <div>
              <div className="tri-eyebrow" style={{ color: 'rgba(255,255,255,0.85)' }}>Hoofddoel</div>
              <h2 style={{ fontSize: 20, color: '#fff' }}>{RACE_TYPES[mainGoal.raceType].label}</h2>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{fmtDate(mainGoal.raceDate)}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{mainGoal.ambition === 'target' ? `Doeltijd: ${mainGoal.targetTime || '-'}` : 'Doel: uitfinishen'}</div>
            </div>
          </div>
          <button className="tri-btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', marginTop: 14, padding: '9px 14px', fontSize: 13, minHeight: 38 }}
            onClick={() => setEditingGoal((e) => !e)}><Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Doel bewerken</button>
        </div>

        {editingGoal && (
          <div className="tri-card">
            <div className="tri-field"><label className="tri-label">Ambitie</label>
              <div className="tri-row">
                <button className={`tri-choice ${mainGoal.ambition === 'finish' ? 'selected' : ''}`} onClick={() => setMainGoal((g) => ({ ...g, ambition: 'finish' }))}>Uitfinishen</button>
                <button className={`tri-choice ${mainGoal.ambition === 'target' ? 'selected' : ''}`} onClick={() => setMainGoal((g) => ({ ...g, ambition: 'target' }))}>Doeltijd</button>
              </div>
            </div>
            {mainGoal.ambition === 'target' && (
              <div className="tri-field"><label className="tri-label">Doeltijd</label>
                <input className="tri-input" value={mainGoal.targetTime} onChange={(e) => setMainGoal((g) => ({ ...g, targetTime: e.target.value }))} /></div>
            )}
            <button className="tri-btn tri-btn-primary tri-btn-block" onClick={() => setEditingGoal(false)}>Opslaan</button>
          </div>
        )}

        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 16 }}>Verwachte eindtijd</h3>
            <TrendingUp size={18} color="var(--terracotta)" />
          </div>
          {prediction ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{secToHMS(prediction.total)}</div>
                {prediction.statusLabel && (
                  <span className="tri-badge" style={{
                    background: prediction.statusLabel === 'op koers' ? 'var(--success-bg)' : prediction.statusLabel === 'lichte achterstand' ? '#F6E3C0' : '#F7DAD3',
                    color: prediction.statusLabel === 'op koers' ? 'var(--success)' : prediction.statusLabel === 'lichte achterstand' ? 'var(--warning)' : 'var(--danger)',
                  }}>{prediction.statusLabel}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                Waarschijnlijk tussen {secToHMS(prediction.low)} en {secToHMS(prediction.high)} · betrouwbaarheid: {prediction.confidence.level}
              </div>
            </>
          ) : <p style={{ fontSize: 14, color: 'var(--muted)' }}>Rond de intake af om een voorspelling te zien.</p>}
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, marginBottom: 0 }}>{recommendation}</p>
          <PredictionDetails prediction={prediction} />
        </div>

        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>Subdoelen</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {subGoals.some((sg) => sg.status === 'achieved') && (
                <span className="tri-badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Medal size={13} /> {subGoals.filter((sg) => sg.status === 'achieved').length}
                </span>
              )}
              <Flag size={18} color="var(--terracotta)" />
            </div>
          </div>
          {subGoals.length === 0 && <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nog geen subdoelen toegevoegd.</p>}
          {subGoals.map((sg) => {
            const pctMap = { not_started: 0, in_progress: 55, achieved: 100 };
            const order = ['not_started', 'in_progress', 'achieved'];
            const labelMap = { not_started: 'Nog niet gestart', in_progress: 'Bezig', achieved: 'Behaald' };
            return (
              <div key={sg.id} style={{ marginBottom: 14, ...(sg.status === 'achieved' ? { background: 'var(--success-bg)', borderRadius: 12, padding: 10 } : {}) }}>
                <div className="tri-subgoal-row">
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sg.status === 'achieved' && <Medal size={15} color="var(--success)" />} {sg.text}
                  </div>
                  <button className="tri-pill" style={{
                    background: sg.status === 'achieved' ? '#fff' : sg.status === 'in_progress' ? '#F6E3C0' : 'var(--sand)',
                    color: sg.status === 'achieved' ? 'var(--success)' : sg.status === 'in_progress' ? 'var(--warning)' : 'var(--muted)',
                  }} onClick={() => setSubGoals((sgs) => sgs.map((x) => x.id === sg.id ? { ...x, status: order[(order.indexOf(x.status) + 1) % order.length] } : x))}>
                    {sg.status === 'achieved' && <Check size={13} />} {labelMap[sg.status]}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 6px' }}>Streefdatum: {fmtDate(sg.targetDate) || '-'}</div>
                <div className="tri-progress-track"><div className="tri-progress-fill" style={{ width: `${pctMap[sg.status]}%` }} /></div>
              </div>
            );
          })}
          <div className="tri-row" style={{ marginTop: 4 }}>
            <input className="tri-input" placeholder="Nieuw subdoel" value={newSubGoal.text} onChange={(e) => setNewSubGoal((s) => ({ ...s, text: e.target.value }))} />
          </div>
          <div className="tri-row" style={{ marginTop: 8 }}>
            <input type="date" className="tri-input" value={newSubGoal.targetDate} onChange={(e) => setNewSubGoal((s) => ({ ...s, targetDate: e.target.value }))} />
            <button className="tri-btn tri-btn-primary" disabled={!newSubGoal.text}
              onClick={() => { setSubGoals((sgs) => [...sgs, { id: uid('sg'), ...newSubGoal, status: 'not_started' }]); setNewSubGoal({ text: '', targetDate: '' }); }}>
              <Plus size={18} /></button>
          </div>
        </div>

        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 7 }}><Sun size={17} color="var(--accent)" />Vakanties</h3>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 36, padding: '7px 12px', fontSize: 13 }} onClick={() => setShowSettings(true)}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Toevoegen
            </button>
          </div>
          {holidayOutlook.upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              Nog geen vakanties ingepland. Voeg ze toe en ik houd er rekening mee in je opbouw: die weken worden rust of licht, en daarna pakken we het volume rustig weer op.
            </p>
          ) : (
            <>
              {holidayOutlook.upcoming.map((h) => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--sand)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{h.label || 'Vakantie'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{holidayRangeLabel(h)}</div>
                  </div>
                  <span className="tri-badge" style={{
                    background: h.mode === 'rust' ? 'var(--sand)' : '#F6E3C0',
                    color: h.mode === 'rust' ? 'var(--muted)' : 'var(--warning)', flexShrink: 0,
                  }}>{HOLIDAY_MODE_LABEL[h.mode]}</span>
                </div>
              ))}
              {mainGoal.raceDate && !goalPassed && (
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, marginBottom: 0 }}>
                  Van de {holidayOutlook.weeksToRace} weken tot je wedstrijd blijven er {holidayOutlook.effectiveWeeks} volwaardige trainingsweken over
                  {holidayOutlook.lightWeeks > 0 ? `, waarvan ${holidayOutlook.lightWeeks} deels vakantie` : ''}. Daar is de opbouw op afgestemd.
                </p>
              )}
              {holidayOutlook.taperOverlap.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--warning)', marginTop: 8, marginBottom: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{holidayOutlook.taperOverlap.map((h) => h.label || 'Een vakantie').join(' en ')} valt in je scherpste weken vlak voor de wedstrijd. Overweeg daar licht te trainen in plaats van helemaal niets, of je wedstrijddatum te verschuiven.</span>
                </p>
              )}
            </>
          )}
        </div>

        {pastGoals.length > 0 && (
          <div className="tri-card">
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Eerdere doelen</h3>
            {[...pastGoals].reverse().map((pg, i, arr) => {
              const achieved = (pg.subGoals || []).filter((sg) => sg.status === 'achieved').length;
              const pgFirst = weeks.find((w) => w.weekNumber === pg.startWeek);
              const pgLast = weeks.find((w) => w.weekNumber === pg.endWeek) || pgFirst;
              const pgPeriod = pgFirst ? `${fmtDayMonth(pgFirst.startDate)} – ${fmtDayMonth(weekEnd(pgLast.startDate))}` : null;
              return (
                <div key={pg.id} style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--sand)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{RACE_TYPES[pg.raceType]?.label ?? pg.raceType}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {fmtDate(pg.raceDate)}{pgPeriod ? ` · schema ${pgPeriod}` : ''}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {pg.finishTime ? `Eindtijd ${pg.finishTime}` : 'Geen eindtijd genoteerd'}
                    {pg.ambition === 'target' && pg.targetTime ? ` (doel ${pg.targetTime})` : ''}
                    {achieved > 0 ? ` · ${achieved} subdoel${achieved === 1 ? '' : 'en'} behaald` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* --------------------------- Schedule tab --------------------------- */
  function ScheduleTab() {
    const [regenConfirm, setRegenConfirm] = useState(false);
    const [dragId, setDragId] = useState(null);
    const [dragOverDay, setDragOverDay] = useState(null);
    const dragOverDayRef = useRef(null);
    useEffect(() => { dragOverDayRef.current = dragOverDay; }, [dragOverDay]);
    useEffect(() => {
      if (dragId == null || !currentWeek) return;
      function handleMove(e) {
        const point = e.touches ? e.touches[0] : e;
        const el = document.elementFromPoint(point.clientX, point.clientY);
        const cardEl = el && el.closest('[data-day]');
        setDragOverDay(cardEl ? Number(cardEl.getAttribute('data-day')) : null);
      }
      function handleUp() {
        const overDay = dragOverDayRef.current;
        if (overDay != null) {
          const session = currentWeek.sessions.find((s) => s.id === dragId);
          if (session && session.day !== overDay) swapDays(currentWeek.id, dragId, overDay);
        }
        setDragId(null);
        setDragOverDay(null);
      }
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      return () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
    }, [dragId, currentWeek]);
    if (!currentWeek) return null;
    const trainCount = currentWeek.sessions.filter((s) => s.discipline !== 'rust').length;
    const doneCount = currentWeek.sessions.filter((s) => s.discipline !== 'rust' && (s.status === 'voltooid' || s.status === 'aangepast')).length;
    const isLast = currentWeekIndex === weeks.length - 1;
    return (
      <div className="tri-scroll">
        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px' }} disabled={currentWeekIndex === 0}
              onClick={() => setCurrentWeekIndex((i) => Math.max(i - 1, 0))}><ChevronLeft size={18} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontFamily: 'Fraunces, serif', fontSize: 18 }}>{weekRangeLabel(currentWeek.startDate)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{weekRelativeLabel(currentWeek.startDate) || weekMonthLabel(currentWeek.startDate)}</div>
            </div>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px' }} disabled={currentWeekIndex >= weeks.length - 1}
              onClick={() => setCurrentWeekIndex((i) => Math.min(i + 1, weeks.length - 1))}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tri-badge" style={{ background: '#FDEEE4', color: 'var(--terracotta)' }}>{PHASE_LABEL[currentWeek.phase]}</span>
            {currentWeek.isDeload && <span className="tri-badge" style={{ background: '#F6E3C0', color: 'var(--warning)' }}>Hersteweek</span>}
            {currentWeek.holiday && (
              <span className="tri-badge" style={{ background: '#E4EACB', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sun size={12} />{currentWeek.holiday.names.join(', ')}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{doneCount}/{trainCount} trainingen afgerond</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>{PHASE_TEXT[currentWeek.phase]}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, marginBottom: 0 }}>{currentWeek.adaptNote}</p>
          {!regenConfirm ? (
            <button className="tri-btn tri-btn-secondary" style={{ marginTop: 12, padding: '9px 14px', fontSize: 13, minHeight: 38 }}
              onClick={() => setRegenConfirm(true)}>
              <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Deze week hergenereren
            </button>
          ) : (
            <div style={{ marginTop: 12, background: '#F6E3C0', borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 13, margin: '0 0 10px' }}>De week van {weekRangeLabel(currentWeek.startDate)} opnieuw laten opbouwen? Handmatige aanpassingen en ingevulde resultaten in deze week gaan dan verloren.</p>
              <div className="tri-row">
                <button className="tri-btn tri-btn-secondary" style={{ minHeight: 38, fontSize: 13 }} onClick={() => setRegenConfirm(false)}>Annuleren</button>
                <button className="tri-btn" style={{ minHeight: 38, fontSize: 13, background: 'var(--terracotta)', color: '#fff' }}
                  onClick={() => { regenerateWeek(currentWeekIndex); setRegenConfirm(false); }}>Ja, hergenereren</button>
              </div>
            </div>
          )}
        </div>

        {(() => {
          const sum = weekLoadSummary(currentWeek, extraLog, intake);
          return (
            <div className="tri-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sum.inWeek.length ? 8 : 0 }}>
                <h3 style={{ fontSize: 15 }}>Extra activiteiten</h3>
                <button className="tri-btn tri-btn-secondary" style={{ minHeight: 34, padding: '6px 12px', fontSize: 13 }} onClick={() => setActiveTab('log')}>
                  <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Toevoegen
                </button>
              </div>
              {sum.inWeek.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>Fietsen naar je werk of waterpolo deze week? Voeg het toe, dan houdt je schema er rekening mee.</p>}
              {sum.inWeek.map((e) => {
                const m = EXTRA_KINDS[e.kind] || EXTRA_KINDS.overig;
                const dIdx = (new Date(`${e.date}T12:00:00`).getDay() + 6) % 7;
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
                    <m.icon size={15} color={m.color} />
                    <span style={{ width: 24, fontWeight: 700, color: 'var(--muted)' }}>{DAYS[dIdx]}</span>
                    <span style={{ flex: 1 }}>{extraLabel(e)}</span>
                    <span style={{ color: 'var(--muted)' }}>{extraDetail(e)}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {currentWeek.sessions.map((s) => (
          <SessionCard key={s.id} session={s} week={currentWeek}
            dragId={dragId} dragOverDay={dragOverDay} onDragHandleDown={setDragId} />
        ))}

        {isLast && goalPassed && (
          <div className="tri-card" style={{ background: 'var(--success-bg)', border: '1.5px solid var(--success)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>Je wedstrijd is geweest</h3>
            <p style={{ fontSize: 14, margin: '0 0 12px' }}>Kies eerst een nieuw doel, dan bouw ik de volgende week daarop af.</p>
            <button className="tri-btn tri-btn-primary tri-btn-block" onClick={openNewGoal}>Nieuw doel kiezen</button>
          </div>
        )}
        {isLast && !goalPassed && (
          <button className="tri-btn tri-btn-primary tri-btn-block" onClick={generateNextWeek}>
            Genereer {weekRangeLabel(addDays(new Date(currentWeek.startDate), 7))} <Sparkles size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          </button>
        )}
      </div>
    );
  }

  /* --------------------------- Results tab --------------------------- */
  function ResultForm({ session, week }) {
    const [status, setStatus] = useState(session.status);
    const [distance, setDistance] = useState(session.result?.distance ?? '');
    const [duration, setDuration] = useState(session.result?.duration ?? '');
    const [pace, setPace] = useState(session.result?.pace ?? '');
    const [speed, setSpeed] = useState(session.result?.speed ?? '');
    const [hr, setHr] = useState(session.result?.hr ?? '');
    const [rpe, setRpe] = useState(session.result?.rpe ?? 5);
    const [notes, setNotes] = useState(session.result?.notes ?? '');
    const meta = DISCIPLINE_META[session.discipline];

    function save() {
      updateSession(week.id, session.id, (s) => ({
        ...s, status,
        result: status === 'overgeslagen' ? { notes } : { distance, duration, pace, speed, hr, rpe, notes },
      }));
      setOpenResultFor(null);
    }

    return (
      <div className="tri-card" style={{ borderColor: 'var(--accent)' }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>{DAYS_FULL[session.day]} · {meta.label} {session.type}</h3>
        <div className="tri-field">
          <label className="tri-label">Status</label>
          <div className="tri-choice-grid">
            {['voltooid', 'aangepast', 'overgeslagen'].map((st) => (
              <button key={st} className={`tri-choice ${status === st ? 'selected' : ''}`} style={{ fontSize: 13 }} onClick={() => setStatus(st)}>{STATUS_META[st].label}</button>
            ))}
          </div>
        </div>
        {status !== 'overgeslagen' && session.discipline === 'wedstrijd' && (
          <div className="tri-row">
            <div className="tri-field"><label className="tri-label">Eindtijd (uu:mm:ss)</label>
              <input className="tri-input" placeholder="bv. 1:23:45" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <div className="tri-field"><label className="tri-label">RPE (1-10): {rpe}</label>
              <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} style={{ width: '100%', marginTop: 12 }} /></div>
          </div>
        )}
        {status !== 'overgeslagen' && session.discipline !== 'wedstrijd' && (
          <>
            <div className="tri-row">
              <div className="tri-field"><label className="tri-label">Afstand/duur</label>
                <input className="tri-input" placeholder={session.discipline === 'kracht' ? 'min' : 'km of m'} value={distance} onChange={(e) => setDistance(e.target.value)} /></div>
              {session.discipline === 'kracht' ? (
                <div className="tri-field"><label className="tri-label">Duur (min)</label>
                  <input className="tri-input" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
              ) : session.discipline === 'fietsen' ? (
                <div className="tri-field"><label className="tri-label">Snelheid (km/u)</label>
                  <input className="tri-input" value={speed} onChange={(e) => setSpeed(e.target.value)} /></div>
              ) : (
                <div className="tri-field"><label className="tri-label">Tempo (min/{session.discipline === 'zwemmen' ? '100m' : 'km'})</label>
                  <input className="tri-input" placeholder="mm:ss" value={pace} onChange={(e) => setPace(e.target.value)} /></div>
              )}
            </div>
            <div className="tri-row">
              <div className="tri-field"><label className="tri-label">Gem. hartslag</label>
                <input type="number" className="tri-input" value={hr} onChange={(e) => setHr(e.target.value)} /></div>
              <div className="tri-field"><label className="tri-label">RPE (1-10): {rpe}</label>
                <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} style={{ width: '100%', marginTop: 12 }} /></div>
            </div>
          </>
        )}
        <div className="tri-field"><label className="tri-label">Notities (optioneel)</label>
          <textarea className="tri-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="tri-row">
          <button className="tri-btn tri-btn-secondary" onClick={() => setOpenResultFor(null)}>Annuleren</button>
          <button className="tri-btn tri-btn-primary" onClick={save}><Check size={16} style={{ verticalAlign: 'middle', marginRight: 5 }} />Opslaan</button>
        </div>
      </div>
    );
  }

  function ResultsTab() {
    const week = weeks[resultsWeekIndex];
    if (!week) return null;
    const trainSessions = week.sessions.filter((s) => s.discipline !== 'rust');
    const done = trainSessions.filter((s) => s.status !== 'gepland').length;
    return (
      <div className="tri-scroll">
        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px' }} disabled={resultsWeekIndex === 0}
              onClick={() => setResultsWeekIndex((i) => Math.max(i - 1, 0))}><ChevronLeft size={18} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontFamily: 'Fraunces, serif', fontSize: 18 }}>{weekRangeLabel(week.startDate)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{done}/{trainSessions.length} ingevuld</div>
            </div>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px' }} disabled={resultsWeekIndex >= weeks.length - 1}
              onClick={() => setResultsWeekIndex((i) => Math.min(i + 1, weeks.length - 1))}><ChevronRight size={18} /></button>
          </div>
        </div>
        {trainSessions.map((s) => (
          openResultFor === s.id ? (
            <ResultForm key={s.id} session={s} week={week} />
          ) : (
            <div key={s.id} className="tri-card" onClick={() => setOpenResultFor(s.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{DAYS_FULL[s.day]}</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.discipline === 'wedstrijd' ? (s.raceName || DISCIPLINE_META.wedstrijd.label) : DISCIPLINE_META[s.discipline].label} · {s.type}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.target?.label}</div>
                </div>
                <span className="tri-badge" style={{ background: STATUS_META[s.status].bg, color: STATUS_META[s.status].color }}>{STATUS_META[s.status].label}</span>
              </div>
            </div>
          )
        ))}
      </div>
    );
  }

  /* --------------------------- Import panel (Strava/Garmin/etc. CSV) --------------------------- */
  function ImportPanel() {
    const [matches, setMatches] = useState(null);
    const [selected, setSelected] = useState({});
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [imported, setImported] = useState(false);

    function handleFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setFileName(file.name); setError(''); setImported(false);
      const reader = new FileReader();
      reader.onload = () => {
        const activities = parseActivitiesCsv(String(reader.result));
        if (!activities.length) { setError('Kon geen activiteiten herkennen in dit bestand. Exporteer als CSV vanuit Strava ("Bulk export") of Garmin Connect.'); setMatches(null); return; }
        const found = matchImportedActivities(weeks, activities);
        setMatches(found);
        setSelected(Object.fromEntries(found.map((m, i) => [i, true])));
      };
      reader.readAsText(file);
    }

    function doImport() {
      const toApply = matches.filter((_, i) => selected[i]);
      applyImportedMatches(toApply);
      setImported(true);
    }

    return (
      <div style={{ borderTop: '1px solid var(--sand)', marginTop: 14, paddingTop: 14 }}>
        <h3 style={{ fontSize: 15, marginTop: 0, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={15} /> Activiteiten importeren</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>
          Upload een CSV-export van Strava, Garmin Connect of Apple Health (via een export-app) om automatisch resultaten in te vullen bij passende geplande trainingen.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="tri-input" style={{ padding: 10 }} />
        {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
        {matches && matches.length === 0 && !error && (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>Geen activiteiten in "{fileName}" pasten bij een geplande training (zelfde discipline, binnen 1 dag).</p>
        )}
        {matches && matches.length > 0 && !imported && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>{matches.length} activiteit(en) gevonden die passen bij geplande trainingen:</p>
            {matches.map((m, i) => {
              const meta = DISCIPLINE_META[m.session.discipline];
              return (
                <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--sand)' }}>
                  <input type="checkbox" checked={!!selected[i]} onChange={(e) => setSelected((s) => ({ ...s, [i]: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  <meta.icon size={16} color={meta.color} />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <b>{meta.label} · {m.session.type}</b> op {fmtDate(m.sessionDate)}
                    <div style={{ color: 'var(--muted)' }}>{m.activity.distanceKm ? `${Math.round(m.activity.distanceKm * 100) / 100} km` : ''}{m.activity.durationSec ? ` · ${secToHMS(m.activity.durationSec)}` : ''}{m.activity.name ? ` · ${m.activity.name}` : ''}</div>
                  </div>
                </label>
              );
            })}
            <button className="tri-btn tri-btn-primary tri-btn-block" style={{ marginTop: 12 }} onClick={doImport}>
              {Object.values(selected).filter(Boolean).length} activiteit(en) importeren
            </button>
          </div>
        )}
        {imported && <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 10 }}><Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Geïmporteerd — bekijk de resultaten in Resultaten of Voortgang.</p>}
      </div>
    );
  }

  /* --------------------------- Calendar tab --------------------------- */
  function CalendarTab() {
    const [viewMonth, setViewMonth] = useState(startOfMonth(weeks[0] ? new Date(weeks[0].startDate) : new Date()));
    const [selectedKey, setSelectedKey] = useState(null);

    const allSessions = useMemo(() => {
      const list = [];
      weeks.forEach((w) => {
        w.sessions.forEach((s) => {
          if (s.discipline === 'rust') return;
          list.push({ ...s, date: addDays(new Date(w.startDate), s.day), weekId: w.id, weekNumber: w.weekNumber, weekStart: w.startDate });
        });
      });
      return list;
    }, [weeks]);

    const sessionMap = useMemo(() => {
      const m = {};
      allSessions.forEach((s) => { m[dateKey(s.date)] = s; });
      return m;
    }, [allSessions]);

    const total = allSessions.length;
    const completed = allSessions.filter((s) => s.status === 'voltooid' || s.status === 'aangepast').length;
    const skipped = allSessions.filter((s) => s.status === 'overgeslagen').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    const extraByDate = useMemo(() => {
      const m = {};
      extraLog.forEach((e) => { (m[e.date] = m[e.date] || []).push(e); });
      return m;
    }, [extraLog]);

    const gridStart = startOfWeek(viewMonth);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const todayKey = dateKey(new Date());
    const raceKey = mainGoal.raceDate ? dateKey(mainGoal.raceDate) : null;
    const selected = selectedKey ? sessionMap[selectedKey] : null;
    const selectedExtras = selectedKey ? (extraByDate[selectedKey] || []) : [];

    return (
      <div className="tri-scroll">
        <div className="tri-card">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Voortgang over de hele periode</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, textAlign: 'center', background: '#F2E9DC', borderRadius: 12, padding: '10px 4px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif' }}>{total}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>gepland</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: 'var(--success-bg)', borderRadius: 12, padding: '10px 4px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: 'var(--success)' }}>{completed}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>voltooid</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: '#F7DAD3', borderRadius: 12, padding: '10px 4px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Fraunces, serif', color: 'var(--danger)' }}>{skipped}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>overgeslagen</div>
            </div>
          </div>
          <div className="tri-progress-track" style={{ marginTop: 12 }}><div className="tri-progress-fill" style={{ width: `${pct}%` }} /></div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{pct}% van alle geplande trainingen tot nu toe afgerond</div>
        </div>

        <div className="tri-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 36, padding: '6px 10px' }}
              onClick={() => setViewMonth((m) => startOfMonth(addDays(startOfMonth(m), -1)))}><ChevronLeft size={16} /></button>
            <div style={{ fontWeight: 700, fontFamily: 'Fraunces, serif' }}>{viewMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</div>
            <button className="tri-btn tri-btn-secondary" style={{ minHeight: 36, padding: '6px 10px' }}
              onClick={() => setViewMonth((m) => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return startOfMonth(n); })}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {DAYS.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((d, i) => {
              const key = dateKey(d);
              const s = sessionMap[key];
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isToday = key === todayKey;
              const isRace = key === raceKey;
              const meta = s ? DISCIPLINE_META[s.discipline] : null;
              const dayExtras = extraByDate[key] || [];
              const hol = holidayForDate(d, holidays);
              let bg = 'transparent', border = '1px solid transparent';
              if (hol) { bg = '#EDF1DC'; border = '1px dashed var(--success)'; }
              if (s) {
                if (s.status === 'voltooid' || s.status === 'aangepast') bg = 'var(--success-bg)';
                else if (s.status === 'overgeslagen') bg = '#F7DAD3';
                else bg = meta.color + '18';
              }
              if (isRace) border = '1.5px solid var(--terracotta)';
              return (
                <button key={i} onClick={() => (s || dayExtras.length) && setSelectedKey(key)} style={{
                  aspectRatio: '1', borderRadius: 10, border, background: bg,
                  opacity: inMonth ? 1 : 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 2, fontSize: 11, fontWeight: isToday ? 800 : 500,
                  color: isToday ? 'var(--terracotta)' : 'var(--text)', cursor: (s || dayExtras.length) ? 'pointer' : 'default', padding: 2,
                }}>
                  <span>{d.getDate()}</span>
                  {meta && <meta.icon size={10} color={meta.color} />}
                  {!meta && hol && <Sun size={10} color="var(--accent)" />}
                  {isRace && <Flag size={9} color="var(--terracotta)" />}
                  {dayExtras.length > 0 && (
                    <span style={{ display: 'flex', gap: 2 }}>
                      {[...new Set(dayExtras.map((e) => e.kind))].map((k) => <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: (EXTRA_KINDS[k] || EXTRA_KINDS.overig).color }} />)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {extraLog.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>Kleine gekleurde stipjes zijn extra activiteiten (fietsen, waterpolo, ...).</p>
        )}

        {selectedKey && selectedExtras.length > 0 && (
          <div className="tri-card">
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Extra activiteiten op {fmtDate(selectedKey)}</div>
            {selectedExtras.map((e) => {
              const m = EXTRA_KINDS[e.kind] || EXTRA_KINDS.overig;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
                  <m.icon size={16} color={m.color} /><span style={{ flex: 1, fontWeight: 600 }}>{extraLabel(e)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{extraDetail(e)}</span>
                </div>
              );
            })}
          </div>
        )}

        {holidays.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sun size={13} color="var(--accent)" /> Dagen met een gestippelde rand vallen in een vakantie.
          </p>
        )}

        {selected && (
          <div className="tri-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{fmtDate(selected.date)} · week {weekRangeLabel(selected.weekStart)}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{DISCIPLINE_META[selected.discipline].label} · {selected.type}</div>
                {selected.target && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{selected.target.label}</div>}
              </div>
              <span className="tri-badge" style={{ background: STATUS_META[selected.status].bg, color: STATUS_META[selected.status].color }}>{STATUS_META[selected.status].label}</span>
            </div>
            <div className="tri-row" style={{ marginTop: 12 }}>
              <button className="tri-btn tri-btn-secondary" onClick={() => { setActiveTab('schedule'); setCurrentWeekIndex(weeks.findIndex((w) => w.id === selected.weekId)); }}>Bekijk in weekschema</button>
              <button className="tri-btn tri-btn-primary" onClick={() => { setActiveTab('results'); setResultsWeekIndex(weeks.findIndex((w) => w.id === selected.weekId)); setOpenResultFor(selected.id); }}>Resultaat invullen</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* --------------------------- Progress tab --------------------------- */
  function ProgressTab() {
    const swimSeries = getDisciplineSeries(weeks, 'zwemmen');
    const bikeSeries = getDisciplineSeries(weeks, 'fietsen');
    const runSeries = getDisciplineSeries(weeks, 'hardlopen');
    const seriesMap = { zwemmen: swimSeries, fietsen: bikeSeries, hardlopen: runSeries };
    // De reeksen rekenen met weeknummers; op de as zetten we de startdatum van die week.
    const startByWeekNumber = {};
    weeks.forEach((w) => { startByWeekNumber[w.weekNumber] = w.startDate; });
    const chartData = seriesMap[progressDiscipline].map((s) => ({
      week: fmtDayMonth(startByWeekNumber[s.week]) || String(s.week), value: s.value,
    }));
    const unitLabel = progressDiscipline === 'fietsen' ? 'km/u' : 'sec/eenheid (lager = sneller)';

    const volumeData = weeks.map((w) => {
      const planned = w.sessions.filter((s) => s.discipline !== 'rust' && s.target).reduce((a, s) => a + (s.target.unit === 'm' ? s.target.amount / 1000 : s.target.unit === 'km' ? s.target.amount : 0), 0);
      const actual = w.sessions.filter((s) => s.status === 'voltooid' || s.status === 'aangepast').reduce((a, s) => {
        const d = parseFloat(s.result?.distance);
        return a + (isNaN(d) ? 0 : d > 100 ? d / 1000 : d);
      }, 0);
      return { week: fmtDayMonth(w.startDate), Gepland: Math.round(planned * 10) / 10, Voltooid: Math.round(actual * 10) / 10 };
    });

    const hrData = weeks.map((w) => {
      const hrs = w.sessions.filter((s) => s.result && s.result.hr).map((s) => Number(s.result.hr));
      const avg = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
      return { week: fmtDayMonth(w.startDate), hr: avg };
    }).filter((d) => d.hr != null);

    const blockComparison = computeBlockComparison(weeks);

    const subtabs = [
      { key: 'tempo', label: 'Tempo' }, { key: 'volume', label: 'Volume' },
      { key: 'hr', label: 'Hartslag' }, { key: 'blok', label: 'Vorig blok' }, { key: 'voorspelling', label: 'Voorspelling' },
    ];

    return (
      <div className="tri-scroll">
        <div className="tri-daytab" style={{ marginBottom: 14 }}>
          {subtabs.map((t) => (
            <button key={t.key} className="tri-choice" style={{ padding: '9px 14px', fontSize: 13 }}
              onClick={() => setProgressSubTab(t.key)}
              {...{}}
              >
              <span style={{ color: progressSubTab === t.key ? 'var(--terracotta)' : 'var(--text)', fontWeight: progressSubTab === t.key ? 700 : 600, borderBottom: progressSubTab === t.key ? '2px solid var(--terracotta)' : 'none' }}>{t.label}</span>
            </button>
          ))}
        </div>

        {progressSubTab === 'tempo' && (
          <div className="tri-card">
            <div className="tri-row" style={{ marginBottom: 14 }}>
              {['zwemmen', 'fietsen', 'hardlopen'].map((d) => (
                <button key={d} className={`tri-choice ${progressDiscipline === d ? 'selected' : ''}`} style={{ fontSize: 13 }}
                  onClick={() => setProgressDiscipline(d)}>{DISCIPLINE_META[d].label}</button>
              ))}
            </div>
            {chartData.length >= 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#EFE2CB" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8A7460' }} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={{ fontSize: 12, fill: '#8A7460' }} reversed={progressDiscipline !== 'fietsen'} />
                  <Tooltip formatter={(v) => progressDiscipline === 'fietsen' ? `${v.toFixed(1)} km/u` : secToPaceStr(v)} />
                  <Line type="monotone" dataKey="value" stroke="#C1552C" strokeWidth={3} dot={{ r: 4, fill: '#C1552C' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nog geen resultaten voor deze discipline.</p>}
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{unitLabel}</p>
          </div>
        )}

        {progressSubTab === 'volume' && (
          <div className="tri-card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Gepland vs. voltooid volume (km/wk)</h3>
            {volumeData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeData}>
                  <CartesianGrid stroke="#EFE2CB" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8A7460' }} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={{ fontSize: 12, fill: '#8A7460' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Gepland" fill="#E9D7B8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Voltooid" fill="#C1552C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nog geen data.</p>}
          </div>
        )}

        {progressSubTab === 'hr' && (
          <div className="tri-card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Gemiddelde hartslag per week</h3>
            {hrData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hrData}>
                  <CartesianGrid stroke="#EFE2CB" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8A7460' }} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tick={{ fontSize: 12, fill: '#8A7460' }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="hr" stroke="#B84A3E" strokeWidth={3} dot={{ r: 4, fill: '#B84A3E' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nog geen hartslagdata ingevuld.</p>}
          </div>
        )}

        {progressSubTab === 'blok' && (
          <div className="tri-card">
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Dit blok vs. vorig blok</h3>
            {blockComparison ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>{blockComparison.prior.label} vergeleken met {blockComparison.recent.label}</p>
                {[
                  { label: 'Totaal volume', unit: 'km', prior: blockComparison.prior.totalKm, recent: blockComparison.recent.totalKm, higherIsBetter: true },
                  { label: 'Voltooiingspercentage', unit: '%', prior: blockComparison.prior.completionPct, recent: blockComparison.recent.completionPct, higherIsBetter: true },
                  { label: 'Gemiddelde RPE', unit: '', prior: blockComparison.prior.avgRpe, recent: blockComparison.recent.avgRpe, higherIsBetter: false },
                ].map((row) => {
                  if (row.prior == null || row.recent == null) return null;
                  const improved = row.higherIsBetter ? row.recent >= row.prior : row.recent <= row.prior;
                  const diff = Math.round((row.recent - row.prior) * 10) / 10;
                  return (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--sand)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{row.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.prior}{row.unit} → </span>
                        <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{row.recent}{row.unit}</span>
                        <span className="tri-badge" style={{ background: improved ? 'var(--success-bg)' : '#F7DAD3', color: improved ? 'var(--success)' : 'var(--danger)' }}>
                          {diff > 0 ? '+' : ''}{diff}{row.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nog niet genoeg weken om een vorig blok mee te vergelijken — dit verschijnt zodra je minstens twee blokken van elk enkele weken hebt afgerond.</p>
            )}
          </div>
        )}

        {progressSubTab === 'voorspelling' && (
          <div className="tri-card">
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Verwachte splits op wedstrijddag</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Op basis van je resultaten, extra activiteiten en wedstrijdafstand, geëxtrapoleerd naar {mainGoal.raceDate ? `je wedstrijddag (${fmtDate(mainGoal.raceDate)})` : 'het einde van je plan'}.</p>
            {prediction && (
              <>
                {[
                  { label: 'Zwemmen', icon: Waves, time: prediction.swimTime, color: '#2E7D8F' },
                  { label: 'Fietsen', icon: Bike, time: prediction.bikeTime, color: '#C1552C' },
                  { label: 'Hardlopen', icon: Footprints, time: prediction.runTime, color: '#D9A441' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--sand)' }}>
                    <row.icon size={18} color={row.color} />
                    <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{row.label}</div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{secToHMS(row.time)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                  <span>Wissels</span><span>{secToHMS(prediction.transition)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontWeight: 700, fontSize: 17 }}>
                  <span>Totaal</span><span>{secToHMS(prediction.total)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Waarschijnlijk tussen {secToHMS(prediction.low)} en {secToHMS(prediction.high)}</div>
                {mainGoal.ambition === 'target' && mainGoal.targetTime && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Doeltijd: {mainGoal.targetTime}</div>
                )}
                <PredictionDetails prediction={prediction} defaultOpen />
                <div className="tri-card" style={{ background: '#FDEEE4', marginTop: 14, boxShadow: 'none' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertTriangle size={18} color="var(--terracotta)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>{recommendation}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* --------------------------- Holiday panel (settings) --------------------------- */
  function HolidayPanel() {
    const todayKey = dateKey(new Date());
    const [draft, setDraft] = useState({ label: '', from: '', to: '', mode: 'rust', disciplines: ['hardlopen', 'kracht'] });
    const [adding, setAdding] = useState(false);
    const valid = draft.from && draft.to && draft.to >= draft.from;

    function save() {
      const disciplines = draft.mode === 'licht' ? draft.disciplines : [];
      if (draft.mode === 'licht' && disciplines.length === 0) return;
      saveHoliday({ id: uid('hol'), label: draft.label.trim() || 'Vakantie', from: draft.from, to: draft.to, mode: draft.mode, disciplines });
      setDraft({ label: '', from: '', to: '', mode: 'rust', disciplines: ['hardlopen', 'kracht'] });
      setAdding(false);
    }

    return (
      <div style={{ borderTop: '1px solid var(--sand)', marginTop: 14, paddingTop: 14 }}>
        <h3 style={{ fontSize: 15, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 7 }}><Sun size={16} color="var(--accent)" />Vakanties</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>
          Geef aan wanneer je weg bent. Die dagen worden rust of een lichtere sessie, de opbouw eromheen wordt aangepast, en na je vakantie begint het volume weer voorzichtig.
        </p>

        {holidays.length > 0 && holidays.map((h) => (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid var(--sand)', borderRadius: 12, padding: 10, marginBottom: 8, opacity: h.to < todayKey ? 0.55 : 1 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{h.label || 'Vakantie'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {holidayRangeLabel(h)} · {HOLIDAY_MODE_LABEL[h.mode]}
                {h.mode === 'licht' && h.disciplines?.length ? ` (${h.disciplines.map((d) => DISCIPLINE_META[d].label.toLowerCase()).join(', ')})` : ''}
              </div>
            </div>
            <button className="tri-btn" style={{ minHeight: 36, padding: '6px 10px', background: '#F7DAD3', color: 'var(--danger)', flexShrink: 0 }}
              onClick={() => removeHoliday(h.id)} aria-label="Vakantie verwijderen"><Trash2 size={15} /></button>
          </div>
        ))}

        {!adding ? (
          <button className="tri-btn tri-btn-ghost tri-btn-block" style={{ minHeight: 42 }} onClick={() => setAdding(true)}>
            <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Vakantie toevoegen
          </button>
        ) : (
          <div style={{ border: '1px solid var(--sand)', borderRadius: 14, padding: 12 }}>
            <div className="tri-field">
              <label className="tri-label">Naam (optioneel)</label>
              <input className="tri-input" placeholder="bv. Italië" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="tri-row">
              <div className="tri-field">
                <label className="tri-label">Van</label>
                <input type="date" className="tri-input" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value, to: d.to && d.to < e.target.value ? e.target.value : d.to }))} />
              </div>
              <div className="tri-field">
                <label className="tri-label">Tot en met</label>
                <input type="date" className="tri-input" min={draft.from || undefined} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
              </div>
            </div>
            <div className="tri-field">
              <label className="tri-label">Wat kan er?</label>
              <div className="tri-row">
                <button className={`tri-choice ${draft.mode === 'rust' ? 'selected' : ''}`} onClick={() => setDraft((d) => ({ ...d, mode: 'rust' }))}>Geen training</button>
                <button className={`tri-choice ${draft.mode === 'licht' ? 'selected' : ''}`} onClick={() => setDraft((d) => ({ ...d, mode: 'licht' }))}>Licht trainen</button>
              </div>
            </div>
            {draft.mode === 'licht' && (
              <div className="tri-field">
                <label className="tri-label">Mogelijke sporten op locatie</label>
                <div className="tri-daytab">
                  {HOLIDAY_DISCIPLINES.map((d) => {
                    const isSel = draft.disciplines.includes(d);
                    const meta = DISCIPLINE_META[d];
                    return (
                      <button key={d} className="tri-choice" style={{
                        padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5,
                        borderColor: isSel ? 'var(--terracotta)' : undefined,
                        background: isSel ? '#FDEEE4' : undefined,
                        color: isSel ? 'var(--terracotta)' : undefined,
                      }} onClick={() => setDraft((x) => ({
                        ...x, disciplines: isSel ? x.disciplines.filter((y) => y !== d) : [...x.disciplines, d],
                      }))}>
                        <meta.icon size={13} />{meta.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
                  Sessies in een sport die hier niet staat worden omgezet naar een sport die wel kan, of naar rust. Alles wordt korter en rustiger.
                </p>
              </div>
            )}
            <div className="tri-row" style={{ marginTop: 4 }}>
              <button className="tri-btn tri-btn-secondary" onClick={() => setAdding(false)}>Annuleren</button>
              <button className="tri-btn tri-btn-primary" disabled={!valid || (draft.mode === 'licht' && draft.disciplines.length === 0)} onClick={save}>Opslaan</button>
            </div>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 0 }}>
          Weken die nog niet begonnen zijn worden meteen opnieuw opgebouwd. Weken met ingevulde resultaten blijven ongemoeid.
        </p>
      </div>
    );
  }

  /* --------------------------- render app shell --------------------------- */
  const tabs = [
    { key: 'dashboard', label: 'Doelen', icon: Target },
    { key: 'schedule', label: 'Weekschema', icon: Calendar },
    { key: 'log', label: 'Logboek', icon: Activity },
    { key: 'results', label: 'Resultaten', icon: Award },
    { key: 'calendar', label: 'Kalender', icon: Grid3x3 },
    { key: 'progress', label: 'Voortgang', icon: TrendingUp },
  ];

  return (
    <div className="tri-root">
      {styleBlock}
      <div className="tri-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="tri-eyebrow">Trainingsapp</div>
          <h1 style={{ fontSize: 22 }}>{tabs.find((t) => t.key === activeTab).label}</h1>
        </div>
        <button className="tri-btn tri-btn-secondary" style={{ minHeight: 40, padding: '8px 12px', marginTop: 4, position: 'relative' }} onClick={() => setShowSettings(true)}>
          <Settings size={18} />
          <span style={{
            position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%',
            background: syncStatus === 'saving' ? 'var(--warning)' : syncStatus === 'error' ? 'var(--danger)' : syncStatus === 'local-only' ? 'var(--muted)' : 'var(--success)',
            border: '2px solid var(--bg)',
          }} title={syncStatus === 'saving' ? 'Bezig met synchroniseren…' : syncStatus === 'error' ? 'Synchroniseren mislukt' : syncStatus === 'local-only' ? 'Alleen lokaal opgeslagen' : 'Gesynchroniseerd met Google Sheets'} />
        </button>
      </div>
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'log' && <LogTab extraLog={extraLog} weeks={weeks} intake={intake} onAdd={addExtras} onRemove={removeExtra} onGoSchedule={() => { setActiveTab('schedule'); setCurrentWeekIndex(Math.max(weeks.findIndex((w) => weekLoadSummary(w, [], intake).keys.includes(dateKey(new Date()))), 0)); }} />}
      {activeTab === 'results' && <ResultsTab />}
      {activeTab === 'calendar' && <CalendarTab />}
      {activeTab === 'progress' && <ProgressTab />}

      <div className="tri-nav">
        {tabs.map((t) => (
          <button key={t.key} className={`tri-nav-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <t.icon size={20} />
            {t.label}
          </button>
        ))}
      </div>

      {showSettings && (
        <div className="tri-modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="tri-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 19 }}>Instellingen</h2>
              <button className="tri-btn tri-btn-secondary" style={{ minHeight: 38, padding: '6px 10px' }} onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            <h3 style={{ fontSize: 15, marginTop: 4, marginBottom: 2 }}>Trainingsvolume</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Pas je huidige wekelijkse kilometers aan, of stel zelf een piekvolume in. Nieuw gegenereerde weken bouwen hier geleidelijk naartoe op.</p>
            {['zwemmen', 'fietsen', 'hardlopen'].map((d) => {
              const key = d === 'zwemmen' ? 'swim' : d === 'fietsen' ? 'bike' : 'run';
              const meta = DISCIPLINE_META[d];
              const info = currentWeek?.weeklyVolumeMeta?.[d];
              return (
                <div key={d} style={{ border: '1px solid var(--sand)', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                  <div className="tri-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <meta.icon size={14} color={meta.color} /> {meta.label}
                  </div>
                  <div className="tri-row">
                    <div className="tri-field" style={{ marginBottom: 6 }}>
                      <label className="tri-label">Huidig volume (km/week)</label>
                      <input type="number" step="0.5" min="0" className="tri-input" value={intake[key].volumeKm}
                        onChange={(e) => setIntake((i) => ({ ...i, [key]: { ...i[key], volumeKm: Math.max(+e.target.value, 0) } }))} />
                    </div>
                    <div className="tri-field" style={{ marginBottom: 6 }}>
                      <label className="tri-label">Eigen piekvolume (optioneel)</label>
                      <input type="number" step="0.5" min="0" className="tri-input" value={intake[key].targetVolumeKm ?? ''}
                        placeholder={info ? `auto ~${Math.round(info.peak)} km` : 'automatisch'}
                        onChange={(e) => setIntake((i) => ({ ...i, [key]: { ...i[key], targetVolumeKm: e.target.value === '' ? null : Math.max(+e.target.value, 0) } }))} />
                    </div>
                  </div>
                  {info && !info.manualOverride && info.ambitious && (
                    <p style={{ fontSize: 12, color: 'var(--warning)', margin: '4px 0 0' }}>
                      Voor {RACE_TYPES[mainGoal.raceType].label.toLowerCase()} zou ~{Math.round(info.required)} km/week nodig zijn — dat is een grote sprong vanaf je huidige niveau. We bouwen zo ver mogelijk veilig op richting ~{Math.round(info.peak)} km/week; overweeg je ambitie of tijdlijn bij te stellen.
                    </p>
                  )}
                  {info && !info.manualOverride && !info.ambitious && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Automatisch berekend piekvolume: ~{Math.round(info.peak)} km/week, gebaseerd op je wedstrijdafstand.</p>
                  )}
                  {info && info.manualOverride && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Je eigen piekvolume wordt gebruikt vanaf de volgende gegenereerde week.</p>
                  )}
                </div>
              );
            })}

            <h3 style={{ fontSize: 15, marginTop: 14, marginBottom: 2 }}>Traindagen</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Standaard traindag(en) per sport — kies er één of meerdere. Nieuw gegenereerde weken houden hier rekening mee.</p>
            {['zwemmen', 'fietsen', 'hardlopen', 'kracht'].map((d) => {
              const meta = DISCIPLINE_META[d];
              const selected = defaultDays[d] || [];
              return (
                <div className="tri-field" key={d}>
                  <label className="tri-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <meta.icon size={14} color={meta.color} /> {meta.label}
                  </label>
                  <div className="tri-daytab">
                    {DAYS.map((label, idx) => {
                      const isSel = selected.includes(idx);
                      return (
                        <button key={idx} className="tri-choice" style={{
                          padding: '8px 12px', fontSize: 13,
                          borderColor: isSel ? 'var(--terracotta)' : undefined,
                          background: isSel ? '#FDEEE4' : undefined,
                          color: isSel ? 'var(--terracotta)' : undefined,
                        }}
                          onClick={() => setDefaultDays((dd) => {
                            const cur = dd[d] || [];
                            const next = isSel ? cur.filter((x) => x !== idx) : [...cur, idx].sort((a, b) => a - b);
                            return { ...dd, [d]: next };
                          })}>{label}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Kiezen twee sporten dezelfde dag? Dan krijgt de sport die het eerst in het schema staat voorrang; de andere schuift automatisch naar een vrije dag.</p>

            <HolidayPanel />

            <div style={{ borderTop: '1px solid var(--sand)', marginTop: 10, paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: syncStatus === 'saving' ? 'var(--warning)' : syncStatus === 'error' ? 'var(--danger)' : syncStatus === 'local-only' ? 'var(--muted)' : 'var(--success)',
                }} />
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {syncStatus === 'saving' ? 'Bezig met synchroniseren met Google Sheets…'
                    : syncStatus === 'error' ? 'Synchroniseren mislukt — data blijft wel lokaal bewaard'
                    : syncStatus === 'local-only' ? 'Geen Google Sheets gekoppeld — data blijft op dit apparaat'
                    : 'Gesynchroniseerd met je Google Spreadsheet'}
                </span>
              </div>
              {syncStatus === 'local-only' && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>
                  Koppel een Google Spreadsheet via VITE_SHEETS_API_URL (zie README.md) om je plan ook op andere apparaten te gebruiken.
                </p>
              )}
              <button className="tri-btn tri-btn-block" style={{ background: '#F7DAD3', color: 'var(--danger)' }} onClick={() => { if (window.confirm('Alle doelen, schema’s en resultaten verwijderen? Dit kan niet ongedaan gemaakt worden.')) resetAllData(); }}>
                <Trash2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Alle data wissen
              </button>
            </div>

            <ImportPanel />

            <button className="tri-btn tri-btn-primary tri-btn-block" style={{ marginTop: 10 }} onClick={() => setShowSettings(false)}>Klaar</button>
          </div>
        </div>
      )}
    </div>
  );
}
