import { makeForwardMsg, render, yaml } from '#xhh';
import { bh3_gacha } from './bh3_gacha.js';
import officialPool from '../system/gacha_pool_official.js';

const ZZZ_HISTORY_URL = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/data/zzz/history.json';
const ZZZ_META_URL = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/data/meta.json';
const ZZZ_RAW_BASE = 'https://raw.githubusercontent.com/iaoongin/GachaClock/main/spider/';
const ZZZ_CACHE_KEY = 'xhh:zzz:pool_history:data:v2';
const ZZZ_CACHE_EXPIRE_KEY = 'xhh:zzz:pool_history:expire:v2';
const BH3_POOL_HISTORY_PATH = './plugins/xhh/system/default/bh3_gacha_pool_history.json';
const BH3_MARK_ICON = 'bh3_note/bh3_pool_banner.png';
const ZZZ_MARK_ICON = 'zzz_md/imgs/ellen.png';
const GS_MARK_ICON = 'gs_mark/paimon.png';
const CURRENT_VERSION = { zzz: '3.1', bh3: '8.9' };

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
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)(当前|本期|当期)?(卡池|补给)$', fnc: 'bh3CurrentPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)v?(\\d+\\.\\d+)(上半|下半)?(卡池|补给)$', fnc: 'bh3VersionPool' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)(卡池|补给)(统计|记录|历史|全)$', fnc: 'bh3AllPool' },
        // 原神卡池
        { reg: '^#*(小花火)?原神(当前|本期|当期)?卡池$', fnc: 'gsCurrentPool' },
        { reg: '^#*(小花火)?原神v?(\\d+\\.\\d+)(上半|下半)?卡池$', fnc: 'gsVersionPool' },
        { reg: '^#*(小花火)?原神(.+)卡池$', fnc: 'gsNameHistory' },
        { reg: '^#*(小花火)?原神(卡池)(统计|记录|历史|全)$', fnc: 'gsAllPool' },
        // 星铁卡池
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)(当前|本期|当期)?(卡池|跃迁)$', fnc: 'srCurrentPool' },
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)v?(\\d+\\.\\d+)(上半|下半)?(卡池|跃迁)$', fnc: 'srVersionPool' },
        { reg: '^#*(小花火)?(星铁|崩铁|星穹铁道)(?!v?\\d+\\.\\d+)(.+)(卡池|跃迁)$', fnc: 'srNameHistory' },
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
        { reg: '^#*(小花火)?(?!原神|星铁|崩铁|崩三|崩坏3|崩坏三|BH3|绝区零|ZZZ)(.+)(卡池|复刻)(统计|记录|历史)?$', fnc: 'genericNameHistory' }
      ]
    });
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
        img: '', title: '「光于指尖」音擎频段', type: '武器', version: '3.0上半',
        timer: '2026/06/17 10:00:00 ~ 2026/07/08 11:59:59', s: '光于指尖', a: ['含羞恶面', '好斗的阿炮']
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
      if (cache) return JSON.parse(cache);
      await redis.del(ZZZ_CACHE_EXPIRE_KEY);
    }
    try {
      const res = await fetch(ZZZ_HISTORY_URL, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = this.normalizeZzzData(await res.json());
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
      if (cache) return JSON.parse(cache);
      logger.error('[xhh][gacha_pool] 绝区零卡池数据获取失败:', err);
      return null;
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

  async renderPoolImage(e, data) {
    return render('gacha_pool/pool', data, { e, ret: true });
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

  officialCard(r, gameName = '') {
    return {
      version: r.version || '-',
      title: r.title,
      type: gameName || r.gameName || '米游社公告',
      time: r.createdAt ? `发布：${new Date(r.createdAt).toLocaleDateString('zh-CN')}` : '',
      s: '',
      a: r.url ? '点击公告原文查看完整UP详情' : '',
      img: r.cover || r.images?.[0] || '',
      weapon: false
    };
  }

  async officialCurrentPool(e) {
    const game = officialPool.resolveGame(e.msg);
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
        cards
      });
    }
    const meta = officialPool.games[game];
    logger.mark(`[xhh][gacha_pool] 命中${meta.name}官方卡池:`, e.msg);
    const { records, error, cache } = await officialPool.fetch(game);
    if (!records.length) return e.reply(`${meta.name}米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    const cards = records.map(r => this.officialCard(r, meta.name));
    return this.renderPoolImage(e, {
      game: meta.name,
      title: `${meta.name}米游社官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'zzz',
      markIcon: this.getMarkIcon(meta.name),
      markWide: this.getMarkWide(meta.name),
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
    return this.renderPoolImage(e, {
      game: meta.name,
      title: `${meta.name} v${version} 官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'zzz',
      markIcon: this.getMarkIcon(meta.name),
      markWide: this.getMarkWide(meta.name),
      cards
    });
  }

  async refreshOfficialPools(e) {
    logger.mark('[xhh][gacha_pool] 刷新米游社官方卡池数据:', e.msg);
    const results = await officialPool.refreshAll();
    const lines = results.map(r => {
      const meta = officialPool.games[r.game];
      return `${meta?.name || r.game}：${r.records.length} 条${r.error ? '（' + r.error + '）' : ''}`;
    });
    return e.reply('米游社官方卡池数据已刷新：\n' + lines.join('\n'));
  }

  async zzzCurrentPool(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零当前卡池:', e.msg);
    // 先尝试从米游社公告获取当前UP信息（含封面图）
    const { records } = await officialPool.fetch('zzz');
    if (records.length) {
      const cards = records.slice(0, 4).map(r => this.officialCard(r, '绝区零'));
      const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
      return this.renderPoolImage(e, {
        game: '绝区零',
        title: '绝区零当前卡池',
        subtitle: `数据来源：米游社公告 · v${CURRENT_VERSION.zzz}`,
        mode: 'zzz',
        markIcon: firstCover || ZZZ_MARK_ICON,
        markWide: false,
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
      return this.renderPoolImage(e, {
        game: '绝区零',
        title: '最新收录卡池',
        subtitle: `当前版本 ${CURRENT_VERSION.zzz}${latestStage}；展示最新收录内容`,
        mode: 'zzz',
        markIcon: ZZZ_MARK_ICON,
        cards: latest.map(p => this.poolToCard(p))
      });
    }
    const sample = pools[0];
    const { end } = this.parseTime(sample);
    const days = end ? Math.max(Math.ceil((end.getTime() - now.getTime()) / 86400000), 0) : '?';
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: '本期卡池',
      subtitle: `v${sample.version} · ${this.zzzPoolTime(sample)} · 剩余约${days}天`,
      mode: 'zzz',
      markIcon: ZZZ_MARK_ICON,
      cards: pools.map(p => this.poolToCard(p))
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
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: `v${phase ? pools[0].version : version} 卡池`,
      subtitle: phase ? this.zzzPoolTime(pools[0]) : '历史版本卡池记录',
      mode: 'zzz',
      markIcon: ZZZ_MARK_ICON,
      cards: pools.map(p => this.poolToCard(p))
    });
  }

  async zzzNameHistory(e) {
    logger.mark('[xhh][gacha_pool] 命中绝区零名称卡池:', e.msg);
    const name = e.msg.replace(/^#*(小花火)?(绝区零|ZZZ)/, '').replace(/(卡池|复刻)(统计|记录|历史)$/, '').replace(/卡池$/, '').trim();
    return this.replyZzzNameHistory(e, name, false);
  }

  async genericNameHistory(e) {
    const name = e.msg.replace(/^#*(小花火)?/, '').replace(/(卡池|复刻)(统计|记录|历史)?$/, '').trim();
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
    const hitName = v => {
      v = String(v || '');
      // 要求至少2字符匹配，避免"雅"误匹配"爱莉希雅"
      if (v === name || v.includes(name) || name.includes(v)) {
        if (v === name) return true;
        if (v.length >= 2 && name.length >= 2) return true;
      }
      return false;
    };
    const records = data.filter(p => hitName(p.s) || (Array.isArray(p.a) && p.a.some(hitName)));
    if (!records.length) return silent ? false : e.reply(`未找到【${name}】的绝区零卡池记录。`);
    const first = records[0];
    const rarity = hitName(first.s) ? 'S级' : 'A级';
    const type = first.type === '武器' ? '音擎' : '代理人';
    return this.renderPoolImage(e, {
      game: '绝区零',
      title: `${name} 卡池记录`,
      subtitle: `${rarity}${type} · 共 ${records.length} 次记录`,
      mode: 'zzz_history',
      markIcon: ZZZ_MARK_ICON,
      cards: records.map((p, i) => ({ ...this.poolToCard(p), index: i + 1 }))
    });
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
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: '星铁当前卡池',
        subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
        mode: 'sr',
        cards: records.slice(0, 6).map(r => this.officialCard(r, '星穹铁道'))
      });
    }
    const localCards = await this.loadSrLocalCards('current');
    if (localCards.length) {
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: '星铁当前卡池',
        subtitle: '本地历史卡池库兜底',
        mode: 'sr',
        cards: localCards
      });
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
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: `星铁 v${version}${phase || ''} 卡池`,
        subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
        mode: 'sr',
        cards: (filtered.length ? filtered : records).map(r => this.officialCard(r, '星穹铁道'))
      });
    }
    const localCards = await this.loadSrLocalCards(`${version}${phase || ''}`);
    if (localCards.length) {
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: `星铁 v${version}${phase || ''} 卡池`,
        subtitle: '本地历史卡池库',
        mode: 'sr',
        cards: localCards
      });
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
    const localCards = await this.loadSrLocalCards(name);
    if (localCards.length) {
      return this.renderPoolImage(e, {
        game: '星穹铁道',
        title: `${name} 卡池记录`,
        subtitle: `共 ${localCards.length} 条记录 · 本地历史卡池库`,
        mode: 'sr',
        cards: localCards
      });
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

  async loadSrLocalCards(type = '') {
    const data = yaml.get('./plugins/xhh/system/default/sr_logs.yaml');
    if (!Array.isArray(data)) return [];
    const query = this.normalizeSrName(type);
    const isCurrent = query === 'current';
    const cards = [];
    const currentVersion = '4.3';
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
        return this.renderPoolImage(e, {
          game: '原神',
          title: '原神当前卡池',
          subtitle: '本地卡池库兜底',
          mode: 'gs',
          markIcon: GS_MARK_ICON,
          markWide: true,
          cards: localCards
        });
      }
      return e.reply(`原神米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    }
    const cards = records.slice(0, 4).map(r => this.officialCard(r, '原神'));
    const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
    return this.renderPoolImage(e, {
      game: '原神',
      title: '原神当前卡池',
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon: firstCover || GS_MARK_ICON,
      markWide: !!firstCover,
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
        return this.renderPoolImage(e, {
          game: '原神',
          title: `原神 v${version}${phase || ''} 卡池`,
          subtitle: '本地历史卡池库',
          mode: 'gs',
          markIcon: GS_MARK_ICON,
          markWide: true,
          cards: localCards
        });
      }
      return e.reply(`原神 v${version} 未找到米游社官方卡池公告${error ? '：' + error : ''}`);
    }
    const cards = records.map(r => this.officialCard(r, '原神'));
    const firstCover = records[0]?.cover || records[0]?.images?.[0] || '';
    return this.renderPoolImage(e, {
      game: '原神',
      title: `原神 v${version}${phase || ''} 官方卡池`,
      subtitle: `数据来源：米游社公告${cache ? '（缓存）' : ''}`,
      mode: 'gs',
      markIcon: firstCover || GS_MARK_ICON,
      markWide: !!firstCover,
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
    const { records, error, cache } = await officialPool.fetch('gs');
    if (!records.length) return silent ? false : e.reply(`原神米游社公告卡池数据获取失败${error ? '：' + error : ''}`);
    const hit = records.filter(r => {
      const t = r.title || '';
      return t.includes(name);
    });
    if (!hit.length) {
      const localCards = await this.loadGsLocalCards(name);
      if (localCards.length) {
        return this.renderPoolImage(e, {
          game: '原神',
          title: `${name} 卡池记录`,
          subtitle: `共 ${localCards.length} 条记录 · 本地历史卡池库`,
          mode: 'gs',
          markIcon: GS_MARK_ICON,
          markWide: true,
          cards: localCards
        });
      }
      return silent ? false : e.reply(`未找到【${name}】的原神卡池记录。`);
    }
    const cards = hit.map(r => this.officialCard(r, '原神'));
    const firstCover = hit[0]?.cover || hit[0]?.images?.[0] || '';
    return this.renderPoolImage(e, {
      game: '原神',
      title: `${name} 卡池记录`,
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

  async loadGsLocalCards(type = '') {
    const data = yaml.get('./plugins/xhh/system/default/gslogs.yaml');
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
          cards.push({
            version: ver,
            title: i === 2 ? '武器活动祈愿' : (i === 3 ? '集录祈愿' : '角色活动祈愿'),
            type: '原神',
            time,
            s: String(line).split(',').slice(0, 2).join(' / '),
            a: String(line).split(',').slice(2).join(' / '),
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
      return this.renderPoolImage(e, {
        game: '崩坏3',
        title: '崩坏3当前卡池',
        subtitle: `v${CURRENT_VERSION.bh3} · 本地补给记录`,
        mode: 'bh3',
        markIcon: BH3_MARK_ICON,
        markWide: true,
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
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: '当前可查询补给',
      subtitle: `v${CURRENT_VERSION.bh3} · UID ${auth.uid} · 官方自助查询返回菜单`,
      mode: 'bh3',
      markIcon: BH3_MARK_ICON,
      markWide: true,
      cards: menus.map((m, i) => ({
        version: String(i + 1),
        title: m.label,
        type: '',
        time: '',
        s: m.label,
        a: '',
        weapon: false
      })),
      note: '提示：这是官方自助查询返回的补给菜单，不是完整历史卡池。'
    });
  }

  async loadBh3PoolHistory() {
    try {
      return yaml.get(BH3_POOL_HISTORY_PATH);
    } catch (err) {
      logger.warn('[xhh][gacha_pool] 崩三历史卡池数据加载失败:', err);
      return null;
    }
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
    return hit.pools.map(p => this.bh3PoolToCard({ ...p, version: hit.version, start: hit.start, end: hit.end }));
  }

  bh3PoolToCard(pool, version, phase) {
    return {
      version: pool.version || '-',
      title: pool.name || '',
      type: pool.type === 'weapon' ? '武器补给' : '角色补给',
      time: pool.start && pool.end ? `${pool.start.slice(0, 10)} ~ ${pool.end.slice(0, 10)}` : '',
      s: pool.s || '-',
      a: Array.isArray(pool.a) ? pool.a.join(' / ') : (pool.a || '-'),
      img: '',
      weapon: pool.type === 'weapon'
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
    let markIcon = BH3_MARK_ICON;
    let markWide = true;
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: `v${phase ? `${version}${phase}` : version} 补给记录`,
      subtitle: phase ? `${pools[0].start?.slice(0, 10)} ~ ${pools[0].end?.slice(0, 10)}` : '历史版本补给记录',
      mode: 'bh3',
      markIcon,
      markWide,
      cards: pools.map(p => this.bh3PoolToCard(p, version, phase))
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
    // 加载角色名映射（装甲名 → 角色名）
    let charMap = {};
    try {
      const names = yaml.get('./plugins/xhh/system/default/bh3_js_names.yaml');
      if (names) {
        for (const [suit, aliases] of Object.entries(names)) {
          if (Array.isArray(aliases)) {
            for (const alias of aliases) {
              if (!charMap[alias]) charMap[alias] = suit;
              if (!charMap[suit]) charMap[suit] = suit;
            }
          }
        }
      }
    } catch (_) {}
    // 将用户输入的角色名映射到装甲名
    const suitName = charMap[name] || name;
    const hitName = v => {
      v = String(v || '');
      return v === name || v === suitName || v.includes(name) || name.includes(v) || v.includes(suitName) || suitName.includes(v);
    };
    const records = [];
    for (const vp of data.pools) {
      for (const pool of vp.pools) {
        if (hitName(pool.s) || (Array.isArray(pool.a) && pool.a.some(hitName))) {
          records.push({ ...pool, version: vp.version, phase: vp.phase, start: vp.start, end: vp.end });
        }
      }
    }
    if (!records.length) return silent ? false : e.reply(`未找到【${name}】的崩坏3补给记录。`);
    const first = records[0];
    const rarity = hitName(first.s) ? 'S级' : 'A级';
    const type = first.type === 'weapon' ? '武器' : '角色';
    let markIcon = BH3_MARK_ICON;
    let markWide = true;
    return this.renderPoolImage(e, {
      game: '崩坏3',
      title: `${name} 补给记录`,
      subtitle: `${rarity}${type} · 共 ${records.length} 次记录`,
      mode: 'bh3_history',
      markIcon,
      markWide,
      cards: records.map((p, i) => ({ ...this.bh3PoolToCard(p), index: i + 1 }))
    });
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
