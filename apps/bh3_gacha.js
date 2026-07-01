import { yaml, mhy, api, pluginPriority } from '#xhh';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import puppeteer from '../../../lib/puppeteer/puppeteer.js';

const DATA_DIR = './plugins/xhh/data/bh3_gacha';
const GET_AUTHKEY_URL = 'https://api-takumi.mihoyo.com/binding/api/genAuthKey';
const GACHA_MENUS_URL = 'https://public-operation-common.mihoyo.com/common/bh3_self_help_query/UserMenuQuery/GetMenus';
const GACHA_LOG_URL = 'https://public-operation-common.mihoyo.com/common/bh3_self_help_query/UserGachaQuery/GetUserGacha';
const BH3_WIKI_BASE = 'https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki/v1/home/content/list?app_sn=bh3_wiki';
let starMapCache = null;
const ICON_CACHE_DIR = './plugins/xhh/data/bh3_gacha/icons';


async function sendMsg(e, msg) {
  if (e.group) return e.group.sendMsg([{ type: 'text', data: { text: msg } }]);
  if (e.friend) return e.friend.sendMsg([{ type: 'text', data: { text: msg } }]);
  return e.reply(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function gachaHeaders() {
  return {
    'x-rpc-app_version': '2.73.1',
    'X-Requested-With': 'com.mihoyo.hyperion',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; PHK110 Build/SKQ1.221119.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.133 Mobile Safari/537.36 miHoYoBBS/2.73.1',
    'x-rpc-client_type': '5',
    Referer: 'https://webstatic.mihoyo.com/',
    Origin: 'https://webstatic.mihoyo.com/',
  };
}

export class bh3_gacha extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三抽卡记录',
      dsc: '崩坏3抽卡记录查询与刷新',
      event: 'message',
      priority: pluginPriority('bh3_gacha', 100),
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)?(抽卡记录|抽卡统计)$', fnc: 'gachaSummary' },
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)?(刷新|更新)抽卡记录$', fnc: 'refreshGacha' },
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)?全量(刷新|更新)抽卡记录$', fnc: 'fullRefreshGacha' },
      ],
    });
  }

  getGachaPath(uid) {
    return path.join(DATA_DIR, String(uid), 'gacha_logs.json');
  }

  loadGacha(uid) {
    const file = this.getGachaPath(uid);
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }

  saveGacha(uid, data) {
    const file = this.getGachaPath(uid);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  async getAuth(e) {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at') { qq = msg.qq; break; }
    }

    let uid = await redis.get(`xhh:bh3_uid:${qq}`);
    let region = uid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
    let stokenCookie = null;
    let ck = null;

    const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
    if (fs.existsSync(stokenPath)) {
      const stokenData = yaml.get(stokenPath) || {};
      if (!uid) {
        for (const key of Object.keys(stokenData)) {
          const entry = stokenData[key];
          if (entry?.region?.includes('cn_') || entry?.region) {
            uid = key;
            region = entry.region || region;
            break;
          }
        }
      }
      const entry = stokenData[uid];
      if (entry) {
        region = entry.region || region;
        stokenCookie = entry.ck_stoken || (entry.stuid && entry.stoken ? `stuid=${entry.stuid};stoken=${entry.stoken};${entry.mid ? `mid=${entry.mid};` : ''}` : null);
        if (entry.stuid) {
          try {
            const nu = await NoteUser.create(qq);
            for (const ltuid in nu.mysUsers || {}) {
              if (String(ltuid) === String(entry.stuid)) {
                ck = nu.mysUsers[ltuid].ck;
                break;
              }
            }
          } catch (_) {}
        }
      }
    }

    if (!uid) {
      try { uid = (await NoteUser.create(qq)).getUid('bh3'); } catch (_) {}
    }
    if (!region) region = 'cn_gf01';

    if (!stokenCookie) {
      return { error: '未找到 stoken，抽卡记录需要先扫码绑定/保存 stoken 后才能生成 authkey。' };
    }
    if (!ck) {
      try {
        const nu = await NoteUser.create(qq);
        for (const ltuid in nu.mysUsers || {}) {
          if (nu.mysUsers[ltuid]?.ck) {
            ck = nu.mysUsers[ltuid].ck;
            break;
          }
        }
      } catch (_) {}
    }
    return { qq, uid, region, stokenCookie, ck };
  }

  async getAuthKey(uid, region, stokenCookie) {
    const body = {
      auth_appid: 'webview_gacha',
      game_biz: 'bh3_cn',
      game_uid: String(uid),
      region,
    };
    const bodyStr = JSON.stringify(body);
    const res = await fetch(GET_AUTHKEY_URL, {
      method: 'POST',
      headers: {
        Cookie: stokenCookie,
        DS: mhy.getDs2('', bodyStr, 4),
        'Content-Type': 'application/json',
        'User-Agent': 'okhttp/4.8.0',
        'x-rpc-app_version': '2.73.1',
        'x-rpc-sys_version': '12',
        'x-rpc-client_type': '5',
        'x-rpc-channel': 'mihoyo',
        'x-rpc-device_id': mhy.getDeviceGuid().replace(/-/g, ''),
        'x-rpc-device_name': 'Mi 10',
        'x-rpc-device_model': 'Mi 10',
        Referer: 'https://app.mihoyo.com',
        Host: 'api-takumi.mihoyo.com',
      },
      body: bodyStr,
    }).then(r => r.json());
    if (res?.retcode === 0 && res.data?.authkey) return res.data.authkey;
    logger.warn('[xhh][bh3_gacha] genAuthKey failed:', JSON.stringify(res));
    return null;
  }

  gachaBaseParams(uid, authkey, type = '1') {
    return new URLSearchParams({
      page_id: '5',
      auth_appid: 'csc',
      game_biz: 'bh3_cn',
      lang: 'zh-cn',
      authkey,
      authkey_ver: '1',
      sign_type: '2',
      community_select_uid: String(uid),
      bbs_auth_required: 'true',
      bbs_game_role_required: 'bh3_cn',
      app_client: 'bbs',
      source: 'service-center',
      source_point: 'SvcCenterSelf',
      win_direction: 'portrait',
      type: String(type),
    });
  }

  isValidGachaMenuName(name = '') {
    name = String(name);
    if (!name) return false;
    // GetMenus 的不同 type 会混入自助查询菜单，例如水晶记录/充值记录/礼包币记录/材料等，
    // 这些不是补给卡池，不能作为抽卡池统计。
    if (/水晶|充值|礼包币|材料/.test(name)) return false;
    if (/^(角色|武器|圣痕)$/.test(name)) return false;
    return /补给|扩充|精准|家园|协同者|人偶|服装/.test(name);
  }

  async getMenus(uid, authkey) {
    const menus = [];
    const seen = new Set();
    // BBBUID 默认从 type=1 开始；实测不同账号/服务器可用菜单分布在 2/3/4
    // 这里逐个探测并合并，避免 type=1 返回空数组时误判失败。
    for (const menuType of ['1', '2', '3', '4']) {
      const params = this.gachaBaseParams(uid, authkey, menuType);
      const res = await fetch(`${GACHA_MENUS_URL}?${params.toString()}`, {
        headers: gachaHeaders(),
      }).then(r => r.json());
      logger.mark(`[xhh][bh3_gacha] GetMenus type=${menuType} response:`, JSON.stringify(res));
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.list) ? res.data.list : Array.isArray(res?.data?.menus) ? res.data.menus : [];
      for (const menu of list) {
        const label = menu.label || menu.name || '';
        if (!this.isValidGachaMenuName(label)) continue;
        const key = `${menu.type || ''}:${label}`;
        if (!seen.has(key)) {
          seen.add(key);
          menus.push({ ...menu, label });
        }
      }
    }
    return menus;
  }

  parseRecord(item = []) {
    const ret = {};
    for (const pair of item) {
      if (pair.label === '补给时间') ret.time = pair.value;
      if (pair.label === '补给内容') ret.content = pair.value;
    }
    return ret.time && ret.content ? ret : null;
  }

  async fetchGachaType(uid, authkey, gachaType) {
    const records = [];
    for (let page = 1; page < 999; page++) {
      const params = this.gachaBaseParams(uid, authkey, gachaType);
      params.set('page', String(page));
      params.set('size', '20');
      params.set('end_id', '0');
      const res = await fetch(`${GACHA_LOG_URL}?${params.toString()}`, {
        headers: gachaHeaders(),
      }).then(r => r.json());
      if (res?.retcode !== 0) logger.mark('[xhh][bh3_gacha] GetUserGacha response:', JSON.stringify(res));
      const list = res?.data?.list || [];
      if (!list.length) break;
      for (const raw of list) {
        const record = this.parseRecord(raw.item || []);
        if (record) records.push(record);
      }
      if (list.length < 10) break;
      await sleep(900);
    }
    return records;
  }

  async saveGachaLogs(e, force = false) {
    const auth = await this.getAuth(e);
    if (auth.error) return auth.error;
    const { uid, region, stokenCookie } = auth;
    const authkey = await this.getAuthKey(uid, region, stokenCookie);
    if (!authkey) return `UID${uid} 获取 authkey 失败，请确认 stoken 有效。`;
    const menus = await this.getMenus(uid, authkey);
    if (!menus.length) return `UID${uid} 获取卡池列表失败。`;

    const old = this.loadGacha(uid) || { uid, data: {} };
    const history = old.data || {};
    let totalAdd = 0;
    const deltas = [];

    for (const menu of menus) {
      const gachaType = String(menu.type || '');
      const gachaName = menu.label || `卡池${gachaType}`;
      if (!gachaType) continue;
      if (!history[gachaName]) history[gachaName] = [];
      const newRecords = await this.fetchGachaType(uid, authkey, gachaType);
      const oldCount = history[gachaName].length;
      if (force) {
        if (newRecords.length) {
          const minTime = newRecords.reduce((m, r) => !m || r.time < m ? r.time : m, '');
          const older = history[gachaName].filter(r => r.time < minTime);
          history[gachaName] = [...older, ...newRecords];
        }
      } else {
        const keys = new Set(history[gachaName].map(r => `${r.time}\u0000${r.content}`));
        for (const r of newRecords) {
          const key = `${r.time}\u0000${r.content}`;
          if (!keys.has(key)) {
            history[gachaName].push(r);
            keys.add(key);
          }
        }
      }
      history[gachaName].sort((a, b) => String(b.time).localeCompare(String(a.time)));
      const add = Math.max(history[gachaName].length - oldCount, 0);
      if (add > 0) deltas.push(`${gachaName} 新增 ${add} 条`);
      totalAdd += add;
    }

    this.saveGacha(uid, { uid, data_time: moment().format('YYYY-MM-DD HH:mm:ss'), data: history });
    if (!totalAdd) return `🌱UID${uid} 没有新增抽卡数据！`;
    return [`✅UID${uid} 抽卡记录更新成功，本次新增 ${totalAdd} 条`, ...deltas].join('\n');
  }

  extractCharacterName(content = '') {
    if (!content.startsWith('[角色]')) return '';
    return content.replace('[角色]', '').replace('角色卡', '').trim();
  }

  extractWeaponName(content = '') {
    if (!content.startsWith('[武器]')) return '';
    return content.replace('[武器]', '').trim();
  }

  getPoolType(gachaName = '') {
    if (/武器|装备/.test(gachaName)) return 'weapon';
    if (/协同者/.test(gachaName)) return 'partner';
    return 'char';
  }

  async getStarMaps() {
    if (starMapCache) return starMapCache;
    const char = {};
    const weapon = {};
    const charIcon = {};
    const weaponIcon = {};
    try {
      const [chars, weapons] = await Promise.all([
        fetch(`${BH3_WIKI_BASE}&channel_id=18`).then(r => r.json()),
        fetch(`${BH3_WIKI_BASE}&channel_id=20`).then(r => r.json()),
      ]);
      for (const item of chars?.data?.list?.[0]?.list || []) {
        let rank = 0;
        try {
          const ext = JSON.parse(item.ext || '{}');
          const filters = JSON.parse(ext.c_18?.filter?.text || '[]');
          if (filters.some(v => v === '初始阶级/S')) rank = 4;
          else if (filters.some(v => v === '初始阶级/A' || v === '初始阶级/SP')) rank = 3;
          else if (filters.some(v => v === '初始阶级/B')) rank = 2;
        } catch (_) {}
        if (rank) char[item.title] = rank;
        if (item.icon) charIcon[item.title] = item.icon;
      }
      for (const item of weapons?.data?.list?.[0]?.list || []) {
        let rank = 0;
        try {
          const ext = JSON.parse(item.ext || '{}');
          const filters = JSON.parse(ext.c_20?.filter?.text || '[]');
          for (const v of filters) {
            const m = String(v).match(/(?:武器)?星级\/(\d)星|(?:武器)?星级\/(五星|四星|三星)/);
            if (m) {
              rank = m[1] ? Number(m[1]) : ({ 五星: 5, 四星: 4, 三星: 3 }[m[2]] || 0);
              break;
            }
          }
        } catch (_) {}
        if (rank) weapon[item.title] = rank;
        if (item.icon) weaponIcon[item.title] = item.icon;
      }
      logger.mark(`[xhh][bh3_gacha] star maps: char=${Object.keys(char).length}, weapon=${Object.keys(weapon).length}`);
    } catch (err) {
      logger.warn?.('[xhh][bh3_gacha] 获取出金星级映射失败:', err);
    }
    starMapCache = { char, weapon, charIcon, weaponIcon };
    return starMapCache;
  }

  async getPlayerInfo(e, auth = {}) {
    const uid = auth.uid;
    const server = auth.region || mhy.getServer(uid, 'bh3');
    const info = {
      avatarUrl: '',
      nickname: '',
      userLevel: 0,
      serverName: '',
    };
    if (!uid || !auth.ck) return info;
    try {
      const headers = mhy.getHeaders(e, auth.ck);
      const res = await api(e, {
        type: 'bh3_index',
        uid,
        headers,
        game: 'bh3',
        server,
      });
      if (res?.retcode === 0 && res.data?.role) {
        info.avatarUrl = res.data.role.AvatarUrl || '';
        info.nickname = res.data.role.nickname || '';
        info.userLevel = res.data.role.level || 0;
        const region = res.data.role.region || server || '';
        const serverMap = {
          cn_gf01: '官服',
          cn_qd01: 'B服',
          os_usa: '美服',
          os_euro: '欧服',
          os_asia: '亚服',
          os_cht: '港澳台服',
          android01: '安卓官服',
          ios01: 'iOS服',
          bb01: '哔哩哔哩',
          pc01: '全平台（桌面）服',
          yyb01: '应用宝服',
          hun01: '渠道1服',
          hun02: '渠道2服',
        };
        info.serverName = serverMap[region] || region || '';
      }
      if (!info.avatarUrl) {
        const char = await api(e, {
          type: 'bh3_character',
          uid,
          headers,
          game: 'bh3',
          server,
        });
        if (char?.retcode === 0 && char.data?.characters?.length) {
          info.avatarUrl = char.data.characters[0].character?.avatar?.icon_path || '';
        }
      }
      if (info.avatarUrl) {
        info.avatarUrl = await this.cacheIcon(`player_${uid}`, info.avatarUrl, 'avatar') || await this.ensureAbsoluteUrl(info.avatarUrl) || info.avatarUrl;
      }
    } catch (err) {
      logger.warn?.('[xhh][bh3_gacha] 获取玩家头像失败:', err);
    }
    return info;
  }

  async ensureAbsoluteUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://api-takumi-static.mihoyo.com${url}`;
    return `https://${url}`;
  }

  async cacheIcon(name, url, type = 'item') {
    if (!url) return '';
    const absUrl = await this.ensureAbsoluteUrl(url);
    try {
      fs.mkdirSync(ICON_CACHE_DIR, { recursive: true });
      const safe = `${type}_${name}`.replace(/[\\/:*?"<>|\s]/g, '_');
      const ext = new URL(absUrl).pathname.split('.').pop()?.split('?')[0] || 'png';
      const file = path.join(ICON_CACHE_DIR, `${safe}.${ext}`);
      if (!fs.existsSync(file)) {
        const res = await fetch(absUrl);
        if (!res.ok) return absUrl;
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(file, buf);
      }
      const relPath = path.relative(process.cwd(), file);
      return `../../../../../${relPath}`;
    } catch (err) {
      logger.warn?.('[xhh][bh3_gacha] icon cache failed:', name, err);
      return absUrl;
    }
  }

  async getItemIcon(content = '', poolType = 'char', maps = {}) {
    if (poolType === 'char') {
      const name = this.extractCharacterName(content);
      return this.cacheIcon(name, maps.charIcon?.[name], 'char');
    }
    if (poolType === 'weapon') {
      const name = this.extractWeaponName(content);
      return this.cacheIcon(name, maps.weaponIcon?.[name], 'weapon');
    }
    return '';
  }

  isRareRecord(content = '', poolType = 'char', maps = { char: {}, weapon: {} }) {
    if (poolType === 'partner') return content.startsWith('[协同者]');
    if (poolType === 'weapon') {
      const name = this.extractWeaponName(content);
      return !!name && (maps.weapon[name] || 0) >= 5;
    }
    const name = this.extractCharacterName(content);
    return !!name && (maps.char[name] || 0) >= 4;
  }

  async makeSummaryData(uid) {
    const log = this.loadGacha(uid);
    if (!log?.data || !Object.keys(log.data).length) return null;
    const maps = await this.getStarMaps();
    const pools = await Promise.all(Object.entries(log.data).filter(([name]) => this.isValidGachaMenuName(name)).map(async ([name, records]) => {
      const poolType = this.getPoolType(name);
      const sorted = [...records].sort((a, b) => String(a.time).localeCompare(String(b.time)));
      const items = [];
      let pullSinceLast = 0;
      const pullCounts = [];
      for (const r of sorted) {
        pullSinceLast++;
        if (this.isRareRecord(r.content, poolType, maps)) {
          items.push({
            ...r,
            pulls: pullSinceLast,
            display: poolType === 'char' ? this.extractCharacterName(r.content) : poolType === 'weapon' ? this.extractWeaponName(r.content) : r.content,
            icon: await this.getItemIcon(r.content, poolType, maps),
          });
          pullCounts.push(pullSinceLast);
          pullSinceLast = 0;
        }
      }
      items.reverse();
      const goldCount = items.length;
      const avgPulls = pullCounts.length ? (pullCounts.reduce((a, b) => a + b, 0) / pullCounts.length).toFixed(1) : '0';
      return {
        name,
        type: poolType,
        count: records.length,
        goldCount,
        currentPity: pullSinceLast,
        avgPulls,
        maxPulls: pullCounts.length ? Math.max(...pullCounts) : 0,
        latest: records[0]?.time || '',
        items: items.slice(0, 12),
      };
    }));
    const total = pools.reduce((sum, p) => sum + p.count, 0);
    if (!pools.length) return null;
    return { uid, total, data_time: log.data_time || '未知', pools };
  }

  async makeSummary(uid) {
    const data = await this.makeSummaryData(uid);
    if (!data) return `UID${uid} 还没有抽卡记录，请先使用 #刷新抽卡记录`;
    const hintMap = { char: 'S角色', weapon: '5星武器', partner: '协同者' };
    const lines = [`📊 UID${uid} 抽卡记录（共 ${data.total} 条）`, `更新时间：${data.data_time}`];
    for (const pool of data.pools) {
      lines.push('', `【${pool.name}】共 ${pool.count} 抽`);
      if (!pool.items.length) {
        lines.push(`  未抽到${hintMap[pool.type] || '高价值物品'}`);
        if (pool.currentPity > 0) lines.push(`  已连续 ${pool.currentPity} 抽未出`);
      } else {
        for (const item of pool.items) lines.push(`  ${item.content}  (${item.pulls}抽)  ${item.time}`);
        if (pool.currentPity > 0) lines.push(`  ---- 已连续 ${pool.currentPity} 抽未出 ----`);
      }
    }
    return lines.join('\n');
  }

  async renderSummary(e, uid, auth = {}) {
    const data = await this.makeSummaryData(uid);
    if (!data) return sendMsg(e, `UID${uid} 还没有抽卡记录，请先使用 #刷新抽卡记录`);
    try {
      const player = await this.getPlayerInfo(e, { ...auth, uid });
      const buf = await puppeteer.render('小花火/bh3_gacha/gacha', {
        ...data,
        ...player,
        bg: ['bg', 'bg1', 'IMG_20250717_034154'][Math.floor(Math.random() * 3)],
        sys: { scale: 'style=transform:scale(1)' },
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_gacha/gacha.html',
        saveId: 'gacha',
      });
      if (buf && Buffer.isBuffer(buf)) {
        const seg = segment.image(buf);
        if (e.group) return e.group.sendMsg([seg]);
        if (e.friend) return e.friend.sendMsg([seg]);
        return e.reply(seg);
      }
    } catch (err) {
      logger.error('[xhh][bh3_gacha] render failed:', err);
    }
    return sendMsg(e, await this.makeSummary(uid));
  }

  async gachaSummary(e) {
    const auth = await this.getAuth(e);
    if (auth.error) return sendMsg(e, auth.error);
    return this.renderSummary(e, auth.uid, auth);
  }

  async refreshGacha(e) {
    await sendMsg(e, '开始更新抽卡记录，需要一定时间，请勿重复更新；官方通常只能更新最近30天记录。');
    const msg = await this.saveGachaLogs(e, false);
    return sendMsg(e, msg);
  }

  async fullRefreshGacha(e) {
    await sendMsg(e, '开始全量刷新抽卡记录，需要一定时间，请勿重复更新。');
    const msg = await this.saveGachaLogs(e, true);
    return sendMsg(e, msg);
  }
}
