import fetch from 'node-fetch';
import moment from 'moment';
import { render } from '#xhh';
import { Character } from '../../miao-plugin/models/index.js';

const MANIFEST_URL = 'https://static.nanoka.cc/manifest.json';
const ELEMENT_MAP = {
  2: 'pyro', 3: 'hydro', 4: 'dendro', 5: 'electro', 6: 'cryo', 7: 'anemo', 8: 'geo',
  Fire: 'pyro', Water: 'hydro', Grass: 'dendro', Elec: 'electro', Ice: 'cryo', Wind: 'anemo', Rock: 'geo',
};
const ELEMENT_CN = { pyro: '火', hydro: '水', dendro: '草', electro: '雷', cryo: '冰', anemo: '风', geo: '岩' };
const ELEMENT_CLASS = { pyro: 'pyro', hydro: 'hydro', dendro: 'dendro', electro: 'electro', cryo: 'cryo', anemo: 'anemo', geo: 'geo' };
const START_MONTH = { year: 2024, month: 7 };

function monthToIndex(yyyymm) {
  const y = Math.floor(Number(yyyymm) / 100);
  const m = Number(yyyymm) % 100;
  return (y * 12 + m) - (START_MONTH.year * 12 + START_MONTH.month);
}

function indexToMonth(idx) {
  const total = START_MONTH.year * 12 + START_MONTH.month + idx;
  const y = Math.floor((total - 1) / 12);
  const m = ((total - 1) % 12) + 1;
  return `${y}${String(m).padStart(2, '0')}`;
}

function parseMonth(msg = '') {
  const raw = String(msg || '');
  let m = raw.match(/(20\d{2})(?:[-/.年]?)(0?[1-9]|1[0-2])(?:月)?/);
  if (m) return `${m[1]}${String(Number(m[2])).padStart(2, '0')}`;
  m = raw.match(/20\d{4}/);
  if (m) return m[0];
  return moment().format('YYYYMM');
}

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function charById(id) {
  const char = Character.get(Number(id));
  if (!char) return null;
  return {
    id: char.id,
    name: char.name,
    elem: char.elem,
    elemName: ELEMENT_CN[char.elem] || '',
    elemClass: ELEMENT_CLASS[char.elem] || '',
    star: char.star || 4,
    face: char.face ? `file://${process.cwd()}/plugins/miao-plugin/resources${char.face}` : '',
  };
}

function uniqById(list = []) {
  const map = new Map();
  for (const item of list) if (item?.id && !map.has(item.id)) map.set(item.id, item);
  return [...map.values()];
}

function extractCharacters(raw = {}) {
  const cfg = raw.avatar_config || raw.AvatarConfig || {};
  const openingIds = (cfg.buff_avatar_list || cfg.BuffAvatarList || []).map(v => Number(v.id || v.Id || v) + (Number(v.id || v.Id || v) < 10000000 ? 10000000 : 0));
  const inviteIds = (cfg.invite_avatar_list || cfg.InviteAvatarList || []).map(v => Number(v.id || v.Id || v) + (Number(v.id || v.Id || v) < 10000000 ? 10000000 : 0));
  const elements = (cfg.element_list || cfg.ElementList || []).map(v => ELEMENT_MAP[v]).filter(Boolean);
  const opening = uniqById(openingIds.map(charById).filter(Boolean));
  const invite = uniqById(inviteIds.map(charById).filter(Boolean));
  const inviteSet = new Set(invite.map(v => v.id));
  const available = [];
  Character.forEach(char => {
    if (!char?.isRelease || char.game !== 'gs') return true;
    if ([10000005, 10000007].includes(Number(char.id))) return true;
    if (elements.includes(char.elem) || inviteSet.has(char.id)) available.push(charById(char.id));
    return true;
  }, 'release', 'gs');
  return { elements: [...new Set(elements)], opening, invite, available: uniqById(available) };
}

function extractMonsters(raw = {}) {
  const diff = raw.difficulty_config || raw.DifficultyConfig || {};
  const last = Object.values(diff).at(-1) || {};
  const pairs = [
    ['第三幕', last.room?.['3'] || last.Room?.['3']],
    ['第六幕', last.room?.['6'] || last.Room?.['6']],
    ['第八幕', last.room?.['8'] || last.Room?.['8']],
    ['第十幕', last.room?.['10'] || last.Room?.['10']],
    ['圣牌挑战 I', last.hard_room?.['4']],
    ['圣牌挑战 II', last.hard_room?.['7']],
  ];
  return pairs.map(([stage, room]) => {
    const names = (room?.monster_preview_list || room?.MonsterPreviewList || []).map(v => v.name || v.Name).filter(Boolean);
    return names.length ? { stage, names } : null;
  }).filter(Boolean);
}

async function loadRoleCombat(month) {
  const manifest = await fetchJson(MANIFEST_URL);
  const version = manifest?.gi?.latest;
  if (!version) throw new Error('Nanoka manifest 未返回原神版本');
  const overall = await fetchJson(`https://static.nanoka.cc/gi/${version}/rolecombat.json`);
  const count = Object.keys(overall || {}).length;
  const minMonth = indexToMonth(0);
  const maxMonth = indexToMonth(count - 1);
  let idx = monthToIndex(month);
  let usedMonth = month;
  let fallback = false;
  if (idx < 0 || idx >= count) {
    idx = count - 1;
    usedMonth = maxMonth;
    fallback = true;
  }
  const raw = await fetchJson(`https://static.nanoka.cc/gi/${version}/zh/rolecombat/${idx + 3}.json`);
  return { version, minMonth, maxMonth, month: usedMonth, requestedMonth: month, fallback, raw };
}

export class role_combat extends plugin {
  constructor() {
    super({
      name: '[小花火]幻想真境剧诗',
      dsc: '原神幻想真境剧诗当期可用角色',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#*(原神)?(幻想|剧诗|幻想真境|幻想真境剧诗|幻想剧诗)(角色|可用角色|当期角色|本期角色|查询)?(20\\d{4}|20\\d{2}[-/.年]?\\d{1,2}月?)?$', fnc: 'roleCombat' },
      ],
    });
  }

  async roleCombat(e) {
    await e.reply('正在获取幻想真境剧诗数据，请稍后...', true);
    const requestedMonth = parseMonth(e.msg || '');
    let payload;
    try {
      payload = await loadRoleCombat(requestedMonth);
    } catch (err) {
      logger.error('[xhh][role_combat] 获取Nanoka数据失败:', err);
      return e.reply(`幻想真境剧诗数据获取失败：${err.message || err}`);
    }
    const data = extractCharacters(payload.raw);
    const monsters = extractMonsters(payload.raw);
    if (!data.elements.length || !data.opening.length || !data.invite.length) {
      return e.reply('本期幻想真境剧诗数据不完整，请稍后再试或更换数据源。');
    }
    const img = await render('role_combat/role_combat', {
      ...data,
      monsters,
      month: `${payload.month.slice(0, 4)}-${payload.month.slice(4)}`,
      requestedMonth: `${payload.requestedMonth.slice(0, 4)}-${payload.requestedMonth.slice(4)}`,
      range: `${payload.minMonth} - ${payload.maxMonth}`,
      version: payload.version,
      fallback: payload.fallback,
      generatedAt: moment().format('MM-DD HH:mm'),
    }, { e, ret: true, pct: 1.6 });
    return e.reply(img);
  }
}
