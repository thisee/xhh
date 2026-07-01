import { yaml, mhy, api, pluginPriority } from '#xhh';
import fs from 'fs';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import puppeteer from '../../../lib/puppeteer/puppeteer.js';
import moment from 'moment';

function sendMsg(e, msg) {
  if (typeof msg === 'object' && msg.constructor?.name === 'Buffer') {
    const seg = segment.image(msg);
    if (e.group) return e.group.sendMsg([seg]);
    if (e.friend) return e.friend.sendMsg([seg]);
    return e.reply(seg);
  }
  if (e.group) return e.group.sendMsg([{ type: 'text', data: { text: msg } }]);
  if (e.friend) return e.friend.sendMsg([{ type: 'text', data: { text: msg } }]);
  return e.reply(msg);
}

function fmtTs(ts) {
  if (!ts) return '已结算';
  try {
    const sec = parseInt(ts);
    if (sec <= 0) return '已结算';
    const ms = sec > 1e12 ? sec : sec * 1000;
    return moment(ms).format('MM-DD HH:mm');
  } catch {
    return '已结算';
  }
}

function getSettleTs(r = {}) {
  return r.schedule_end || r.time_second || r.settled_time_second || r.settle_time_second || r.settle_time || r.end_time || r.finish_time || r.updated_time_second;
}

const ICON_BASE = 'https://api-takumi-static.mihoyo.com';

function absIcon(iconPath) {
  if (!iconPath) return '';
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) return iconPath;
  if (iconPath.startsWith('//')) return 'https:' + iconPath;
  if (iconPath.startsWith('/')) return ICON_BASE + iconPath;
  return iconPath;
}

const serverMap = {
  cn_gf01: '官服', cn_qd01: 'B服', os_usa: '美服', os_euro: '欧服',
  os_asia: '亚服', os_cht: '港澳台服', android01: '安卓官服', ios01: 'iOS服',
  bb01: '哔哩哔哩', pc01: '桌面服', yyb01: '应用宝服', hun01: '渠道1服', hun02: '渠道2服',
};

const abyssLevelMap = {
  1: '禁忌', 2: '原罪Ⅰ', 3: '原罪Ⅱ', 4: '原罪Ⅲ',
  5: '苦痛Ⅰ', 6: '苦痛Ⅱ', 7: '苦痛Ⅲ',
  8: '红莲', 9: '寂灭',
};

function fmtLevel(level) {
  return abyssLevelMap[level] || `Lv.${level}`;
}

function getMysRating(pref = {}) {
  const score = Number(pref.comprehensive_score || 0);
  if (score > 0) {
    if (score >= 90) return 'SSS';
    if (score >= 75) return 'SS';
    if (score >= 60) return 'S';
    if (score >= 45) return 'A';
    if (score >= 30) return 'B';
    return 'C';
  }
  const r = pref.comprehensive_rating;
  return r && /^[A-Z]{1,3}$/.test(r) ? r : 'C';
}

export class bh3_abyss extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三深渊',
      dsc: '崩坏3深渊战报',
      event: 'message',
      priority: pluginPriority('bh3_abyss', 100),
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(深渊|战报|超弦)$', fnc: 'abyss' },
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(旧深渊|原深渊)$', fnc: 'oldAbyss' },
      ],
    });
  }

  async getAuth(e) {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at') { qq = msg.qq; break; }
    }

    let uid = await redis.get(`xhh:bh3_uid:${qq}`);
    let region = uid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
    let ck = null;

    const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
    if (fs.existsSync(stokenPath)) {
      const stokenData = yaml.get(stokenPath) || {};
      if (!uid) {
        const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
        for (const key of Object.keys(stokenData)) {
          const entry = stokenData[key];
          if (bh3Regions.includes(entry?.region || '')) {
            uid = key;
            region = entry.region || region;
            break;
          }
        }
      }
      const entry = stokenData[uid];
      if (entry) {
        region = entry.region || region;
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

    return { qq, uid, region, ck };
  }

  async abyss(e) {
    return this._abyss(e, [
      { type: 'bh3_new_abyss', label: '超弦空间' },
      { type: 'bh3_old_abyss', label: '量子流形' },
    ]);
  }

  async oldAbyss(e) {
    return this._abyss(e, [
      { type: 'bh3_old_abyss', label: '旧深渊' },
    ]);
  }

  async _abyss(e, apiList) {
    const auth = await this.getAuth(e);
    if (!auth.uid) return sendMsg(e, '请先扫码绑定崩坏3账号');
    if (!auth.ck) return sendMsg(e, '未找到有效Cookie，请先扫码绑定');

    const { uid, region, ck } = auth;
    const headers = mhy.getHeaders(e, ck);

    let indexRes;
    try {
      indexRes = await api(e, { type: 'bh3_index', uid, headers, game: 'bh3', server: region });
    } catch (err) {
      logger.error('[bh3_abyss] API error:', err);
      return sendMsg(e, '查询失败，请稍后重试');
    }
    if (!indexRes || indexRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取玩家信息失败`);

    const role = indexRes.data?.role || {};
    const level = Number(role.level || 0);
    const queryList = level > 0 && level <= 80 && apiList.some(ap => ap.type === 'bh3_old_abyss')
      ? [{ type: 'bh3_old_abyss', label: '量子流形' }, ...apiList.filter(ap => ap.type !== 'bh3_old_abyss')]
      : apiList;

    let abyssRes, label = queryList[0].label;
    // Try multiple server values: bound region, inferred official/B服. 80级未突破玩家优先查量子流形。
    const serverValues = [...new Set([region, mhy.getServer(uid, 'bh3'), 'cn_gf01', 'cn_qd01'].filter(Boolean))];
    for (const sv of serverValues) {
      for (const ap of queryList) {
        label = ap.label;
        try {
          abyssRes = await api(e, { type: ap.type, uid, headers, game: 'bh3', server: sv, silent: true });
          if (abyssRes?.retcode === 0) break;
        } catch (_) {}
      }
      if (abyssRes?.retcode === 0) break;
    }
    if (!abyssRes || abyssRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取${label}数据失败`);

    const stats = indexRes.data?.stats || {};
    const pref = indexRes.data?.preference || {};
    const reports = (abyssRes.data?.reports || []).sort(
      (a, b) => parseInt(b.updated_time_second || b.time_second || b.settled_time_second || b.settle_time_second || b.schedule_end || b.settle_time || b.end_time || b.finish_time || 0) - parseInt(a.updated_time_second || a.time_second || a.settled_time_second || a.settle_time_second || a.schedule_end || a.settle_time || a.end_time || a.finish_time || 0)
    );

    if (!reports.length) return sendMsg(e, `UID${uid} 暂无${label}数据`);

    let charStars = {};
    try {
      const cr = await api(e, { type: 'bh3_character', uid, headers, game: 'bh3', server: region });
      if (cr?.retcode === 0 && cr.data?.characters) {
        for (const item of cr.data.characters) {
          const av = item.character?.avatar || {};
          if (av.name) charStars[av.name] = av.star || 0;
        }
      }
    } catch (_) {}

    function rankBadge(star) {
      if (!star || star <= 1) return '';
      if (star >= 5) return `<span class="star-badge" style="background:#f44">SSS</span>`;
      if (star === 4) return `<span class="star-badge" style="background:#f80">SS</span>`;
      if (star === 3) return `<span class="star-badge" style="background:#fd5">S</span>`;
      if (star === 2) return `<span class="star-badge" style="background:#8f8">A</span>`;
      return '';
    }

    const elfRank = ['', 'S', 'SS', 'SSS', 'SSS'];
    const isSimpleLevel = label === '量子流形' || label === '旧深渊';
    const simpleLevelMap = { 1: '禁忌', 2: '原罪', 3: '苦痛', 4: '红莲', 5: '寂灭' };
    const letterLevelMap = { S: '寂灭', A: '红莲', B: '苦痛', C: '原罪', D: '禁忌' };
    const fmtLv = lv => {
      if (lv === undefined || lv === null) return '?';
      if (typeof lv === 'string') {
        const clean = lv.replace(/^LV\.?/i, '').toUpperCase();
        if (letterLevelMap[clean]) return letterLevelMap[clean];
      }
      if (isSimpleLevel && simpleLevelMap[lv]) return simpleLevelMap[lv];
      return fmtLevel(lv);
    };

    const reportList = reports.slice(0, 8).map((r, ri) => {
      const bossAvatar = absIcon(r.boss?.avatar || '');
      const bossIcon = bossAvatar
        ? `<img src="${bossAvatar}" alt="">`
        : `<span>${(r.boss?.name || '?')[0]}</span>`;
      const bossName = r.boss?.name || '未知';
      const cupText = r.cup_number != null ? `${r.cup_number}杯` : '';
      const settledCup = r.settled_cup_number;
      const cupChange = settledCup ? ` (${settledCup > 0 ? '+' : ''}${settledCup})` : '';
      const lined = (r.lineup || []).map(c => {
        const icon = absIcon(c.icon_path || '');
        const cname = c.name || '';
        const badge = rankBadge(charStars[cname]);
        if (icon) {
          return `<div class="char"><div class="char-icon-wrap"><img class="char-icon" src="${icon}" alt="">${badge}</div><div class="char-name">${cname}</div></div>`;
        }
        return `<div class="char"><div class="char-icon-wrap"><div class="char-icon char-placeholder">${(cname || '?')[0]}</div>${badge}</div><div class="char-name">${cname}</div></div>`;
      }).join('');
      const elf = r.elf;
      const elfHtml = elf ? (() => {
        const eIcon = absIcon(elf.avatar || '');
        const eImg = eIcon ? `<img src="${eIcon}" alt="">` : `<span>${(elf.name || '?')[0]}</span>`;
        const rankText = elfRank[elf.star] || 'S';
        return `<div class="elf-card"><div class="elf-icon">${eImg}</div><div class="collab-rank">${rankText}</div><div class="elf-name">${elf.name || ''}</div></div>`;
      })() : '';
      return `<div class="report-card"><div class="card-header"><div class="level-badge">${fmtLv(r.level)}</div><div class="score-wrap"><div class="score">${r.score || 0}</div><div class="boss-name-right">${bossName}</div></div></div><div class="card-body"><div class="lineup-wrap"><div class="lineup">${lined}${elfHtml}</div></div><div class="boss-area"><div class="boss-icon">${bossIcon}</div><div class="right-info"><div class="ri-line">#${r.rank || 0}</div><div class="ri-line">${cupText}${cupChange}</div><div class="ri-line time">结算 ${fmtTs(getSettleTs(r))}</div></div></div></div></div>`;
    }).join('\n');

    const bgs = ['bg', 'bg1', 'IMG_20250717_034154'];
    const bg = bgs[Math.floor(Math.random() * bgs.length)];

    const data = {
      uid,
      region: serverMap[region] || region,
      nickname: role.nickname || '未知舰长',
      level: role.level || 0,
      avatarUrl: absIcon(role.AvatarUrl || ''),
      activeDays: stats.active_day_number || 0,
      rating: getMysRating(pref),
      label, bg,
      reportHtml: reportList,
      dataTime: moment().format('MM-DD HH:mm'),
    };

    let buf;
    try {
      buf = await puppeteer.render('小花火/bh3_abyss/abyss', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_abyss/abyss.html',
        saveId: 'bh3_abyss',
      });
    } catch (err) {
      logger.error('[bh3_abyss] render failed:', err);
    }

    if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);

    const lines = [
      `📊 UID${uid} ${data.label}战报`,
      `舰长: ${data.nickname}  Lv.${data.level}`,
      ...reports.slice(0, 4).map(r => {
        const chars = (r.lineup || []).map(c => c.name || '').join('、');
        return `[${fmtLevel(r.level)}] ${r.boss?.name || '未知'}  ${r.score || 0}分  #${r.rank || 0}\n  阵容: ${chars}\n  结算: ${fmtTs(getSettleTs(r))}`;
      }),
      `更新时间: ${data.dataTime}`,
    ];
    return sendMsg(e, lines.join('\n'));
  }
}
