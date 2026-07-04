import { makeForwardMsg, render, yaml } from '#xhh';
import fs from 'fs';
import { bh3_gacha } from './bh3_gacha.js';
import officialPool from '../system/gacha_pool_official.js';

const ZZZ_HISTORY_URL = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/data/zzz/history.json';
const ZZZ_META_URL = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/data/meta.json';
const ZZZ_RAW_BASE = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/';
const ZZZ_CACHE_KEY = 'xhh:zzz:pool_history:data:v2';
const ZZZ_CACHE_EXPIRE_KEY = 'xhh:zzz:pool_history:expire:v2';
const ZZZ_POOL_HISTORY_YAML_PATH = './plugins/xhh/system/default/zzz_gacha_pool_history.yaml';
const GS_POOL_HISTORY_YAML_PATH = './plugins/xhh/system/default/gslogs.yaml';
const SR_POOL_HISTORY_YAML_PATH = './plugins/xhh/system/default/sr_logs.yaml';
const BH3_POOL_HISTORY_YAML_PATH = './plugins/xhh/system/default/bh3_gacha_pool_history.yaml';
const BH3_POOL_HISTORY_PATH = './plugins/xhh/system/default/bh3_gacha_pool_history.json';
const BH3_MARK_ICON = 'bh3_note/bh3_pool_banner.png';
const ZZZ_MARK_ICON = 'zzz_md/imgs/ellen.png';
const GS_MARK_ICON = 'gs_mark/paimon.png';
const SR_MARK_ICON = '/root/TRSS_AllBot/TRSS-Yunzai/plugins/miao-plugin/resources/meta-sr/character/三月七/imgs/splash.webp';
const MYS_MARK_ICON = 'gacha_pool/mys.png';
const CURRENT_VERSION = { gs: '6.7', sr: '4.3', zzz: '3.0', bh3: '8.9' };

export class xhh_gacha_pool extends plugin {
  constructor(e) {
    super({
      name: '[小花火]全游戏卡池',
      dsc: '原神/星铁/绝区零/崩三卡池查询',
      event: 'message',
      // Yunzai 的优先级数值越小越先执行；卡池命令容易被 gs_logs/mora 等宽泛规则抢走，
      // 这里放到极前面，先让统一卡池图片接管；未命中的再交给历史卡池兜底。
      priority: -1000000000,
      rule: [
        // 最常用的原神当前卡池放最前，使用最简单正则，避免被通用“xx卡池”规则误判。
        { reg: '^#?原神卡池$', fnc: 'gsCurrentPool' },
        { reg: '^#?原神(当前|本期|当期)卡池$', fnc: 'gsCurrentPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)(当前|本期|当期)?(卡池|补给)$', fnc: 'bh3CurrentPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)v?(\\d+\\.\\d+)(上半|下半)?(卡池|补给)$', fnc: 'bh3VersionPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)(卡池|补给)(统计|记录|历史|全)$', fnc: 'bh3AllPool' },
        // 原神卡池
        { reg: '^[#＃井]*\\s*(?:小花火)?\\s*原神\\s*(?:当前|本期|当期)?\\s*卡池$', fnc: 'gsCurrentPool' },
        { reg: '^[#＃井]*\\s*(?:小花火)?\\s*原神\\s*v?(\\d+\\.\\d+)\\s*(上半|下半)?\\s*卡池$', fnc: 'gsVersionPool' },
        { reg: '^#*(小花火)?原神(?!官方|米游社)(.+)卡池$', fnc: 'gsNameHistory' },
        { reg: '^#*(小花火)?原神(卡池)(统计|记录|历史|全)$', fnc: 'gsAllPool' },
        // 星铁卡池
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)(当前|本期|当期)?(卡池|跃迁)$', fnc: 'srCurrentPool' },
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)v?(\\d+\\.\\d+)(上半|下半)?(卡池|跃迁)$', fnc: 'srVersionPool' },
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)(?!v?\\d+\\.\\d+)(?!官方|米游社)(.+)(卡池|跃迁)$', fnc: 'srNameHistory' },
        // 官方/米游社卡池必须在 bh3NameHistory 之前，否则"崩三官方卡池"会被误判为角色名
        { reg: '^#*(小花火)?((原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3))?(米游社|官方)?(更新|刷新)卡池(数据)?$', fnc: 'refreshOfficialPools' },
        { reg: '^#*(小花火)?(原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3)?(米游社|官方)(当前|本期|当期)?卡池$', fnc: 'officialCurrentPool' },
        { reg: '^#*(小花火)?(原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3)(\\d+\\.\\d+)(米游社|官方)卡池$', fnc: 'officialVersionPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)(?!v?\\d+\\.\\d+)(?!官方|米游社)(.+)(卡池|补给)$', fnc: 'bh3NameHistory' },
        { reg: '^#*(小花火)?(绝区零|ZZZ)(当前|本期|当期)?卡池$', fnc: 'zzzCurrentPool' },
        { reg: '^#*(小花火)?(绝区零|ZZZ)v?(\\d+\\.\\d+)(上半|下半)?卡池$', fnc: 'zzzVersionPool' },
        { reg: '^#*(小花火)?(绝区零|ZZZ)(?!v?\\d+\\.\\d+)(.+)卡池$', fnc: 'zzzNameHistory' },
        { reg: '^#*(小花火)?(绝区零|ZZZ)(.+)(卡池|复刻)(统计|记录|历史)$', fnc: 'zzzNameHistory' },
        { reg: '^#*(小花火)?(绝区零|ZZZ)(卡池|复刻)(统计|记录|历史)$', fnc: 'zzzAllPool' },
        // 类似"雷神卡池/德莉莎卡池/白厄卡池"的用法：依次查绝区零、崩三、星铁、原神
        { reg: '^(?!#*(?:小花火)?(?:原神|星铁|崩铁|崩三|崩坏3|崩坏三|BH3|绝区零|ZZZ))#*(小花火)?(.+)(卡池|复刻)(统计|记录|历史)?$', fnc: 'genericNameHistory' }
      ]
    });
  }

  async accept(e) {
    const msg = String(e?.msg || '')
      .replace(/[\u200b-\u200f\ufeff]/g, '')
      .replace(/[＃井]/g, '#')
      .replace(/\s+/g, '');
    // 有些插件/适配器会在规则前抢“原神卡池”，这里用 accept 兜底优先接管当前卡池。
    if (/^(?:[#＃井]*\s*)?(?:小花火)?\s*原神\s*(?:当前|本期|当期)?\s*卡池$/.test(msg)) {
      e.msg = msg;
      await this.gsCurrentPool(e);
      return 'return';
    }
    // 兜底优先接管“原神官方卡池/星铁官方卡池”等指定游戏官方卡池。
    // 部分环境下进入 rule 后 e.msg 可能只剩“#官方卡池”，这里在 accept 阶段保留完整命令。
    if (/^#*(?:小花火)?(?:原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3)(?:米游社|官方)(?:当前|本期|当期)?卡池$/i.test(msg)) {
      e.msg = msg;
      await this.officialCurrentPool(e);
      return 'return';
    }
    return false;
  }

  parseTime(pool = {}) {
    const start = pool.startTime ? new Date(pool.startTime) : null;
    const end = pool.endTime ? new Date(pool.endTime) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { start: null, end: null };
    return { start, end };
  }

  normalizeZzzData(raw = []) {
    const data = Array.isArray(raw) ? [...raw] : [];
    if (!data.some(v => v.version === '1.0上半')) {
      data.push({
        img: 'https://patchwiki.biligame.com/images/zzz/thumb/7/7f/8pesvtvchbs3t2jhqjhckd9k08pe7ui.png/900px-%E7%8B%AC%E5%AE%B6%E9%A2%91%E6%AE%B5001%E6%9C%9F.png',
        title: '「慵懒逐浪」001期独家频段', type: '角色', version: '1.0上半',
        timer: '2024/07/04 10:00:00 ~ 2024/07/24 11:59:59', s: '艾莲', a: ['安东', '苍角']
      }, {
        img: 'https://patchwiki.biligame.com/images/zzz/thumb/3/32/gs2uajlo6v2h6pljzij84wdiwhu9fkj.png/900px-%E9%9F%B3%E6%93%8E%E9%A2%91%E6%AE%B5001%E6%9C%9F.png',
        title: '「喧哗奏鸣」001期音擎频段', type: '武器', version: '1.0上半',
        timer: '2024/07/04 10:00:00 ~ 2024/07/24 11:59:59', s: '深海访客', a: ['含羞恶面', '旋钻机-赤轴']
      });
    }
    if (!data.some(v => v.version === '3.0上半')) {
      data.push({
        img: '', title: '「凛风仪」独家频段', type: '角色', version: '3.0上半',
        timer: '2026/06/17 10:00:00 ~ 2026/07/08 11:59:59', s: '维琳娜', a: ['妮可', '派派']
      }, {
        img: '', title: '「云霓孤光」独家频段', type: '角色', version: '3.0上半',
        timer: '2026/06/17 10:00:00 ~ 2026/07/08 11:59:59', s: '叶瞬光', a: ['妮可', '派派']
      }, {
        img: '', title: '「云霓孤光」音擎频段', type: '武器', version: '3.0上半',
        timer: '2026/06/17 10:00:00 ~ 2026/07/08 11:59:59', s: '云霓孤光', a: ['含羞恶面', '好斗的阿炮']
      });
    }
    if (!data.some(v => v.version === '3.0下半')) {
      data.push({
        img: '', title: '「天才不等式」独家频段', type: '角色', version: '3.0下半',
        timer: '2026/07/08 10:00:00 ~ 2026/07/28 11:59:59', s: '诺姆', a: ['波可娜', '本']
      }, {
        img: '', title: '「四三拍想」独家频段', type: '角色', version: '3.0下半',
        timer: '2026/07/08 10:00:00 ~ 2026/07/28 11:59:59', s: '千夏', a: ['波可娜', '本']
      }, {
        img: '', title: '「首席跟班」音擎频段', type: '武器', version: '3.0下半',
        timer: '2026/07/08 10:00:00 ~ 2026/07/28 11:59:59', s: '首席跟班', a: ['含羞恶面', '好斗的阿炮']
      }, {
        img: '', title: '「思络成歌」音擎频段', type: '武器', version: '3.0下半',
        timer: '2026/07/08 10:00:00 ~ 2026/07/28 11:59:59', s: '思络成歌', a: ['含羞恶面', '好斗的阿炮']
      });
    }
    for (const pool of data) {
      if (pool?.version === '3.0上半' && (pool.s === '光于指尖' || /光于指尖/.test(pool.title || ''))) {
        pool.title = '「云霓孤光」音擎频段';
        pool.s = '云霓孤光';
      }
    }
    data.sort((a, b) => this.poolEndStamp(a) - this.poolEndStamp(b));
    for (let i = 0; i < data.length; i++) {
      const pool = data[i];
      if (!pool.timer) continue;
      if (pool.timer.startsWith('公测开启后')) {
        const end = pool.timer.split('~')[1]?.trim();
        pool.startTime = '2024/07/04 10:00:00';
        pool.endTime = end;
      } else if (pool.timer.includes('版本更新后')) {
        const end = pool.timer.split('~')[1]?.trim();
        const prev = [...data].slice(0, i).reverse().find(v => this.poolEndStamp(v) > 0 && this.poolEndStamp(v) < this.poolEndStamp(pool));
        const d = prev ? new Date(this.poolEndStamp(prev)) : null;
        if (d) {
          d.setDate(d.getDate() + 1);
          pool.startTime = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 11:00:00`;
          pool.endTime = end;
        }
      } else {
        const [start, end] = pool.timer.split('~').map(v => v?.trim());
        pool.startTime = start;
        pool.endTime = end;
      }
      if (pool.startTime && pool.endTime) pool.timer = `${pool.startTime} ~ ${pool.endTime}`;
    }
    return data;
  }

  nextZzzStage(version = '') {
    const m = String(version).match(/^(\d+)\.(\d+)(上半|下半)$/);
    if (!m) return '';
    const major = Number(m[1]);
    const minor = Number(m[2]);
    return m[3] === '上半' ? `${major}.${minor}下半` : `${major}.${minor + 1}上半`;
  }

  normalizeZzzCurrentPools(raw = [], history = []) {
    if (!Array.isArray(raw) || !raw.length) return [];
    const latest = [...history].sort((a, b) => this.poolEndStamp(b) - this.poolEndStamp(a))[0];
    const version = this.nextZzzStage(latest?.version) || '最新';
    return raw.map(pool => {
      const gachas = Array.isArray(pool.gachas) ? pool.gachas : [];
      const [start, end] = Array.isArray(pool.timer) ? pool.timer : String(pool.timer || '').split('~').map(v => v.trim());
      return {
        // meta 当前池只有角色/音擎小图，patchwiki 的 112px 缩略图经常被 OneBot 下载判 404。
        // 这里不直接发送小图，避免整条消息发送失败；历史池仍保留 900px 大图。
        img: pool.img || '',
        title: pool.title || '',
        type: pool.type || '角色',
        version,
        timer: start && end ? `${start} ~ ${end}` : '',
        startTime: start,
        endTime: end,
        s: gachas[0]?.title || pool.s || '',
        a: gachas.slice(1).map(v => v.title).filter(Boolean)
      };
    }).filter(v => v.s);
  }

  loadGsPoolHistory() {
    return yaml.get(GS_POOL_HISTORY_YAML_PATH);
  }

  loadSrPoolHistory() {
    return yaml.get(SR_POOL_HISTORY_YAML_PATH);
  }

  loadZzzLocalPools() {
    try {
      if (!fs.existsSync(ZZZ_POOL_HISTORY_YAML_PATH)) return [];
      const data = yaml.get(ZZZ_POOL_HISTORY_YAML_PATH);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.pools)) return data.pools;
      return [];
    } catch (err) {
      logger.warn('[xhh][gacha_pool] 绝区零本地卡池YAML加载失败:', err);
      return [];
    }
  }

  mergeZzzLocalPools(remote = []) {
    const data = Array.isArray(remote) ? [...remote] : [];
    for (const pool of data) {
      if (pool?.version === '3.0上半' && (pool.s === '光于指尖' || /光于指尖/.test(pool.title || ''))) {
        pool.title = '「云霓孤光」音擎频段';
        pool.s = '云霓孤光';
      }
    }
    const local = this.loadZzzLocalPools().map(pool => {
      const item = { ...pool };
      if (item.timer) {
        const [start, end] = String(item.timer).split('~').map(v => v?.trim());
        item.startTime = item.startTime || start;
        item.endTime = item.endTime || end;
        if (item.startTime && item.endTime) item.timer = `${item.startTime} ~ ${item.endTime}`;
      }
      return item;
    }).filter(v => v.s && v.version);
    if (!local.length) return data;
    const keyOf = pool => `${pool.version || '-'}|${pool.type || '-'}|${pool.s || '-'}|${pool.title || ''}`;
    const map = new Map(data.map(pool => [keyOf(pool), pool]));
    for (const pool of local) map.set(keyOf(pool), pool);
    return [...map.values()].sort((a, b) => this.poolEndStamp(a) - this.poolEndStamp(b));
  }

  async fetchZzzCurrentAppend(history = []) {
    try {
      const meta = await fetch(ZZZ_META_URL, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
      if (!meta?.zzz) return [];
      const raw = await fetch(`${ZZZ_RAW_BASE}${meta.zzz}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
      return this.normalizeZzzCurrentPools(raw, history);
    } catch (err) {
      logger.warn('[xhh][gacha_pool] 绝区零当前卡池附加数据获取失败:', err);
      return [];
    }
  }

  poolEndStamp(pool = {}) {
    const text = pool.endTime || pool.timer?.split('~')[1]?.trim() || '';
    const t = new Date(text).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  async fetchZzzPools() {
    const valid = await redis.get(ZZZ_CACHE_EXPIRE_KEY);
    if (valid) {
      const cache = await redis.get(ZZZ_CACHE_KEY);
      if (cache) return this.mergeZzzLocalPools(JSON.parse(cache));
      await redis.del(ZZZ_CACHE_EXPIRE_KEY);
    }
    try {
      const res = await fetch(ZZZ_HISTORY_URL, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = this.mergeZzzLocalPools(this.normalizeZzzData(await res.json()));
      const extra = await this.fetchZzzCurrentAppend(data);
      for (const pool of extra) {
        const key = `${pool.title}:${pool.timer}:${pool.s}`;
        if (!data.some(v => `${v.title}:${v.timer}:${v.s}` === key)) data.push(pool);
      }
      data.sort((a, b) => this.poolEndStamp(a) - this.poolEndStamp(b));
      await redis.set(ZZZ_CACHE_KEY, JSON.stringify(data));
      await redis.set(ZZZ_CACHE_EXPIRE_KEY, '1', { EX: 24 * 60 * 60 });
      return data;
    } catch (err) {
      const cache = await redis.get(ZZZ_CACHE_KEY);
      if (cache) return this.mergeZzzLocalPools(JSON.parse(cache));
      logger.error('[xhh][gacha_pool] 绝区零卡池数据获取失败:', err);
      const local = this.mergeZzzLocalPools([]);
      return local.length ? local : null;
    }
  }

  formatPoolLine(pool) {
    const a = Array.isArray(pool.a) ? pool.a.join('，') : (pool.a || '-');
    const type = pool.type === '武器' ? '音擎' : '角色';
    return `◈ ${type}：S-${pool.s || '-'} | A-${a}`;
  }

  poolTypeName(pool = {}) {
    return pool.type === '武器' ? '音擎频段' : '代理人频段';
  }

  poolToCard(pool = {}) {
    return {
      version: pool.version || '-',
      title: pool.title || this.poolTypeName(pool),
      type: this.poolTypeName(pool),
      time: this.zzzPoolTime(pool),
      s: pool.s || '-',
      a: Array.isArray(pool.a) ? pool.a.join(' / ') : (pool.a || '-'),
      img: pool.img || '',
      weapon: pool.type === '武器'
    };
  }

  gameMarkIcon(game = '') {
    if (game === '原神') return GS_MARK_ICON;
    if (game === '星穹铁道') return SR_MARK_ICON;
    if (game === '绝区零') return ZZZ_MARK_ICON;
    if (game === '崩坏3') return BH3_MARK_ICON;
    if (game === '米游社') return MYS_MARK_ICON;
    return '';
  }

  randomPick(list = []) {
    const arr = (Array.isArray(list) ? list : []).filter(Boolean);
    if (!arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  shuffleList(list = []) {
    const arr = [...(Array.isArray(list) ? list : [])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async renderPoolImage(e, data) {
    if (Array.isArray(data?.cards) && data.mode !== 'gs-history') {
      data.cards.forEach((card, i) => {
        if (!card.index) card.index = i + 1;
      });
    }
    if (!data.markIcon) {
      const mark = this.gameMarkIcon(data?.game);
      if (mark) {
        data.markIcon = mark;
        data.markWide = data.game === '原神' || data.game === '崩坏3';
      }
    }
    return render('gacha_pool/pool', data, { e, ret: true });
  }

  async renderSrLogs(e, data, query = '') {
    // 星铁也统一走新的“版本 + 时间 + UP头像行”样式，避免特定角色卡池还显示原版大卡片。
    const sections = this.buildSrHistorySections(data, query);
    let splash = '/root/TRSS_AllBot/TRSS-Yunzai/plugins/miao-plugin/resources/meta-sr/character/三月七/imgs/splash.webp';
    const hitName = query ? this.normalizeSrName(query) : '';
    if (hitName) {
      const roleSplash = this.getMiaoProfileImage(hitName) || this.getSrCharacterSplash(hitName);
      if (roleSplash) splash = roleSplash;
    }
    return render('gslogs/logs', { data: sections, splash }, { e, ret: true });
  }

  async renderGsLogs(e, sections) {
    let charName = '';
    for (const s of sections) {
      for (const row of s.rows || []) {
        for (const item of row.items || []) {
          if (item.highlight) { charName = item.name; break; }
        }
        if (charName) break;
      }
      if (charName) break;
    }
    let splash = '';
    if (charName) {
      for (const ext of ['.webp', '.png', '.jpg']) {
        const p = `./plugins/xhh/resources/gslogs/imgs/${charName}${ext}`;
        if (fs.existsSync(p)) { splash = `gslogs/imgs/${charName}${ext}`; break; }
      }
      if (!splash) {
        splash = this.getMiaoProfileImage(charName);
      }
    }
    return render('gslogs/logs', { data: sections, splash }, { e, ret: true });
  }

  async renderZzzLogs(e, sections, query = '') {
    // 优先使用 ZZZ-Plugin/Nanoka 的角色立绘做右上角角色图，缺失时回退小花火内置艾莲。
    const splash = this.getZzzCharacterSplash(query) || 'zzzlogs/imgs/ellen.png';
    return render('zzzlogs/logs', { data: sections, splash }, { e, ret: true });
  }

  async renderBh3Logs(e, sections) {
    let charName = '';
    for (const sec of sections || []) {
      for (const row of sec.rows || []) {
        if (row.weapon) continue;
        const hit = (row.items || []).find(item => item.highlight && !item.weapon) || (row.items || []).find(item => item.rarity === 'five' && !item.weapon);
        if (hit?.name) { charName = hit.name; break; }
      }
      if (charName) break;
    }
    const splash = await this.getBh3CharacterSplash(charName) || 'bh3logs/imgs/kiana.png';
    return render('bh3logs/logs', { data: sections, splash }, { e, ret: true });
  }

  zzzPoolTime(pool) {
    return pool?.timer?.replace(/ \d{2}:\d{2}:\d{2}/g, '') || '-';
  }

  buildZzzPoolsReply(title, pools = [], extra = '') {
    const msg = [`【${title}】${extra ? `\n${extra}` : ''}`];
    const stages = [...new Set(pools.map(p => p.version).filter(Boolean))];
    for (const stage of stages) {
      const ps = pools.filter(p => p.version === stage);
      msg.push(`\n【${stage}】\n⏱ ${this.zzzPoolTime(ps[0])}`);
      for (const pool of ps) {
        msg.push(this.formatPoolLine(pool));
        if (pool.img) msg.push(segment.image(pool.img));
      }
    }
    return msg;
  }

  async replyWithImageFallback(e, msg) {
    try {
      return await e.reply(msg);
    } catch (err) {
      logger.warn('[xhh][gacha_pool] 图片消息发送失败，改为纯文本发送:', err);
      if (Array.isArray(msg)) {
        const textOnly = msg
          .filter(v => !(v?.type === 'image' || v?.type === 'node'))
          .map(v => typeof v === 'string' ? v : v?.data?.text || '')
          .filter(Boolean);
        return e.reply(textOnly.join('\n'));
      }
      throw err;
    }
  }

  getMarkIcon(game) {
    const iconMap = {
      '崩坏3': BH3_MARK_ICON,
      '绝区零': ZZZ_MARK_ICON,
      '原神': GS_MARK_ICON,
    };
    return iconMap[game] || '';
  }

  getMarkWide(game) {
    return game === '崩坏3' || game === '原神';
  }

  currentVersionByGame(game = '') {
    if (game === '原神') return CURRENT_VERSION.gs;
    if (game === '星穹铁道') return CURRENT_VERSION.sr;
    if (game === '绝区零') return CURRENT_VERSION.zzz;
    if (game === '崩坏3') return CURRENT_VERSION.bh3;
    return '';
  }

  officialCard(r, gameName = '') {
    const s = Array.isArray(r.up?.s) ? r.up.s.join(' / ') : (r.up?.s || '');
    const a = Array.isArray(r.up?.a) ? r.up.a.join(' / ') : (r.up?.a || '');
    const game = gameName || r.gameName;
    // 卡池立绘统一只放页面顶部右侧；单个 UP 卡片不再重复放立绘，避免画面太挤。
    return {
      version: r.version || this.currentVersionByGame(game) || '-',
      title: r.title,
      type: game || '米游社公告',
      time: r.createdAt ? `发布：${new Date(r.createdAt).toLocaleDateString('zh-CN')}` : '',
      s,
      a,
      note: s || a ? '' : (r.url ? '查看公告原文' : ''),
      img: r.cover || r.images?.[0] || '',
      weapon: false
    };
  }

  getCardSplashByGame(gameName = '', names = []) {
    const list = (Array.isArray(names) ? names : [names])
      .flatMap(v => String(v || '').split(/[\/,，、]/))
      .map(v => v.trim())
      .filter(Boolean);
    // 多 UP 时随机挑一个角色，再在该角色可用立绘里随机挑一张。
    for (const name of this.shuffleList(list)) {
      let img = '';
      if (gameName === '原神') img = this.getGsCharacterSplash(name);
      else if (gameName === '星穹铁道') img = this.getSrCharacterSplash(name);
      else if (gameName === '绝区零') img = this.getZzzCharacterSplash(name);
      // 崩坏3角色立绘走异步 getHeaderSplashByGame，这里只处理本地可同步读取的游戏。
      if (img) return img;
    }
    return '';
  }

  async getHeaderSplashByGame(gameName = '', records = [], fallback = '') {
    const names = [];
    for (const r of records || []) {
      if (Array.isArray(r.up?.s)) names.push(...r.up.s);
      else if (r.up?.s) names.push(r.up.s);
      const re = /[「『]([^」』]+)[」』]/g;
      let m;
      while ((m = re.exec(r.title || ''))) names.push(m[1]);
      if (r.contentText) {
        re.lastIndex = 0;
        let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]);
      }
    }
    if (gameName === '崩坏3') {
      for (const name of this.shuffleList(names)) {
        const splash = await this.getBh3CharacterSplash(name);
        if (splash) return splash;
      }
    } else {
      const splash = this.getCardSplashByGame(gameName, names);
      if (splash) return splash;
    }
    return fallback || this.getMarkIcon(gameName) || this.gameMarkIcon(gameName);
  }


  getCardNames(cards = []) {
    const names = [];
    for (const c of cards || []) {
      if (c?.s) names.push(...String(c.s).split(/[\/，,、]/));
      if (c?.title) {
        const re = /[「『]([^」』]+)[」』]/g;
        let m; while ((m = re.exec(c.title))) names.push(m[1]);
      }
    }
    return names.map(v => String(v || '').trim()).filter(Boolean);
  }

  getHeaderSplashFromCards(gameName = '', cards = [], fallback = '') {
    const splash = this.getCardSplashByGame(gameName, this.getCardNames(cards));
    return splash || fallback || this.gameMarkIcon(gameName);
  }

  async getBh3HeaderSplashFromPools(pools = [], fallback = BH3_MARK_ICON) {
    // 顶部右侧只取角色补给的角色立绘，避免装备/圣痕图标被误当成立绘。
    const charPools = (pools || []).filter(p => !p.weapon && p.type !== 'weapon');
    for (const name of this.shuffleList(this.getCardNames(charPools))) {
      const splash = await this.getBh3CharacterSplash(name);
      if (splash) return splash;
    }
    return fallback;
  }

  detectOfficialGame(text = '') {
    const msg = String(text || '').replace(/[\u200b-\u200f\ufeff]/g, '').replace(/[＃井]/g, '#').replace(/\s+/g, '').toLowerCase();
    if (/原神/.test(msg)) return 'gs';
    if (/(星铁|崩铁|星穹铁道)/.test(msg)) return 'sr';
    if (/(绝区零|绝区|zzz)/i.test(msg)) return 'zzz';
    if (/(崩三|崩坏3|崩坏三|bh3)/i.test(msg)) return 'bh3';
    return '';
  }

  eventText(e = {}) {
    const parts = [e.msg, e.raw_message, e.message?.map?.(v => v?.text || v?.data?.text || '').join('')].filter(Boolean);
    return parts.join(' ');
  }

  async officialCurrentPool(e) {
    const msg = this.eventText(e).replace(/[\u200b-\u200f\ufeff]/g, '').replace(/[＃井]/g, '#').replace(/\s+/g, '');
    // 明确指定游戏时必须按单游戏查，避免“#原神官方卡池”被当成“官方卡池”汇总。
    const gameLabel = msg.match(/(?:#|小花火)*(原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3)(?:米游社|官方)/i)?.[1] || '';
    const game = this.detectOfficialGame(msg) || officialPool.resolveGame(gameLabel) || officialPool.resolveGame(msg) || officialPool.resolveGame(e.msg);
    logger.mark('[xhh][gacha_pool] 官方卡池识别:', msg, '=>', game || 'all');
    if (!game) {
      const results = await officialPool.fetchAll();
      const cards = results.flatMap(r => {
        const meta = officialPool.games[r.game];
        return (r.records || []).slice(0, 2).map(v => this.officialCard(v, meta?.name));
      });
      if (!cards.length) return e.reply('暂未从米游社官方公告匹配到卡池/补给信息。');
      return this.renderPoolImage(e, {
        game: '米游社',
        title: '官方当前卡池',
        subtitle: '原神 / 星铁 / 绝区零 / 崩坏3 · 数据来源：米游社官方公告',
        mode: 'official',
        markIcon: MYS_MARK_ICON,
        markWide: false,
        cards
      });
    }
    const meta = officialPool.games[game];
    logger.mark(`[xhh][gacha_pool] 命中${meta.name}官方卡池:`, e.msg);
    const { records, error, cache } = await officialPool.fetch(game);
    if (!records.length) return e.reply(`${meta.name}米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    const cards = records.map(r => this.officialCard(r, meta.name));
    const markIcon = await this.getHeaderSplashByGame(meta.name, records, this.getMarkIcon(meta.name));
    return this.renderPoolImage(e, {
      game: meta.name,
      title: `${meta.name}米游社官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'official official-game',
      markIcon,
      markWide: !!markIcon,
      cards
    });
  }

  async officialVersionPool(e) {
    const m = e.msg.match(/(原神|星铁|崩铁|星穹铁道|绝区零|ZZZ|崩三|崩坏3|崩坏三|BH3)(\d+\.\d+)/);
    if (!m) return false;
    const [, gameLabel, version] = m;
    const game = officialPool.resolveGame(gameLabel);
    if (!game) return false;
    const meta = officialPool.games[game];
    logger.mark(`[xhh][gacha_pool] 命中${meta.name}v${version}官方卡池:`, e.msg);
    const { records, error, cache } = await officialPool.fetch(game, { version });
    if (!records.length) return e.reply(`${meta.name} v${version} 未找到米游社官方卡池公告${error ? '：' + error : ''}`);
    const cards = records.map(r => this.officialCard(r, meta.name));
    const markIcon = await this.getHeaderSplashByGame(meta.name, records, this.getMarkIcon(meta.name));
    return this.renderPoolImage(e, {
      game: meta.name,
      title: `${meta.name} v${version} 官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'official official-game',
      markIcon,
      markWide: !!markIcon,
      cards
    });
  }

  async refreshOfficialPools(e) {
    logger.mark('[xhh][gacha_pool] 刷新米游社官方卡池数据:', e.msg);
    // 刷新官方公告时，同时清理绝区零本地历史缓存，避免旧缓存遮住新版本数据。
    try {
      await redis.del(ZZZ_CACHE_KEY);
      await redis.del(ZZZ_CACHE_EXPIRE_KEY);
    } catch (_) {}
    const results = await officialPool.refreshAll();
    const lines = results.map(r => {
      const meta = officialPool.games[r.game];
      return `${meta?.name || r.game}：${r.records.length} 条${r.error ? '（' + r.error + '）' : ''}`;
    });
    return e.reply('米游社官方卡池数据已刷新：\n' + lines.join('\n'));
  }

  getLocalZzzMarkIcon() {
    const customDir = './plugins/xhh/resources/zzz_md/imgs/custom/';
    if (!fs.existsSync(customDir)) return '';
    try {
      const files = fs.readdirSync(customDir)
        .filter(f => /\.(png|webp|jpg|jpeg)$/i.test(f))
        .map(f => ({ f, mtime: fs.statSync(`${customDir}/${f}`).mtime }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length) return `zzz_md/imgs/custom/${files[0].f}`;
    } catch (_) {}
    return '';
  }

  async zzzCurrentPool(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零当前卡池:', e.msg);
    // 先尝试从米游社公告获取当前UP信息（含封面图）
    const { records } = await officialPool.fetch('zzz');
    if (records.length) {
      const cards = records.slice(0, 4).map((r, i) => {
        const card = this.officialCard(r, '绝区零');
        card.index = i + 1;
        card.versionTag = `#${card.index}${card.version && card.version !== '-' ? ' ' + card.version : ''}`;
        return card;
      });
      const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
      let markIcon = firstCover || ZZZ_MARK_ICON;
      let markWide = !!firstCover;
      for (const r of records) {
        const names = [];
        if (Array.isArray(r.up?.s)) names.push(...r.up.s);
        const re = /[「『]([^」』]+)[」』]/g;
        let m; while ((m = re.exec(r.title || ''))) names.push(m[1]);
        if (r.contentText) { re.lastIndex = 0; let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]); }
        for (const name of names) {
          const splash = this.getZzzCharacterSplash(name);
          if (splash) { markIcon = splash; markWide = true; break; }
        }
        if (markIcon !== firstCover && markIcon !== ZZZ_MARK_ICON) break;
      }
      return this.renderPoolImage(e, {
        game: '绝区零',
        title: '绝区零当前卡池',
        subtitle: `数据来源：米游社公告 · v${CURRENT_VERSION.zzz}`,
        mode: 'zzz',
        markIcon,
        markWide,
        cards
      });
    }
    // 兜底：使用本地数据
    const data = await this.fetchZzzPools();
    if (!data) return e.reply('绝区零卡池数据获取失败，请稍后再试。');
    const now = new Date();
    const pools = data.filter(p => {
      const { start, end } = this.parseTime(p);
      return start && end && now >= start && now <= end;
    });
    if (!pools.length) {
      const latestEnd = Math.max(...data.map(p => this.poolEndStamp(p)).filter(Boolean));
      const latest = data.filter(p => this.poolEndStamp(p) === latestEnd);
      if (!latest.length) return e.reply('当前没有匹配到正在开放的绝区零活动卡池。');
      const latestStage = latest[0]?.version ? `；数据源最新收录：${latest[0].version}` : '';
      const localMark = this.getLocalZzzMarkIcon();
      const cards = latest.map((p, i) => { const c = this.poolToCard(p); c.index = i + 1; c.versionTag = `#${c.index} ${c.version || '-'}`; return c; });
      const markIcon = this.getHeaderSplashFromCards('绝区零', cards, localMark || ZZZ_MARK_ICON);
      return this.renderPoolImage(e, {
        game: '绝区零',
        title: '最新收录卡池',
        subtitle: `当前版本 ${CURRENT_VERSION.zzz}${latestStage}；展示最新收录内容`,
        mode: 'zzz',
        markIcon,
        markWide: !!markIcon,
        cards
      });
    }
    const sample = pools[0];
    const { end } = this.parseTime(sample);
    const days = end ? Math.max(Math.ceil((end.getTime() - now.getTime()) / 86400000), 0) : '?';
    const localMark = this.getLocalZzzMarkIcon();
    const cards = pools.map((p, i) => { const c = this.poolToCard(p); c.index = i + 1; c.versionTag = `#${c.index} ${c.version || '-'}`; return c; });
    const markIcon = this.getHeaderSplashFromCards('绝区零', cards, localMark || ZZZ_MARK_ICON);
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: '本期卡池',
      subtitle: `v${sample.version} · ${this.zzzPoolTime(sample)} · 剩余约${days}天`,
      mode: 'zzz',
      markIcon,
      markWide: !!markIcon,
      cards
    });
  }

  async zzzVersionPool(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零版本卡池:', e.msg);
    const data = await this.fetchZzzPools();
    if (!data) return e.reply('绝区零卡池数据获取失败，请稍后再试。');
    const m = e.msg.match(/(?:绝区零|ZZZ)v?(\d+\.\d+)(上半|下半)?卡池/);
    if (!m) return false;
    const [, version, phase] = m;
    const pools = data.filter(p => p.version?.startsWith(version) && (!phase || p.version?.includes(phase)));
    if (!pools.length && version === CURRENT_VERSION.zzz) {
      return e.reply(`绝区零当前版本已标记为 ${CURRENT_VERSION.zzz}，但卡池数据源还没有收录 ${CURRENT_VERSION.zzz}${phase || ''} 的具体UP信息。`);
    }
    if (!pools.length) return e.reply(`未查询到绝区零 ${version}${phase || ''} 卡池数据。`);
    const cards = pools.map((p, i) => { const c = this.poolToCard(p); c.index = i + 1; c.versionTag = `#${c.index} ${c.version || '-'}`; return c; });
    const markIcon = this.getHeaderSplashFromCards('绝区零', cards, ZZZ_MARK_ICON);
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: `v${phase ? pools[0].version : version} 卡池`,
      subtitle: phase ? this.zzzPoolTime(pools[0]) : '历史版本卡池记录',
      mode: 'zzz',
      markIcon,
      markWide: !!markIcon,
      cards
    });
  }

  async zzzNameHistory(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零名称卡池:', e.msg);
    const name = e.msg.replace(/^#*(小花火)?(绝区零|ZZZ)/, '').replace(/(卡池|复刻)(统计|记录|历史)$/, '').replace(/卡池$/, '').trim();
    return this.replyZzzNameHistory(e, name, false);
  }

  async genericNameHistory(e) {
    const normalized = String(e?.msg || '')
      .replace(/[\u200b-\u200f\ufeff]/g, '')
      .replace(/[＃井]/g, '#')
      .replace(/\s+/g, '');
    // 兜底：如果“原神卡池/#原神卡池”被通用规则误吞，直接转到当前卡池。
    if (/^(?:[#＃井]*\s*)?(?:小花火)?\s*原神\s*(?:当前|本期|当期)?\s*卡池$/.test(normalized)) {
      e.msg = normalized;
      return this.gsCurrentPool(e);
    }
    const name = normalized.replace(/^#*(小花火)?/, '').replace(/(卡池|复刻)(统计|记录|历史)?$/, '').trim();
    const cnName = name.replace(/[^\u4e00-\u9fa5]/g, '');
    // 兜底中的兜底：如果通用名称规则已经把“#原神卡池”吃进来了，name 会变成“原神”。
    // 这时不要继续查历史名称，直接转当前卡池。
    if (/^(原神|原神当前|原神本期|原神当期)$/.test(cnName)) {
      e.msg = '#原神卡池';
      return this.gsCurrentPool(e);
    }
    if (!name || /^(当前|本期|当期|时间|剩余|剩下)$/i.test(name)) return false;
    logger.mark('[xhh][gacha_pool] 尝试通用名称卡池:', name);
    // 先查绝区零
    const zzzResult = await this.replyZzzNameHistory(e, name, true);
    if (zzzResult !== false) return zzzResult;
    // 再查崩三
    const bh3Result = await this.replyBh3NameHistory(e, name, true);
    if (bh3Result !== false) return bh3Result;
    // 再查星铁
    const srResult = await this.replySrNameHistory(e, name, true);
    if (srResult !== false) return srResult;
    // 再查原神
    const gsResult = await this.replyGsNameHistory(e, name, true);
    if (gsResult !== false) return gsResult;
    return false;
  }

  async replyZzzNameHistory(e, name, silent = false) {
    const data = await this.fetchZzzPools();
    if (!data) return silent ? false : e.reply('绝区零卡池数据获取失败，请稍后再试。');
    if (!name) return false;
    const query = this.normalizeZzzName(name);
    const qClean = this.cleanZzzName(query);
    const strict = qClean === '安比' || this.cleanZzzName(name) !== qClean;
    const isAgentQuery = this.isZzzAgentName(query);
    const hitName = v => {
      const raw = String(v || '');
      const vClean = this.cleanZzzName(this.normalizeZzzName(raw));
      if (!vClean || !qClean) return false;
      if (vClean === qClean) return true;
      // 别名已归一或“安比”这种有大小号歧义时，只允许精确命中，避免大安比串到小安比。
      if (strict) return false;
      // 普通查询允许较长名称互相包含，但要求至少2字符，避免“雅”误匹配。
      return vClean.length >= 2 && qClean.length >= 2 && (vClean.includes(qClean) || qClean.includes(vClean));
    };
    // 查询代理人时，只用“代理人频段”判断命中，再补同一期音擎频段。
    // 避免“艾莲卡池”被她的专属音擎「深海访客」后续复刻/陪跑记录串出来。
    const matched = data.filter(p => {
      if (isAgentQuery && p.type === '武器') return false;
      return hitName(p.s) || (Array.isArray(p.a) && p.a.some(hitName));
    });
    let records = [];
    if (isAgentQuery) {
      // 查询代理人时，只展示命中的代理人频段，并按同一期顺序补“对应”的音擎频段。
      // 以前直接把同一期所有音擎都带出来，双 UP 期会把另一个角色的专武（如怒目金刚）也混进艾莲卡池。
      for (const p of matched) {
        records.push(p);
        if (p.type === '武器' || !hitName(p.s)) continue; // A级陪跑没有对应专武，别强行带音擎。
        const key = `${p.version || '-'}|${this.zzzPoolTime(p)}`;
        const same = data.filter(v => `${v.version || '-'}|${this.zzzPoolTime(v)}` === key);
        const chars = same.filter(v => v.type !== '武器');
        const weapons = same.filter(v => v.type === '武器');
        const idx = chars.indexOf(p);
        if (idx >= 0 && weapons[idx]) records.push(weapons[idx]);
      }
      records = records.filter((v, i, arr) => arr.indexOf(v) === i);
    } else {
      // 查询音擎/非代理人关键词时保留原逻辑：展示同一期命中的相关记录。
      const hitKeys = new Set(matched.map(p => `${p.version || '-'}|${this.zzzPoolTime(p)}`));
      records = data.filter(p => {
        const key = `${p.version || '-'}|${this.zzzPoolTime(p)}`;
        return hitKeys.has(key) && (matched.includes(p) || p.type === '武器');
      });
    }
    if (!records.length) return silent ? false : e.reply(`未找到【${name}】的绝区零卡池记录。`);
    const sections = this.buildZzzHistorySections(records, query);
    if (sections.length) {
      return this.renderZzzLogs(e, sections, query);
    }
    const first = records[0];
    const rarity = hitName(first.s) ? 'S级' : 'A级';
    const type = first.type === '武器' ? '音擎' : '代理人';
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: `${query} 卡池记录`,
      subtitle: `${rarity}${type} · 共 ${records.length} 次记录`,
      mode: 'gs-history',
      cards: sections
    });
  }

  cleanZzzName(name = '') {
    return String(name || '').replace(/[\s「」『』【】［］()（）·・•!！&]/g, '').trim();
  }

  normalizeZzzName(name = '') {
    const raw = String(name || '').trim();
    const clean = this.cleanZzzName(raw);
    const aliasMap = {
      大安比: '零号·安比',
      零号安比: '零号·安比',
      零号: '零号·安比',
      小安比: '安比',
      普安比: '安比'
    };
    if (aliasMap[clean]) return aliasMap[clean];
    try {
      const data = JSON.parse(fs.readFileSync('./plugins/ZZZ-Plugin/resources/map/PartnerId2Data.json', 'utf-8'));
      for (const info of Object.values(data)) {
        const name = info?.name || '';
        const full = info?.full_name || '';
        if (this.cleanZzzName(name) === clean || this.cleanZzzName(full) === clean) return name || full || raw;
      }
    } catch (_) {}
    return raw;
  }

  isZzzAgentName(name = '') {
    const target = this.cleanZzzName(name);
    if (!target) return false;
    try {
      const data = JSON.parse(fs.readFileSync('./plugins/ZZZ-Plugin/resources/map/PartnerId2Data.json', 'utf-8'));
      for (const info of Object.values(data)) {
        const name = this.cleanZzzName(info?.name || '');
        const full = this.cleanZzzName(info?.full_name || '');
        if (name === target || full === target) return true;
      }
    } catch (_) {}
    return false;
  }

  getZzzCharSprite(name = '') {
    try {
      const data = JSON.parse(fs.readFileSync('./plugins/ZZZ-Plugin/resources/map/PartnerId2Data.json', 'utf-8'));
      const clean = s => String(s || '').replace(/[「」&]/g, '');
      const target = clean(name);
      for (const info of Object.values(data)) {
        const entry = clean(info?.name || '');
        if (entry === target || entry.startsWith(target) || target.startsWith(entry)) {
          return info.sprite_id || '';
        }
      }
      for (const info of Object.values(data)) {
        const full = clean(info?.full_name || '');
        if (full === target || full.startsWith(target) || target.startsWith(full)) {
          return info.sprite_id || '';
        }
      }
    } catch (_) {}
    return '';
  }

  getZzzCharacterSplash(name = '') {
    // 顶部立绘优先用 panel/半身透明图；没有额外资源时再退到 nanoka 资源，避免抽到很小的通用头像。
    return this.getZzzPanelSplash(name)
      || this.getZzzNanokaRoleImage(name)
      || this.getZzzRoleGeneralImage(name);
  }

  getZzzNanokaRoleImage(name = '') {
    const sprite = this.getZzzCharSprite(name);
    if (!sprite) return '';
    const local = `./plugins/ZZZ-Plugin/resources/images/nanoka/role/IconRole${sprite}_01.webp`;
    if (fs.existsSync(local)) return fs.realpathSync(local);
    return '';
  }

  getZzzRoleGeneralImage(name = '') {
    const sprite = this.getZzzCharSprite(name);
    if (!sprite) return '';
    const local = `./plugins/ZZZ-Plugin/resources/images/nanoka/role_general/IconRoleGeneral${sprite}.webp`;
    if (fs.existsSync(local)) return fs.realpathSync(local);
    return '';
  }

  getZzzPanelSplash(name = '') {
    const root = './plugins/ZZZ-Plugin/resources/images/panel';
    if (!fs.existsSync(root)) return '';
    const clean = v => String(v || '').replace(/[「」&·•\s]/g, '');
    const target = clean(name) || '艾莲';
    try {
      const dirs = fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const dirName = dirs.find(d => clean(d) === target)
        || dirs.find(d => clean(d).includes(target) || target.includes(clean(d)))
        || (target === '艾莲' ? '艾莲' : '');
      if (!dirName) return '';
      const dir = `${root}/${dirName}`;
      const files = fs.readdirSync(dir)
        .filter(f => /\.(png|webp|jpg|jpeg)$/i.test(f))
        .filter(f => !/avatar|icon|face|头像/i.test(f))
        // Gu/咕咕牛图下方经常自带文字，不适合放在右上角装饰位。
        .filter(f => !/Gu[1-9]/i.test(f))
        .map(f => ({ f, size: fs.statSync(`${dir}/${f}`).size }))
        .map(v => ({
          ...v,
          score: (() => {
            if (/backgrounderaser/i.test(v.f)) return 120;
            if (/-\d{3,4}-\d{3,4}\.png$/i.test(v.f)) return 100;
            if (/\.png$/i.test(v.f)) return 80;
            if (/立绘|半身|panel/i.test(v.f)) return 60;
            return 0;
          })()
        }))
        .sort((a, b) => {
          // 右上角装饰图优先选高分辨率透明 PNG，避免自带文字/海报裁切影响观感。
          return b.score - a.score || b.size - a.size;
        });
      if (files.length) {
        const bestScore = files[0].score;
        const pool = files.filter(v => v.score >= Math.max(60, bestScore - 20));
        return fs.realpathSync(`${dir}/${this.randomPick(pool).f}`);
      }
    } catch (_) {}
    return '';
  }

  getZzzPanelIcon(name = '') {
    const root = './plugins/ZZZ-Plugin/resources/images/panel';
    if (!fs.existsSync(root)) return '';
    const clean = v => String(v || '').replace(/[「」&·•\s]/g, '');
    const target = clean(name);
    if (!target) return '';
    try {
      const dirs = fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const dirName = dirs.find(d => clean(d) === target)
        || dirs.find(d => clean(d).includes(target) || target.includes(clean(d)));
      if (!dirName) return '';
      const dir = `${root}/${dirName}`;
      const files = fs.readdirSync(dir)
        .filter(f => /\.(png|webp|jpg|jpeg)$/i.test(f))
        .filter(f => !/avatar|icon|face|头像/i.test(f))
        .map(f => ({ f, size: fs.statSync(`${dir}/${f}`).size }))
        .sort((a, b) => {
          const score = f => {
            if (/Gu[1-9]/i.test(f)) return 100;
            if (/backgrounderaser/i.test(f)) return 60;
            if (/半身|panel/i.test(f)) return 40;
            return 0;
          };
          return score(b.f) - score(a.f) || b.size - a.size;
        });
      if (files.length) return fs.realpathSync(`${dir}/${files[0].f}`);
    } catch (_) {}
    return '';
  }

  getZzzIcon(name = '', weapon = false) {
    if (weapon) {
      const mapPath = './plugins/ZZZ-Plugin/resources/map/WeaponId2Data.json';
      try {
        const data = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        const clean = v => String(v || '').replace(/[「」&·•\s]/g, '');
        const target = clean(name);
        for (const info of Object.values(data)) {
          if (clean(info?.Name) === target) {
            const code = info?.CodeName || '';
            const local = `./plugins/ZZZ-Plugin/resources/images/weapon/${code}_High.png`;
            if (code && fs.existsSync(local)) return fs.realpathSync(local);
            break;
          }
        }
      } catch (_) {}
      // Atlas 的 W-Engine 图不少是带文字海报，卡池小图里容易裁切/露字；没有 ZZZ-Plugin 干净图标时宁可只显示名称。
      return '';
    }
    // 左侧 UP 方块优先使用 ZZZ-Plugin panel 半身图；全身图在 44px 方块内很容易裁掉头。
    const panelIcon = this.getZzzPanelIcon(name);
    if (panelIcon) return panelIcon;
    const sprite = this.getZzzCharSprite(name);
    if (sprite) {
      const localPath = `./plugins/ZZZ-Plugin/resources/images/role/IconRole${sprite}.png`;
      if (fs.existsSync(localPath)) return fs.realpathSync(localPath);
      return `https://static.nanoka.cc/assets/zzz/IconRole${sprite}.webp`;
    }
    const dir = './plugins/Atlas/zzz-atlas/material for role';
    const path = `${dir}/${name}.webp`;
    if (fs.existsSync(path)) return fs.realpathSync(path);
    return '';
  }

  buildZzzHistoryItem(name = '', rarity = 'four', weapon = false, highlightName = '') {
    return {
      name,
      icon: this.getZzzIcon(name, weapon),
      rarity,
      weapon,
      highlight: name === highlightName || String(name).includes(highlightName) || String(highlightName).includes(name)
    };
  }

  buildZzzHistorySections(records = [], query = '') {
    const map = new Map();
    for (const p of records) {
      const key = `${p.version || '-'}|${this.zzzPoolTime(p)}`;
      if (!map.has(key)) map.set(key, { version: p.version || '-', time: this.zzzPoolTime(p), rows: [] });
      const weapon = p.type === '武器';
      const items = [this.buildZzzHistoryItem(p.s || '-', 'five', weapon, query)];
      for (const a of (Array.isArray(p.a) ? p.a : String(p.a || '').split(/[，,/]/).filter(Boolean))) {
        items.push(this.buildZzzHistoryItem(a, 'four', weapon, query));
      }
      map.get(key).rows.push({ title: weapon ? '音擎频段' : '代理人频段', weapon, items, showNames: weapon });
    }
    return [...map.values()].map(sec => ({
      ...sec,
      // 同一期同时展示代理人与专属音擎时，固定代理人频段在上、音擎频段在下。
      // 避免“艾莲卡池”这类结果出现武器 UP 压在角色 UP 上面。
      rows: (sec.rows || []).sort((a, b) => Number(!!a.weapon) - Number(!!b.weapon))
    }));
  }

  async zzzAllPool(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零全卡池:', e.msg);
    const data = await this.fetchZzzPools();
    if (!data) return e.reply('绝区零卡池数据获取失败，请稍后再试。');
    const versions = [...new Set(data.map(p => p.version?.replace(/(上半|下半)$/g, '')).filter(Boolean))].reverse();
    const chunks = versions.map(v => {
      const ps = data.filter(p => p.version?.startsWith(v));
      const lines = [`【v${v}】`];
      for (const p of ps) lines.push(`${p.version} ${this.formatPoolLine(p)}`);
      return lines.join('\n');
    });
    const title = '绝区零全版本卡池记录';
    const msg = chunks.length > 8 ? await makeForwardMsg(e, [title, ...chunks], title) : [title, ...chunks];
    return e.reply(msg);
  }

  async srCurrentPool(e) {
    logger.mark('[xhh][gacha_pool] 命中星铁当前卡池:', e.msg);
    const { records, error, cache } = await officialPool.fetch('sr');
    if (records.length) {
      const cards = records.slice(0, 6).map((r, i) => {
        const card = this.officialCard(r, '星穹铁道');
        card.index = i + 1;
        card.versionTag = `#${card.index}${card.version && card.version !== '-' ? ' ' + card.version : ''}`;
        return card;
      });
      let ver = records.find(r => r.version && r.version !== '-')?.version;
      if (!ver) {
        const srData = this.loadSrPoolHistory();
        if (Array.isArray(srData) && srData.length) ver = srData[0]?.ver || '';
      }
      if (ver) cards.forEach(c => { if (!c.version || c.version === '-') { c.version = ver; c.versionTag = `#${c.index} ${ver}`; } });
      const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
      let markIcon = firstCover || SR_MARK_ICON;
      let markWide = !!firstCover;
      for (const r of records) {
        const names = [];
        if (Array.isArray(r.up?.s)) names.push(...r.up.s);
        const re = /[「『]([^」』]+)[」』]/g;
        let m; while ((m = re.exec(r.title || ''))) names.push(m[1]);
        if (r.contentText) { re.lastIndex = 0; let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]); }
        for (const name of names) {
          const splash = this.getSrCharacterSplash(name);
          if (splash) { markIcon = splash; markWide = true; break; }
        }
        if (markIcon !== firstCover && markIcon !== SR_MARK_ICON) break;
      }
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: '星铁当前卡池',
        subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
        mode: 'sr',
        markIcon,
        markWide,
        cards
      });
    }
    const srData = this.loadSrPoolHistory();
    if (Array.isArray(srData) && srData.length) {
      const currentVersion = CURRENT_VERSION.sr;
      const current = srData.filter(v => String(v.ver || '').startsWith(currentVersion));
      if (current.length) {
        return this.renderSrLogs(e, current);
      }
    }
    return e.reply(`星铁米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
  }

  async srVersionPool(e) {
    logger.mark('[xhh][gacha_pool] 命中星铁版本卡池:', e.msg);
    const m = e.msg.match(/(?:星铁|崩铁|星穹铁道)v?(\d+\.\d+)(上半|下半)?(?:卡池|跃迁)/);
    if (!m) return false;
    const [, version, phase] = m;
    const { records, error, cache } = await officialPool.fetch('sr', { version });
    if (records.length) {
      const filtered = phase ? records.filter(r => (r.title || '').includes(phase) || (r.version || '').includes(phase)) : records;
      const cards = (filtered.length ? filtered : records).map((r, i) => {
        const card = this.officialCard(r, '星穹铁道');
        card.index = i + 1;
        const ver = card.version && card.version !== '-' ? ' ' + card.version : '';
        card.versionTag = `#${card.index}${ver}`;
        return card;
      });
      const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
      let markIcon = firstCover || SR_MARK_ICON;
      let markWide = !!firstCover;
      for (const r of records) {
        const names = [];
        if (Array.isArray(r.up?.s)) names.push(...r.up.s);
        const re = /[「『]([^」』]+)[」』]/g;
        let m; while ((m = re.exec(r.title || ''))) names.push(m[1]);
        if (r.contentText) { re.lastIndex = 0; let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]); }
        for (const name of names) {
          const splash = this.getSrCharacterSplash(name);
          if (splash) { markIcon = splash; markWide = true; break; }
        }
        if (markIcon !== firstCover && markIcon !== SR_MARK_ICON) break;
      }
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: `星铁 v${version}${phase || ''} 卡池`,
        subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
        mode: 'sr',
        markIcon,
        markWide,
        cards
      });
    }
    const srData = this.loadSrPoolHistory();
    if (Array.isArray(srData) && srData.length) {
      const queryVer = `${version}${phase || ''}`;
      const matched = srData.filter(v => {
        const ver = String(v.ver || '');
        return ver === queryVer || ver.startsWith(version + (phase || ''));
      });
      if (matched.length) {
        return this.renderSrLogs(e, matched);
      }
    }
    return e.reply(`星铁 v${version}${phase || ''} 未找到卡池数据${error ? '：' + error : ''}`);
  }

  async srNameHistory(e) {
    logger.mark('[xhh][gacha_pool] 命中星铁名称卡池:', e.msg);
    const name = e.msg.replace(/^#*(小花火)?(星铁|崩铁|星穹铁道)/, '').replace(/(卡池|跃迁)$/, '').trim();
    if (!name) return false;
    return this.replySrNameHistory(e, name, false);
  }

  async replySrNameHistory(e, name, silent = false) {
    if (!name) return false;
    const srData = this.loadSrPoolHistory();
    if (Array.isArray(srData) && srData.length) {
      const query = this.normalizeSrName(name);
      const matched = srData.filter(v => {
        const jsMatch = (v.js_five || []).includes(query) || (v.js_four || []).includes(query);
        const gzMatch = this.clSrNames(v.gz_five || []).includes(query) || this.clSrNames(v.gz_four || []).includes(query);
        return jsMatch || gzMatch;
      });
      if (matched.length) {
        return this.renderSrLogs(e, matched, query);
      }
    }
    const { records } = await officialPool.fetch('sr');
    const hit = records.filter(r => (r.title || '').includes(name));
    if (!hit.length) return silent ? false : e.reply(`未找到【${name}】的星铁卡池记录。`);
    return this.renderPoolImage(e, {
      game: '星穹铁道',
      title: `${name} 卡池记录`,
      subtitle: `共 ${hit.length} 条记录 · 数据来源：米游社公告`,
      mode: 'sr',
      cards: hit.map(r => this.officialCard(r, '星穹铁道'))
    });
  }

  normalizeSrName(name = '') {
    let query = String(name || '').trim();
    try {
      const jsNames = yaml.get('./plugins/xhh/system/default/sr_js_names.yaml') || {};
      for (const [key, aliases] of Object.entries(jsNames)) {
        if (key === query || (Array.isArray(aliases) && aliases.includes(query))) return key;
      }
      const gzNames = yaml.get('./plugins/xhh/system/default/gz_names.yaml') || {};
      for (const [key, aliases] of Object.entries(gzNames)) {
        if (key === query || (Array.isArray(aliases) && aliases.includes(query))) return key;
      }
    } catch (_) {}
    return query;
  }

  getMiaoProfileImage(name = '') {
    const target = String(name || '').replace(/Pro$/i, '').replace('•', '·');
    if (!target) return '';
    const roots = [
      './plugins/miao-plugin/resources/profile/normal-character',
      './plugins/miao-plugin/resources/profile/super-character'
    ];
    for (const root of roots) {
      const dir = `${root}/${target}`;
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir)
          .filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f))
          .map(f => ({ f, size: fs.statSync(`${dir}/${f}`).size }))
          .map(v => ({
            ...v,
            score: (() => {
              // miao 的额外图优先用 y 系列/纯数字图，Gu 系列常带字，放最后兜底。
              if (/^y/i.test(v.f)) return 120;
              if (/^\d+\.(webp|png|jpg|jpeg)$/i.test(v.f)) return 100;
              if (!/Gu\d+/i.test(v.f)) return 80;
              return 20;
            })()
          }))
          .sort((a, b) => {
            return b.score - a.score || b.size - a.size;
          });
        if (files.length) {
          const bestScore = files[0].score;
          const pool = files.filter(v => v.score >= Math.max(80, bestScore - 20));
          return fs.realpathSync(`${dir}/${this.randomPick(pool).f}`);
        }
      } catch (_) {}
    }
    return '';
  }

  getSrCharacterIcon(name = '') {
    const names = [name, String(name).replace(/Pro$/i, ''), String(name).replace('•', '·')].filter(Boolean);
    for (const n of [...new Set(names)]) {
      const profile = this.getMiaoProfileImage(n);
      if (profile) return profile;
      const base = `./plugins/miao-plugin/resources/meta-sr/character/${n}/imgs`;
      for (const file of ['face.webp', 'face-q.webp', 'preview.webp', 'card.webp']) {
        const path = `${base}/${file}`;
        if (fs.existsSync(path)) return fs.realpathSync(path);
      }
    }
    return '';
  }

  getSrCharacterSplash(name = '') {
    const names = [name, String(name).replace(/Pro$/i, ''), String(name).replace('•', '·')].filter(Boolean);
    const primary = [];
    const fallback = [];
    for (const n of [...new Set(names)]) {
      const profile = this.getMiaoProfileImage(n);
      if (profile) primary.push(profile);
      const base = `./plugins/miao-plugin/resources/meta-sr/character/${n}/imgs`;
      for (const file of ['splash.webp', 'preview.webp']) {
        const path = `${base}/${file}`;
        if (fs.existsSync(path)) primary.push(fs.realpathSync(path));
      }
      for (const file of ['card.webp']) {
        const path = `${base}/${file}`;
        if (fs.existsSync(path)) fallback.push(fs.realpathSync(path));
      }
    }
    return this.randomPick(primary) || this.randomPick(fallback);
  }

  getSrWeaponIcon(name = '') {
    const root = './plugins/miao-plugin/resources/meta-sr/weapon';
    if (!fs.existsSync(root)) return '';
    const raw = String(name || '');
    const clean = raw.includes('/') ? raw.split('/').pop() : raw;
    const direct = raw.includes('/') ? `${root}/${raw}` : '';
    const candidates = direct ? [direct] : [];
    try {
      for (const type of fs.readdirSync(root)) candidates.push(`${root}/${type}/${clean}`);
    } catch (_) {}
    for (const base of candidates) {
      for (const file of ['icon.webp', 'icon-s.webp', 'splash.webp']) {
        const path = `${base}/${file}`;
        if (fs.existsSync(path)) return fs.realpathSync(path);
      }
    }
    return '';
  }

  buildSrHistoryItem(name = '', rarity = 'four', weapon = false, query = '') {
    const display = weapon ? String(name || '').split('/').pop() : String(name || '');
    const icon = weapon ? this.getSrWeaponIcon(name) : this.getSrCharacterIcon(display);
    const q = this.normalizeSrName(query || '');
    const cq = String(q || '').split('/').pop();
    return {
      name: display,
      icon,
      rarity,
      weapon,
      highlight: !!cq && (display === cq || display.includes(cq) || cq.includes(display))
    };
  }

  buildSrHistorySections(data = [], query = '') {
    if (!Array.isArray(data)) return [];
    return data.map(item => {
      const rows = [];
      const jsItems = [
        ...(item.js_five || []).map(n => this.buildSrHistoryItem(n, 'five', false, query)),
        ...(item.js_four || []).map(n => this.buildSrHistoryItem(n, 'four', false, query))
      ];
      if (jsItems.length) rows.push({ title: '角色活动跃迁', weapon: false, items: jsItems });
      const gzItems = [
        ...(item.gz_five || []).map(n => this.buildSrHistoryItem(n, 'five', true, query)),
        ...(item.gz_four || []).map(n => this.buildSrHistoryItem(n, 'four', true, query))
      ];
      if (gzItems.length) rows.push({ title: '光锥活动跃迁', weapon: true, items: gzItems });
      return { version: item.ver || '-', time: item.time || '-', rows };
    }).filter(v => v.rows.length);
  }

  async loadSrLocalCards(type = '') {
    const data = this.loadSrPoolHistory();
    if (!Array.isArray(data)) return [];
    const query = this.normalizeSrName(type);
    const isCurrent = query === 'current';
    const cards = [];
    const currentVersion = CURRENT_VERSION.sr;
    for (const item of data) {
      const ver = item.ver || '';
      const versionHit = !isCurrent && (ver === query || ver.startsWith(query) || ver.replace(/上半|下半/g, '') === query);
      const nameHit = !isCurrent && (
        (item.js_five || []).includes(query) ||
        (item.js_four || []).includes(query) ||
        this.clSrNames(item.gz_five || []).includes(query) ||
        this.clSrNames(item.gz_four || []).includes(query)
      );
      if (isCurrent && !ver.startsWith(currentVersion)) continue;
      if (!isCurrent && !versionHit && !nameHit) continue;
      cards.push({
        version: ver,
        title: `${ver} 角色活动跃迁`,
        type: '星穹铁道',
        time: item.time || '',
        s: (item.js_five || []).join(' / '),
        a: (item.js_four || []).join(' / '),
        img: '',
        weapon: false
      });
      cards.push({
        version: ver,
        title: `${ver} 光锥活动跃迁`,
        type: '星穹铁道',
        time: item.time || '',
        s: this.clSrNames(item.gz_five || []).join(' / '),
        a: this.clSrNames(item.gz_four || []).join(' / '),
        img: '',
        weapon: true
      });
      if (isCurrent || versionHit) continue;
    }
    return cards;
  }

  clSrNames(arr = []) {
    return arr.map(v => String(v).replace(/\/|智识|记忆|虚无|同谐|丰饶|毁灭|巡猎|存护|，|,|!|！|」|「/g, ''));
  }

  async gsCurrentPool(e) {
    logger.mark('[xhh][gacha_pool] 命中原神当前卡池:', e.msg);
    const { records, error, cache } = await officialPool.fetch('gs');
    if (!records.length) {
      const localCards = await this.loadGsLocalCards('current');
      if (localCards.length) {
        localCards.forEach((card, i) => {
          card.index = i + 1;
          card.versionTag = `#${card.index}${card.version && card.version !== '-' ? ' ' + card.version : ''}`;
        });
        const markIcon = this.getHeaderSplashFromCards('原神', localCards, GS_MARK_ICON);
        return this.renderPoolImage(e, {
          game: '原神',
          title: '原神当前卡池',
          subtitle: '本地卡池库兜底',
          mode: 'gs',
          markIcon,
          markWide: !!markIcon,
          cards: localCards
        });
      }
      return e.reply(`原神米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    }
    const cards = records.slice(0, 4).map((r, i) => {
      const card = this.officialCard(r, '原神');
      card.index = i + 1;
      card.versionTag = `#${card.index}${card.version && card.version !== '-' ? ' ' + card.version : ''}`;
      return card;
    });
    let verFromApi = records.find(r => r.version && r.version !== '-')?.version;
    if (!verFromApi) {
      const localCards = await this.loadGsLocalCards('current');
      verFromApi = localCards.find(c => c.version && c.version !== '-')?.version || '';
    }
    if (verFromApi) {
      cards.forEach(c => {
        if (!c.version || c.version === '-') { c.version = verFromApi; c.versionTag = `#${c.index} ${verFromApi}`; }
      });
    }
    const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
    let markIcon = firstCover || GS_MARK_ICON;
    let markWide = !!firstCover;
    for (const r of records) {
      const names = [];
      if (Array.isArray(r.up?.s)) names.push(...r.up.s);
      const re = /[「『]([^」』]+)[」』]/g;
      let m;
      while ((m = re.exec(r.title || ''))) names.push(m[1]);
      if (r.contentText) {
        re.lastIndex = 0;
        let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]);
      }
      for (const name of names) {
        const splash = this.getGsCharacterSplash(name);
        if (splash) { markIcon = splash; markWide = true; break; }
      }
      if (markIcon !== firstCover && markIcon !== GS_MARK_ICON) break;
    }
    return this.renderPoolImage(e, {
      game: '原神',
      title: '原神当前卡池',
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon,
      markWide,
      cards
    });
  }

  async gsVersionPool(e) {
    logger.mark('[xhh][gacha_pool] 命中原神版本卡池:', e.msg);
    const m = e.msg.match(/原神v?(\d+\.\d+)(上半|下半)?卡池/);
    if (!m) return false;
    const [, version, phase] = m;
    const { records, error, cache } = await officialPool.fetch('gs', { version });
    if (!records.length) {
      const localCards = await this.loadGsLocalCards(`${version}${phase || ''}`);
      if (localCards.length) {
        localCards.forEach((card, i) => {
          card.index = i + 1;
          card.versionTag = `#${card.index}${card.version && card.version !== '-' ? ' ' + card.version : ''}`;
        });
        const markIcon = this.getHeaderSplashFromCards('原神', localCards, GS_MARK_ICON);
        return this.renderPoolImage(e, {
          game: '原神',
          title: `原神 v${version}${phase || ''} 卡池`,
          subtitle: '本地历史卡池库',
          mode: 'gs',
          markIcon,
          markWide: !!markIcon,
          cards: localCards
        });
      }
      return e.reply(`原神 v${version} 未找到米游社官方卡池公告${error ? '：' + error : ''}`);
    }
    const cards = records.map((r, i) => {
      const card = this.officialCard(r, '原神');
      card.index = i + 1;
      const ver = card.version && card.version !== '-' ? ' ' + card.version : '';
      card.versionTag = `#${card.index}${ver}`;
      return card;
    });
    const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
    let markIcon = firstCover || GS_MARK_ICON;
    let markWide = !!firstCover;
    for (const r of records) {
      const names = [];
      if (Array.isArray(r.up?.s)) names.push(...r.up.s);
      const re = /[「『]([^」』]+)[」』]/g;
      let m;
      while ((m = re.exec(r.title || ''))) names.push(m[1]);
      if (r.contentText) {
        re.lastIndex = 0;
        let cm; while ((cm = re.exec(r.contentText))) names.push(cm[1]);
      }
      for (const name of names) {
        const splash = this.getGsCharacterSplash(name);
        if (splash) { markIcon = splash; markWide = true; break; }
      }
      if (markIcon !== firstCover && markIcon !== GS_MARK_ICON) break;
    }
    return this.renderPoolImage(e, {
      game: '原神',
      title: `原神 v${version}${phase || ''} 官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon,
      markWide,
      cards
    });
  }

  async gsNameHistory(e) {
    logger.mark('[xhh][gacha_pool] 命中原神名称卡池:', e.msg);
    const name = e.msg.replace(/^#*(小花火)?原神/, '').replace(/卡池$/, '').trim();
    if (!name) return false;
    return this.replyGsNameHistory(e, name, false);
  }

  async replyGsNameHistory(e, name, silent = false) {
    if (!name) return false;
    const query = this.normalizeGsName(name);
    // 特定角色/武器卡池优先使用本地历史库，渲染成“版本 + 时间 + UP头像行”的时间轴样式。
    const sections = await this.loadGsHistorySections(query);
    if (sections.length) {
      return this.renderGsLogs(e, sections);
    }
    const { records, error, cache } = await officialPool.fetch('gs');
    if (!records.length) return silent ? false : e.reply(`原神米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    const hit = records.filter(r => {
      const t = r.title || '';
      return t.includes(query) || t.includes(name);
    });
    if (!hit.length) return silent ? false : e.reply(`未找到【${query}】的原神卡池记录。`);
    const cards = hit.map(r => this.officialCard(r, '原神'));
    const firstCover = hit[0]?.cover || hit[0]?.images?.[0] || '';
    return this.renderPoolImage(e, {
      game: '原神',
      title: `${query} 卡池记录`,
      subtitle: `共 ${hit.length} 条记录 · 数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon: firstCover || GS_MARK_ICON,
      markWide: !!firstCover,
      cards
    });
  }

  normalizeGsName(name = '') {
    let query = String(name || '').trim();
    try {
      const gsnames = yaml.get('./plugins/xhh/system/default/gs_js_names.yaml') || {};
      for (const [key, aliases] of Object.entries(gsnames)) {
        if (Array.isArray(aliases) && aliases.includes(query)) return key;
      }
      const wqnames = yaml.get('./plugins/xhh/system/default/wqname.yaml') || {};
      for (const [key, aliases] of Object.entries(wqnames)) {
        if (Array.isArray(aliases) && aliases.includes(query)) return key;
      }
    } catch (_) {}
    return query;
  }

  getGsCharacterSplash(name = '') {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const candidates = [raw];
    // 去掉 (元素) 后缀
    const noElem = raw.replace(/[（(][^）)]*[）)]/g, '').trim();
    if (noElem !== raw) candidates.push(noElem);
    // 去掉 ·前的称号前缀（如 "镜水析谬·桑多涅" → "桑多涅"）
    const afterDot = noElem.split('·').pop().trim();
    if (afterDot && afterDot !== noElem) candidates.push(afterDot);
    const afterHdot = noElem.split('•').pop().trim();
    if (afterHdot && afterHdot !== noElem && afterHdot !== afterDot) candidates.push(afterHdot);
    const primary = [];
    const fallback = [];
    for (const n of candidates) {
      for (const ext of ['.webp', '.png', '.jpg']) {
        const p = `./plugins/xhh/resources/gslogs/imgs/${n}${ext}`;
        if (fs.existsSync(p)) primary.push(fs.realpathSync(p));
      }
      const profile = this.getMiaoProfileImage(n);
      if (profile) primary.push(profile);
      const metaBase = `./plugins/miao-plugin/resources/meta-gs/character/${n}/imgs`;
      for (const file of ['splash.webp', 'side.webp', 'gacha.webp']) {
        const path = `${metaBase}/${file}`;
        if (fs.existsSync(path)) primary.push(fs.realpathSync(path));
      }
      for (const file of ['card.webp', 'face.webp', 'face-q.webp', 'face0.webp']) {
        const path = `${metaBase}/${file}`;
        if (fs.existsSync(path)) fallback.push(fs.realpathSync(path));
      }
    }
    return this.randomPick(primary) || this.randomPick(fallback);
  }

  getGsCharacterIcon(name = '') {
    const profile = this.getMiaoProfileImage(name);
    if (profile) return profile;
    const base = `./plugins/miao-plugin/resources/meta-gs/character/${name}/imgs`;
    for (const file of ['face.webp', 'face-q.webp', 'face0.webp', 'card.webp']) {
      const path = `${base}/${file}`;
      if (fs.existsSync(path)) return fs.realpathSync(path);
    }
    return '';
  }

  getGsWeaponIcon(name = '') {
    const root = './plugins/miao-plugin/resources/meta-gs/weapon';
    if (!fs.existsSync(root)) return '';
    try {
      for (const type of fs.readdirSync(root)) {
        const base = `${root}/${type}/${name}`;
        for (const file of ['icon.webp', 'gacha.webp', 'awaken.webp']) {
          const path = `${base}/${file}`;
          if (fs.existsSync(path)) return fs.realpathSync(path);
        }
      }
    } catch (_) {}
    return '';
  }

  buildGsHistoryItem(name = '', rarity = 'four', weapon = false, highlight = false) {
    const icon = weapon ? this.getGsWeaponIcon(name) : this.getGsCharacterIcon(name);
    return { name, icon, rarity, weapon, highlight };
  }

  async loadGsHistorySections(type = '') {
    const data = this.loadGsPoolHistory();
    if (!data?.date) return [];
    const query = this.normalizeGsName(type);
    const sections = [];
    for (const [dateKey, lines = []] of Object.entries(data.date)) {
      const pools = lines.map(line => String(line || '').split(',').map(v => v.trim()).filter(Boolean));
      if (!pools.some(arr => arr.includes(query))) continue;
      const version = dateKey.match('【(.*)】')?.[1] || '';
      const time = dateKey.replace(`【${version}】`, '').replace('~', ' ~ ');
      const rows = pools.map((arr, idx) => {
        const weapon = idx === 2;
        const title = idx === 2 ? '武器活动祈愿' : (idx === 3 ? '集录祈愿' : '角色活动祈愿');
        return {
          title,
          weapon,
          items: arr.map((n, i) => this.buildGsHistoryItem(n, i === 0 || (weapon && i < 2) ? 'five' : 'four', weapon, n === query))
        };
      }).filter(row => row.items.length);
      sections.push({ version, time, rows });
    }
    return sections;
  }

  async loadGsLocalCards(type = '') {
    const data = this.loadGsPoolHistory();
    if (!data?.date || !data?.imgs) return [];
    const query = this.normalizeGsName(type);
    const cards = [];
    const entries = Object.entries(data.date);
    const isCurrent = query === 'current';
    for (const [dateKey, names] of entries) {
      const ver = dateKey.match('【(.*)】')?.[1] || '';
      if (!ver) continue;
      const imgs = data.imgs[`【${ver}】`] || [];
      const time = dateKey.replace(`【${ver}】`, '').replace('~', ' ~ ');
      const versionHit = !isCurrent && (ver === query || ver.startsWith(query) || ver.replace(/上半|下半/g, '') === query);
      if (isCurrent || versionHit) {
        names.forEach((line, i) => {
          const arr = String(line).split(',').map(v => v.trim()).filter(Boolean);
          cards.push({
            version: ver,
            title: i === 2 ? '武器活动祈愿' : (i === 3 ? '集录祈愿' : '角色活动祈愿'),
            type: '原神',
            time,
            s: arr.slice(0, 2).join(' / '),
            a: arr.slice(2).join(' / '),
            img: imgs[i] || '',
            weapon: i === 2
          });
        });
        if (isCurrent) break;
        continue;
      }
      names.forEach((line, i) => {
        const arr = String(line).split(',');
        if (arr.includes(query)) {
          cards.push({
            version: ver,
            title: `${query} 卡池`,
            type: i === 2 ? '武器祈愿' : '角色祈愿',
            time,
            s: arr.slice(0, 2).join(' / '),
            a: arr.slice(2).join(' / '),
            img: imgs[i] || '',
            weapon: i === 2
          });
        }
      });
    }
    return cards;
  }

  async gsAllPool(e) {
    logger.mark('[xhh][gacha_pool] 命中原神全卡池:', e.msg);
    const { records, error, cache } = await officialPool.fetch('gs');
    if (!records.length) return e.reply(`原神米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    const cards = records.map(r => this.officialCard(r, '原神'));
    const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
    return this.renderPoolImage(e, {
      game: '原神',
      title: '原神全版本卡池记录',
      subtitle: `共 ${records.length} 条记录 · 数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon: firstCover || GS_MARK_ICON,
      markWide: !!firstCover,
      cards
    });
  }

  async bh3CurrentPool(e) {
    logger.mark('[xhh][gacha_pool] 命中崩三补给菜单:', e.msg);
    // 崩三米游社公告接口近期不稳定，这里优先用本地补给记录，避免因为官方接口异常导致整条命令失败。
    const local = await this.loadBh3CurrentPools();
    if (local.length) {
      local.forEach((c, i) => { c.index = i + 1; c.versionTag = `#${c.index} ${c.version || '-'}`; });
      const markIcon = await this.getBh3HeaderSplashFromPools(local, BH3_MARK_ICON);
      let markWide = true;
      return this.renderPoolImage(e, {
        game: '崩坏3',
        title: '崩坏3当前卡池',
        subtitle: `v${CURRENT_VERSION.bh3} · 本地补给记录`,
        mode: 'bh3',
        markIcon,
        markWide,
        cards: local
      });
    }
    // 兜底：显示补给菜单
    const tool = new bh3_gacha(e);
    const auth = await tool.getAuth(e);
    if (auth.error) return e.reply(auth.error);
    const authkey = await tool.getAuthKey(auth.uid, auth.region, auth.stokenCookie);
    if (!authkey) return e.reply(`UID${auth.uid} 获取崩三 authkey 失败，请检查 stoken 是否有效。`);
    const menus = await tool.getMenus(auth.uid, authkey);
    if (!menus.length) return e.reply(`UID${auth.uid} 暂未获取到可用补给菜单。`);
    const menuCards = menus.map((m, i) => ({
      version: String(i + 1), title: m.label, type: '', time: '', s: m.label, a: '', weapon: false, index: i + 1, versionTag: `#${i + 1} ${String(i + 1)}`
    }));
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: '当前可查询补给',
      subtitle: `v${CURRENT_VERSION.bh3} · UID ${auth.uid} · 官方自助查询返回菜单`,
      mode: 'bh3',
      markIcon: BH3_MARK_ICON,
      markWide: true,
      cards: menuCards,
      note: '提示：这是官方自助查询返回的补给菜单，不是完整历史卡池。'
    });
  }

  async loadBh3PoolHistory() {
    try {
      // 优先读取 YAML，方便后续手动修正；JSON 仅作为兼容兜底。
      const data = fs.existsSync(BH3_POOL_HISTORY_YAML_PATH) ? yaml.get(BH3_POOL_HISTORY_YAML_PATH) : yaml.get(BH3_POOL_HISTORY_PATH);
      return this.sanitizeBh3PoolHistory(data);
    } catch (err) {
      logger.warn('[xhh][gacha_pool] 崩三历史卡池数据加载失败:', err);
      return null;
    }
  }

  sanitizeBh3PoolHistory(data) {
    if (!data?.pools?.length) return data;
    const charNames = new Set();
    try {
      const names = yaml.get('./plugins/xhh/system/default/bh3_js_names.yaml') || {};
      for (const [suit, aliasesRaw] of Object.entries(names)) {
        charNames.add(this.cleanBh3Name(suit));
        for (const alias of (Array.isArray(aliasesRaw) ? aliasesRaw : [])) charNames.add(this.cleanBh3Name(alias));
      }
    } catch (_) {}
    const isInvalidWeapon = pool => {
      if (pool?.type !== 'weapon' || pool?.target) return false;
      const s = this.cleanBh3Name(pool.s);
      // 旧社区整理里有“装备补给主UP写成角色名”的脏数据，例如 s=死生之律者。
      // 这类先过滤掉；如果后续在 YAML 里补 target 或改成真实武器名，就会正常显示。
      return !!s && charNames.has(s);
    };
    return {
      ...data,
      pools: data.pools.map(vp => ({
        ...vp,
        pools: (vp.pools || []).filter(pool => !isInvalidWeapon(pool))
      }))
    };
  }

  async loadBh3CurrentPools() {
    const data = await this.loadBh3PoolHistory();
    if (!data?.pools?.length) return [];
    const now = Date.now();
    let hit = data.pools.find(v => {
      const s = new Date(v.start).getTime();
      const e = new Date(v.end).getTime();
      return !Number.isNaN(s) && !Number.isNaN(e) && now >= s && now <= e;
    });
    if (!hit) hit = data.pools.find(v => v.version === CURRENT_VERSION.bh3) || data.pools[0];
    const maps = await this.getBh3WikiMaps();
    return Promise.all(hit.pools.map(p => this.bh3PoolToCard({ ...p, version: hit.version, start: hit.start, end: hit.end }, maps)));
  }

  async bh3PoolToCard(pool, maps = null) {
    const weapon = pool.type === 'weapon';
    const icon = await this.getBh3HistoryIcon(pool.s || '', weapon, maps);
    return {
      version: pool.version || '-',
      title: pool.name || '',
      type: weapon ? '装备补给' : '角色补给',
      time: pool.start && pool.end ? `${pool.start.slice(0, 10)} ~ ${pool.end.slice(0, 10)}` : '',
      s: pool.s || '-',
      a: Array.isArray(pool.a) ? pool.a.join(' / ') : (pool.a || '-'),
      img: '',
      icon,
      weapon
    };
  }

  async bh3VersionPool(e) {
    logger.mark('[xhh][gacha_pool] 命中崩三版本卡池:', e.msg);
    const data = await this.loadBh3PoolHistory();
    if (!data?.pools?.length) return e.reply('崩三历史卡池数据暂不可用。');
    const m = e.msg.match(/(?:崩三|崩坏3|崩坏三|BH3)v?(\d+\.\d+)(上半|下半)?(卡池|补给)/);
    if (!m) return false;
    const [, version, phase] = m;
    const versionPools = data.pools.filter(p => p.version === version && (!phase || p.phase === phase));
    if (!versionPools.length) return e.reply(`未查询到崩坏3 v${version}${phase || ''} 卡池数据。`);
    const pools = versionPools.flatMap(v => v.pools.map(p => ({ ...p, version: v.version, phase: v.phase, start: v.start, end: v.end })));
    const maps = await this.getBh3WikiMaps();
    const cards = await Promise.all(pools.map(async (p, i) => { const c = await this.bh3PoolToCard(p, maps); c.index = i + 1; c.versionTag = `#${c.index} ${c.version || '-'}`; return c; }));
    const markIcon = await this.getBh3HeaderSplashFromPools(cards, BH3_MARK_ICON);
    let markWide = true;
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: `v${phase ? `${version}${phase}` : version} 补给记录`,
      subtitle: phase ? `${pools[0].start?.slice(0, 10)} ~ ${pools[0].end?.slice(0, 10)}` : '历史版本补给记录',
      mode: 'bh3',
      markIcon,
      markWide,
      cards
    });
  }

  async bh3NameHistory(e) {
    logger.mark('[xhh][gacha_pool] 命中崩三名称卡池:', e.msg);
    const name = e.msg.replace(/^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)/, '').replace(/(卡池|补给)$/, '').trim();
    if (!name) return false;
    return this.replyBh3NameHistory(e, name, false);
  }

  async replyBh3NameHistory(e, name, silent = false) {
    const data = await this.loadBh3PoolHistory();
    if (!data?.pools?.length) return silent ? false : e.reply('崩三历史卡池数据暂不可用。');
    if (!name) return false;
    // “希儿/芽衣/琪亚娜”这类本体名会对应多个装甲，不能只映射到第一套装甲。
    // 这里展开为候选集合，查询“崩三希儿卡池”时能同时命中愈生佑翎/死生之律者/魇夜星渊等记录。
    const queryNames = this.getBh3NameCandidates(name);
    const cleanQueries = [...new Set(queryNames.map(v => this.cleanBh3Name(v)).filter(Boolean))];
    const hitName = v => {
      const raw = String(v || '');
      const clean = this.cleanBh3Name(raw);
      if (!clean) return false;
      return queryNames.some(q => raw === q || raw.includes(q) || q.includes(raw))
        || cleanQueries.some(q => clean === q || clean.includes(q) || q.includes(clean));
    };
    const records = [];
    for (const vp of data.pools) {
      const matchedPools = [];
      for (const pool of vp.pools) {
        const aList = Array.isArray(pool.a) ? pool.a : String(pool.a || '').split(/[，,/]/).filter(Boolean);
        const relatedNames = [
          pool.s,
          ...aList,
          pool.target,
          ...(Array.isArray(pool.related) ? pool.related : [])
        ];
        if (relatedNames.some(hitName)) {
          const hitMain = hitName(pool.s) || hitName(pool.target) || (Array.isArray(pool.related) && pool.related.some(hitName));
          // 只有命中主UP/装备target时才自动带同期开的装备补给；
          // 如果只是“某角色作为A/SP副UP出现”，不要把同一期别人的专属装备也带出来。
          matchedPools.push({ pool, attachWeapon: pool.type !== 'weapon' && hitMain });
        }
      }
      if (matchedPools.length) {
        // 查询主UP角色时，把同一期装备补给展示出来；查询A/SP副UP时只展示命中的角色补给。
        const shouldAttachWeapon = matchedPools.some(v => v.attachWeapon);
        const related = vp.pools.filter(pool => matchedPools.some(v => v.pool === pool) || (shouldAttachWeapon && pool.type === 'weapon'));
        for (const pool of related) {
          records.push({ ...pool, version: vp.version, phase: vp.phase, start: vp.start, end: vp.end });
        }
      }
    }
    if (!records.length) return silent ? false : e.reply(`未找到【${name}】的崩坏3补给记录。`);
    const sections = await this.buildBh3HistorySections(records, name, queryNames);
    if (sections.length) {
      return this.renderBh3Logs(e, sections);
    }
    const first = records[0];
    const rarity = hitName(first.s) ? 'S级' : 'A级';
    const type = first.type === 'weapon' ? '武器' : '角色';
    let markIcon = BH3_MARK_ICON;
    let markWide = true;
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: `${name} 补给记录`,
      subtitle: `${rarity}${type} · 共 ${records.length} 次记录`,
      mode: 'gs-history',
      markIcon,
      markWide,
      cards: sections
    });
  }

  cleanBh3Name(name = '') {
    return String(name || '')
      .replace(/[\s「」『』【】［］()（）·・•!！♪♫♥❤☆★△▽▼▲×]/g, '')
      .replace(/^(真我|薪炎|终焉|始源|空之|理之|雷之|识之|死生|人之|天元|月下|戒律|螺旋|黄金|繁星|无限|浮生|鏖灭|旭光|刹那|救世)之律者/g, '$1律者')
      .trim();
  }

  getBh3NameCandidates(name = '') {
    const raw = String(name || '').trim();
    const clean = this.cleanBh3Name(raw);
    const set = new Set([raw].filter(Boolean));
    try {
      const names = yaml.get('./plugins/xhh/system/default/bh3_js_names.yaml');
      if (names) {
        for (const [suit, aliasesRaw] of Object.entries(names)) {
          const aliases = Array.isArray(aliasesRaw) ? aliasesRaw : [];
          const all = [suit, ...aliases].filter(Boolean);
          const cleans = all.map(v => this.cleanBh3Name(v)).filter(Boolean);
          const exactHit = all.includes(raw) || cleans.includes(clean);
          const fuzzyHit = clean.length >= 2 && cleans.some(v => v.length >= 2 && (v.includes(clean) || clean.includes(v)));
          if (exactHit || fuzzyHit) {
            for (const v of all) set.add(v);
          }
        }
      }
    } catch (_) {}
    return [...set];
  }


  async getBh3CharacterSplash(name = '') {
    if (!name) return '';
    const candidates = this.getBh3NameCandidates(name);
    const targets = candidates.map(v => this.cleanBh3Name(v)).filter(Boolean);
    if (!targets.length) return '';
    try {
      const listUrl = 'https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki/v1/home/content/list?app_sn=bh3_wiki&channel_id=18';
      const listJson = await fetch(listUrl, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
      const list = listJson?.data?.list?.[0]?.list || [];
      const hit = list.find(item => targets.includes(this.cleanBh3Name(item.title)))
        || list.find(item => targets.some(t => this.cleanBh3Name(item.title).includes(t) || t.includes(this.cleanBh3Name(item.title))));
      if (!hit?.content_id) return hit?.icon || '';
      const detailUrl = `https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki/v1/content/info?app_sn=bh3_wiki&content_id=${hit.content_id}`;
      const detail = await fetch(detailUrl, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
      const content = detail?.data?.content || {};
      const imgs = [];
      for (const section of content.contents || []) {
        const text = String(section.text || '');
        const matches = text.matchAll(/data-data="([^"]+)"/g);
        for (const match of matches) {
          try {
            const arr = JSON.parse(decodeURIComponent(match[1]));
            for (const part of Array.isArray(arr) ? arr : []) {
              const data = part?.data || {};
              if (data.avatar) imgs.push(data.avatar);
            }
          } catch (_) {}
        }
      }
      // 只返回角色立绘/头像大图，不把 S/SSS 阶级图标或普通 icon 当成顶部立绘。
      return this.randomPick([
        ...imgs,
        content.avatar_url
      ]);
    } catch (err) {
      logger.warn?.('[xhh][gacha_pool] 崩三角色立绘获取失败:', name, err);
      return '';
    }
  }

  getBh3IconNameCandidates(name = '') {
    const raw = String(name || '').trim();
    const set = new Set([raw].filter(Boolean));
    const aliasMap = {
      '原罪·双生': ['原罪猎人', '彼岸双生'],
      '原罪双生': ['原罪猎人', '彼岸双生'],
      '圣女祈祷·十字星尘': ['圣女祈祷'],
      '圣女祈祷十字星尘': ['圣女祈祷'],
      // 圣痕套装名不是 Wiki 单件条目名，取套装三件中的第一件作为卡池小图代表。
      '花愈朝夕': ['希儿·晨蕊摇光(上)', '希儿·花寄嘱念(中)', '希儿·芳诲传薪(下)'],
      '岁岁如新': ['芽衣·璨光映愿(上)', '芽衣·挚礼盈门(中)', '芽衣·华彩佑夜(下)'],
      // 爱莉希雅/爱愿妖精专属圣痕套装名，对应 Wiki 单件圣痕条目。
      '芳时晏然': ['爱莉希雅·悠然漫话(上)', '爱莉希雅·翩然流光(中)', '爱莉希雅·焕然愿景(下)'],
      // 真我·人之律者旧专属圣痕套装，Wiki 以单件“爱莉希雅·无瑕之人”收录。
      '度法衡诗': ['爱莉希雅 · 无瑕之人(上)', '爱莉希雅 · 无瑕之人(中)', '爱莉希雅 · 无瑕之人(下)']
    };
    const clean = this.cleanBh3Name(raw);
    for (const [k, list] of Object.entries(aliasMap)) {
      if (raw === k || clean === this.cleanBh3Name(k)) {
        for (const v of list) set.add(v);
      }
    }
    // 兼容武器/圣痕别名表里的短名：例如“澄爱挚语”可反查“澄爱挚语·馨愿”。
    for (const file of [
      './plugins/xhh/system/default/bh3_wq_names.yaml',
      './plugins/xhh/system/default/bh3_syw_names.yaml',
      './plugins/xhh/system/default/bh3_js_names.yaml'
    ]) {
      try {
        const data = yaml.get(file);
        if (!data) continue;
        for (const [title, aliasesRaw] of Object.entries(data)) {
          const aliases = Array.isArray(aliasesRaw) ? aliasesRaw : [];
          const all = [title, ...aliases].filter(Boolean);
          if (all.some(v => this.cleanBh3Name(v) === clean || (clean.length >= 2 && this.cleanBh3Name(v).includes(clean)))) {
            for (const v of all) set.add(v);
          }
        }
      } catch (_) {}
    }
    return [...set];
  }

  findBh3IconFromDir(dir = '', name = '', prefixes = []) {
    if (!fs.existsSync(dir)) return '';
    const target = this.cleanBh3Name(name);
    try {
      const files = fs.readdirSync(dir).filter(f => /\.(png|webp|jpg|jpeg)$/i.test(f));
      const exactNames = [];
      for (const prefix of prefixes) {
        for (const ext of ['png', 'webp', 'jpg', 'jpeg']) exactNames.push(`${prefix}${name}.${ext}`);
      }
      for (const file of exactNames) {
        const path = `${dir}/${file}`;
        if (fs.existsSync(path)) return fs.realpathSync(path);
      }
      for (const file of files) {
        const base = file.replace(/\.(png|webp|jpg|jpeg)$/i, '').replace(/^(char_|weapon_|stigmata_|圣痕_|角色_|武器_)/, '');
        const clean = this.cleanBh3Name(base);
        if (clean && target && (clean === target || clean.includes(target) || target.includes(clean))) {
          return fs.realpathSync(`${dir}/${file}`);
        }
      }
    } catch (_) {}
    return '';
  }

  async getBh3WikiMaps() {
    try {
      const helper = Object.create(bh3_gacha.prototype);
      const maps = await helper.getStarMaps();
      // getStarMaps 只取女武神/武器；装备补给还会展示圣痕套装，
      // 这里补圣痕图标映射，避免“花愈朝夕/岁岁如新”只能显示文字占位。
      try {
        const res = await fetch('https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki/v1/home/content/list?app_sn=bh3_wiki&channel_id=19');
        const json = await res.json();
        maps.stigmataIcon = maps.stigmataIcon || {};
        for (const item of json?.data?.list?.[0]?.list || []) {
          if (item?.title && item?.icon) maps.stigmataIcon[item.title] = item.icon;
        }
      } catch (err) {
        logger.warn?.('[xhh][gacha_pool] 崩三圣痕图标映射获取失败:', err);
      }
      return maps;
    } catch (err) {
      logger.warn?.('[xhh][gacha_pool] 崩三Wiki图标映射获取失败:', err);
      return { charIcon: {}, weaponIcon: {}, stigmataIcon: {} };
    }
  }

  findBh3WikiIcon(name = '', weapon = false, maps = {}, kind = '') {
    const dict = kind === 'stigmata' ? (maps.stigmataIcon || {}) : (weapon ? (maps.weaponIcon || {}) : (maps.charIcon || {}));
    const candidates = this.getBh3IconNameCandidates(name);
    const targets = candidates.map(v => this.cleanBh3Name(v)).filter(Boolean);
    if (!targets.length) return { title: name, url: '' };
    for (const [title, url] of Object.entries(dict)) {
      if (candidates.includes(title)) return { title, url };
    }
    for (const [title, url] of Object.entries(dict)) {
      const clean = this.cleanBh3Name(title);
      if (clean && targets.some(target => clean === target || clean.includes(target) || target.includes(clean))) return { title, url };
    }
    return { title: name, url: '' };
  }

  async getBh3HistoryIcon(name = '', weapon = false, maps = null) {
    const prefixes = weapon ? ['weapon_', ''] : ['char_', '角色_', ''];
    const dirs = [
      './plugins/xhh/data/bh3_gacha/icons',
      './plugins/xhh/resources/bh3logs/icons'
    ];
    for (const dir of dirs) {
      const icon = this.findBh3IconFromDir(dir, name, prefixes);
      if (icon) return icon;
    }

    // 复用崩三抽卡记录的 Wiki 图标来源：本地没缓存时现场拉取并写入 data/bh3_gacha/icons。
    if (maps) {
      // 装备补给数据里既可能是武器，也可能是圣痕套装；有时还会混入 A 级女武神名。
      // 按当前行类型 → 圣痕 → 反向角色/武器的顺序兜底。
      const hit = this.findBh3WikiIcon(name, weapon, maps);
      const stigmataHit = hit.url ? hit : this.findBh3WikiIcon(name, weapon, maps, 'stigmata');
      const fallbackHit = stigmataHit.url ? stigmataHit : this.findBh3WikiIcon(name, !weapon, maps);
      if (fallbackHit.url) {
        try {
          const helper = Object.create(bh3_gacha.prototype);
          const cacheType = hit.url ? (weapon ? 'weapon' : 'char') : (stigmataHit.url ? 'stigmata' : (!weapon ? 'weapon' : 'char'));
          await helper.cacheIcon(fallbackHit.title, fallbackHit.url, cacheType);
          for (const dir of dirs) {
            const icon = this.findBh3IconFromDir(dir, fallbackHit.title, prefixes) || this.findBh3IconFromDir(dir, name, prefixes);
            if (icon) return icon;
          }
          return fallbackHit.url;
        } catch (err) {
          logger.warn?.('[xhh][gacha_pool] 崩三卡池图标缓存失败:', name, err);
          return fallbackHit.url;
        }
      }
    }
    return '';
  }

  async buildBh3HistoryItem(name = '', rarity = 'four', weapon = false, highlightName = '', maps = null) {
    const clean = this.cleanBh3Name(name);
    const hits = (Array.isArray(highlightName) ? highlightName : [highlightName]).map(v => this.cleanBh3Name(v)).filter(Boolean);
    return {
      name,
      icon: await this.getBh3HistoryIcon(name, weapon, maps),
      rarity,
      weapon,
      highlight: !!clean && hits.some(hit => clean === hit || clean.includes(hit) || hit.includes(clean))
    };
  }

  async buildBh3HistorySections(records = [], query = '', queryNames = null) {
    const map = new Map();
    const maps = await this.getBh3WikiMaps();
    const highlights = Array.isArray(queryNames) ? queryNames : [query];
    for (const p of records) {
      const time = p.start && p.end ? `${p.start.slice(0, 10)} ~ ${p.end.slice(0, 10)}` : '';
      const key = `${p.version || '-'}${p.phase || ''}|${time}`;
      if (!map.has(key)) map.set(key, { version: `${p.version || '-'}${p.phase || ''}`, time, rows: [] });
      const weapon = p.type === 'weapon';
      const items = [await this.buildBh3HistoryItem(p.s || '-', 'five', weapon, highlights, maps)];
      for (const a of (Array.isArray(p.a) ? p.a : String(p.a || '').split(/[，,/]/).filter(Boolean))) {
        items.push(await this.buildBh3HistoryItem(a, 'four', weapon, highlights, maps));
      }
      map.get(key).rows.push({ title: weapon ? '装备补给' : '角色补给', weapon, items });
    }
    return [...map.values()];
  }

  async bh3AllPool(e) {
    logger.mark('[xhh][gacha_pool] 命中崩三全卡池:', e.msg);
    const data = await this.loadBh3PoolHistory();
    if (!data?.pools?.length) return e.reply('崩三历史卡池数据暂不可用。');
    const versions = [...new Set(data.pools.map(p => p.version))].reverse();
    const chunks = versions.map(v => {
      const vp = data.pools.find(p => p.version === v);
      const lines = [`【v${v}】`];
      if (vp) {
        for (const p of vp.pools) {
          lines.push(`${vp.version}${vp.phase} ${p.type === 'weapon' ? '武' : '角'}：S-${p.s} | A-${Array.isArray(p.a) ? p.a.join('，') : p.a}`);
        }
      }
      return lines.join('\n');
    });
    const title = '崩坏3全版本补给记录';
    const msg = chunks.length > 8 ? await makeForwardMsg(e, [title, ...chunks], title) : [title, ...chunks];
    return e.reply(msg);
  }

  async bh3PoolUnsupported(e) {
    logger.mark('[xhh][gacha_pool] 命中崩三卡池兜底:', e.msg);
    return e.reply(`崩坏3当前版本已标记为 ${CURRENT_VERSION.bh3}。\n支持查询：\n#崩三卡池 / #崩三补给 - 查看当前可用补给菜单\n#崩三v8.9卡池 / #崩三v8.9上半卡池 - 查看指定版本补给\n#德丽莎卡池 / #琪亚娜补给 - 查看角色历史补给\n#崩三卡池历史 / #崩三补给全 - 查看全版本记录`);
  }
}
