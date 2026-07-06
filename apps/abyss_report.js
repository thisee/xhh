import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import _ from 'lodash';
import moment from 'moment';
import { render, config, pluginPriority } from '#xhh';

const MANIFEST_URL = 'https://static.nanoka.cc/manifest.json';
const DEFAULT_REPOS = [
  'https://cnb.cool/JIUXJIU/Abyss/-/git/raw/main',
  'https://cnb.cool/JIUXJIU/AbyssBeta/-/git/raw/main',
];

const ALIASES = {
  gs: {
    '深境螺旋': ['深渊', '深境', '螺旋', '深渊速报', '当前深渊'],
    '幻想真境剧诗': ['幻想', '真境', '剧诗', '幻想剧诗', '幻想真境'],
    '幽境危战': ['幽境', '危战'],
  },
  sr: {
    '混沌回忆': ['混沌', '回忆', '深渊', '混沌速报', '深渊速报'],
    '虚构叙事': ['虚构', '叙事', '构事', '虚构速报'],
    '末日幻影': ['末日', '幻影', '末影', '末日速报'],
    '异相仲裁': ['异相', '仲裁', '王棋'],
  },
};

const SR_VERSION_MAP = {
  '混沌回忆': { '1.3': ['1001', '1002', '1003'], '1.4': ['1004', '1005', '1006'], '1.5': ['1007', '1008'], '1.6': ['1009', '1010'], '2.0': ['1011'], '2.1': ['1013'], '2.7': ['1020'], '3.0': ['1021'], '3.8': ['1029'], '4.0': ['1030'] },
  '虚构叙事': { '1.6': ['2003'], '2.0': ['2004'], '2.7': ['2011'], '3.0': ['2012'], '3.8': ['2020'], '4.0': ['2021'] },
  '末日幻影': { '2.7': ['3005'], '3.0': ['3006'], '3.8': ['3014'], '4.0': ['3015'] },
};

const TYPE_CLASS = {
  '深境螺旋': 'spiral',
  '幻想真境剧诗': 'theater',
  '幽境危战': 'war',
  '混沌回忆': 'chaos',
  '虚构叙事': 'fiction',
  '末日幻影': 'apoc',
  '异相仲裁': 'arbitration',
};

const CACHE_DIR = path.join(process.cwd(), 'data', 'xhh_abyss_report');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stripHtml(text = '') {
  return String(text || '')
    .replace(/<color=[^>]+>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function repoList() {
  const raw = config().abyss_report_repos;
  const list = String(raw || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_REPOS;
}

async function fetchJson(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 xhh' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function currentVersion(game) {
  const cfg = config();
  const fallback = game === 'sr' ? '4.3' : '6.7';
  const cfgVer = game === 'sr' ? cfg.abyss_report_sr_version : cfg.abyss_report_gs_version;
  if (cfgVer) return String(cfgVer);
  try {
    const manifest = await fetchJson(MANIFEST_URL, 6000);
    const live = game === 'sr' ? manifest?.hsr?.live : manifest?.gi?.live;
    if (live) return String(live);
  } catch (err) {
    logger.warn(`[xhh][abyss_report] Nanoka manifest 获取失败: ${err.message}`);
  }
  return fallback;
}

function formalType(input, game) {
  const table = ALIASES[game] || {};
  for (const [name, arr] of Object.entries(table)) {
    if (input === name || arr.includes(input)) return name;
  }
  return game === 'sr' ? '混沌回忆' : '深境螺旋';
}

function allAliasReg() {
  const list = Object.values(ALIASES).flatMap(obj => Object.entries(obj).flatMap(([k, v]) => [k, ...v]));
  return Array.from(new Set(list)).map(_.escapeRegExp).join('|');
}

function parseMsg(msg = '') {
  const raw = String(msg || '').replace(/^#+/, '').trim();
  const version = raw.match(/([1-9]\.[0-9]{1,2})/)?.[1];
  let game = /星铁|星穹|崩铁|SR|HSR/i.test(raw) ? 'sr' : 'gs';
  const aliases = allAliasReg();
  const typeText = raw.match(new RegExp(`(${aliases})`))?.[1];
  let type = formalType(typeText, game);
  if (['混沌回忆', '虚构叙事', '末日幻影', '异相仲裁'].includes(type)) game = 'sr';
  if (['深境螺旋', '幻想真境剧诗', '幽境危战'].includes(type)) game = 'gs';
  if (!typeText && game === 'sr') type = '混沌回忆';
  if (!typeText && game === 'gs') type = '深境螺旋';
  return { game, version, type };
}

function imageNumbers(game, version, type) {
  if (game === 'gs') {
    if (type === '深境螺旋' || type === '幻想真境剧诗') return [version, `${version}A`, `${version}B`];
    return [version];
  }
  if (type === '异相仲裁') return [version];
  const mapped = SR_VERSION_MAP[type]?.[version];
  if (mapped) return mapped;
  const base = { '混沌回忆': 1030, '虚构叙事': 2021, '末日幻影': 3015 }[type];
  if (!base) return [version];
  const [a, b] = version.split('.').map(Number);
  return [String(base + (a - 4) * 10 + b)];
}

async function downloadImage(type, number) {
  ensureDir(CACHE_DIR);
  const safe = `${type}_${number}`.replace(/[\\/:*?"<>|]/g, '_');
  const local = path.join(CACHE_DIR, `${safe}.png`);
  if (fs.existsSync(local) && fs.statSync(local).size > 1024) return local;
  for (const repo of repoList()) {
    const url = `${repo.replace(/\/$/, '')}/${encodeURIComponent(type)}/${number}.png`.replace(/%2F/g, '/');
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 xhh' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) continue;
      fs.writeFileSync(local, buf);
      return local;
    } catch (err) {
      logger.warn(`[xhh][abyss_report] 下载失败 ${url}: ${err.message}`);
    }
  }
  return '';
}

async function loadGsBlessing(version) {
  try {
    const manifest = await fetchJson(MANIFEST_URL, 6000);
    const nv = manifest?.gi?.latest || version;
    const data = await fetchJson(`https://static.nanoka.cc/gi/${nv}/tower.json`, 8000);
    const now = moment();
    const rows = Object.values(data || {}).filter(v => v?.zh || v?.desc);
    const active = rows.find(v => v.begin && v.end && now.isBetween(moment(v.begin), moment(v.end), undefined, '[)')) || rows.at(-1);
    if (!active) return null;
    return {
      title: active.zh || active.en || '深渊祝福',
      desc: stripHtml(active.desc || active.zh || ''),
      begin: active.begin || '',
      end: active.end || '',
      version: nv,
    };
  } catch (err) {
    logger.warn(`[xhh][abyss_report] 原神 tower 数据获取失败: ${err.message}`);
    return null;
  }
}

export class abyss_report extends plugin {
  constructor() {
    super({
      name: '[小花火]原神星铁深渊速报',
      dsc: '原神/星铁版本深渊速报图',
      event: 'message',
      priority: pluginPriority('abyss_report', 100),
      rule: [
        { reg: `^#*(原神|星铁|星穹|崩铁)?([1-9]\\.[0-9]{1,2})(${allAliasReg()})$`, fnc: 'report' },
        { reg: `^#*(原神|星铁|星穹|崩铁)?(${allAliasReg()})(速报|攻略|查询|信息|图)$`, fnc: 'report' },
        { reg: '^#*(原神|星铁|星穹|崩铁)?(深渊速报|当前深渊|深渊)$', fnc: 'report' },
      ],
    });
  }

  async report(e) {
    const req = parseMsg(e.msg || '');
    const version = req.version || await currentVersion(req.game);
    const numbers = imageNumbers(req.game, version, req.type);
    await e.reply(`正在获取${req.game === 'sr' ? '星铁' : '原神'} ${version} ${req.type}速报，请稍后...`, true);

    const images = [];
    for (const num of numbers) {
      const img = await downloadImage(req.type, num);
      if (img) images.push({ num, path: img });
    }
    const blessing = req.game === 'gs' && req.type === '深境螺旋' ? await loadGsBlessing(version) : null;
    const data = {
      gameName: req.game === 'sr' ? '崩坏：星穹铁道' : '原神',
      gameShort: req.game === 'sr' ? 'STAR RAIL' : 'GENSHIN IMPACT',
      version,
      type: req.type,
      typeClass: TYPE_CLASS[req.type] || 'spiral',
      imageCount: images.length,
      imageNums: images.map(v => v.num).join(' / ') || '暂无',
      blessing,
      source: images.length ? 'Abyss Repo / Nanoka' : 'Nanoka / 小花火',
      generatedAt: moment().format('MM-DD HH:mm'),
    };
    const card = await render('abyss_report/report', data, { e, pct: 1.55 });
    const msg = [card, ...images.map(v => segment.image(`file://${v.path}`))];
    if (!images.length) msg.push(`暂无 ${data.gameName} ${version} ${req.type} 速报图片。可以稍后再试，或在锅巴里调整“深渊速报图片仓库”。`);
    return e.reply(msg);
  }
}
