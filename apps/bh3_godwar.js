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
  if (!ts) return '';
  try {
    const sec = parseInt(ts);
    const ms = sec > 1e12 ? sec : sec * 1000;
    return moment(ms).format('MM-DD HH:mm');
  } catch {
    return '';
  }
}

function fmtCost(sec) {
  if (!sec) return '';
  const n = parseInt(sec);
  if (isNaN(n) || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
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

const levelMap = {
  303: '沦没', 304: '戒约', 305: '侵蚀', 306: '终尽',
};
function fmtPunish(v) {
  return levelMap[v] || `难度${v}`;
}

const attrMap = {
  1: 'fire', 2: 'ice', 3: 'thunder', 4: 'psychic', 5: 'physical', 7: 'quantum', 8: 'imaginary',
};

export class bh3_godwar extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三往世乐土',
      dsc: '崩坏3往世乐土数据',
      event: 'message',
      priority: pluginPriority('bh3_godwar', 100),
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(乐土|往世乐土)$', fnc: 'godwar' },
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

  async godwar(e) {
    const auth = await this.getAuth(e);
    if (!auth.uid) return sendMsg(e, '请先扫码绑定崩坏3账号');
    if (!auth.ck) return sendMsg(e, '未找到有效Cookie，请先扫码绑定');

    const { uid, region, ck } = auth;
    const headers = mhy.getHeaders(e, ck);

    let indexRes, gwRes;
    try {
      [indexRes, gwRes] = await Promise.all([
        api(e, { type: 'bh3_index', uid, headers, game: 'bh3', server: region }),
        api(e, { type: 'bh3_god_war', uid, headers, game: 'bh3', server: region }),
      ]);
    } catch (err) {
      logger.error('[bh3_godwar] API error:', err);
      return sendMsg(e, '查询失败，请稍后重试');
    }

    if (!indexRes || indexRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取玩家信息失败`);
    if (!gwRes || gwRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取乐土数据失败`);

    const role = indexRes.data?.role || {};
    const stats = indexRes.data?.stats || {};
    const pref = indexRes.data?.preference || {};

    const god = gwRes.data || {};
    const summary = god.summary || {};
    const avatarTranscript = god.avatar_transcript || [];
    const rawRecords = god.records || [];

    const hasData = avatarTranscript.length > 0 || rawRecords.length > 0;
    if (!hasData) return sendMsg(e, `UID${uid} 暂无往世乐土数据`);

    let charStars = {};
    let charFaceIcons = {};
    try {
      const cr = await api(e, { type: 'bh3_character', uid, headers, game: 'bh3', server: region });
      if (cr?.retcode === 0 && cr.data?.characters) {
        for (const item of cr.data.characters) {
          const av = item.character?.avatar || {};
          if (av.name) {
            const key = av.name.trim();
            charStars[key] = av.star || 0;
            if (av.icon_path) charFaceIcons[key] = av.icon_path;
          }
        }
      }
    } catch (_) {}

    function normName(s) {
      return (s || '').trim();
    }

    function rankBadge(star) {
      if (!star || star <= 1) return '';
      if (star >= 5) return `<span class="star-badge rank-sss" style="background:#f44">SSS</span>`;
      if (star === 4) return `<span class="star-badge rank-ss" style="background:#f80">SS</span>`;
      if (star === 3) return `<span class="star-badge rank-s" style="background:#fd5">S</span>`;
      if (star === 2) return `<span class="star-badge rank-a" style="background:#8f8">A</span>`;
      return '';
    }

    // Summary stats
    const summaryItems = [
      { label: '解锁装甲数', value: summary.avatar_numbers ?? 0 },
      { label: '满强化装甲数', value: summary.max_level_avatar_number ?? 0 },
      { label: '命定的歧路等级', value: summary.max_support_point ?? 0 },
      { label: '追忆之证数', value: summary.extra_item_number ?? 0 },
      { label: '最高挑战成绩', value: summary.max_challenge_score ?? 0 },
    ];
    const summaryHtml = summaryItems.map(s =>
      `<div class="stat-item"><div class="stat-val">${s.value}</div><div class="stat-lbl">${s.label}</div></div>`
    ).join('\n');

    // Armor transcript
    const transHtml = avatarTranscript.map(t => {
      const av = t.avatar || {};
      const name = av.name || '未知';
      const badge = rankBadge(av.star);
      const bgPath = absIcon(av.background_path || '');
      const bgStyle = bgPath ? ` style="background-image:url(${bgPath})"` : '';
      return `<div class="trans-card"${bgStyle}><div class="trans-bg-cover"></div><div class="trans-rank">${badge}</div><div class="trans-info"><div class="trans-name">${name} Lv.${t.level || '?'}</div><div class="trans-stats"><span>通关 ${t.challenge_success_times ?? 0}</span><span class="trans-div">|</span><span>最佳 ${t.max_challenge_score ?? 0}</span></div></div></div>`;
    }).join('\n');

    // Records
    const records = rawRecords.sort(
      (a, b) => parseInt(b.settle_time_second || 0) - parseInt(a.settle_time_second || 0)
    ).slice(0, 6);

    const collabRank = ['', 'S', 'SS', 'SSS'];
    const recordCards = records.map((r) => {
      const main = r.main_avatar || {};
      const mainIcon = absIcon(main.icon_path || '');
      const mainName = main.name || '未知';
      const mainStar = main.star || 0;

      function charHtml(c, label) {
        const name = c.name || '';
        const key = normName(name);
        // 挑战记录里 c.sec_part_icon 通常是更适合小头像的半身/头像裁切；
        // 角色列表的 icon_path 有些会偏上，圆形小框里容易只剩头发。
        const icon = absIcon(c.sec_part_icon || charFaceIcons[key] || c.icon_path || '');
        const star = c.star || 0;
        // 乐土支援/助战角色在游戏内固定按 SSS 展示，不能用玩家自己的角色阶级覆盖。
        const badge = rankBadge(label === '出战' ? (star || charStars[key]) : 5);
        if (!icon) return '';
        return `<div class="gw-char"><div class="gw-char-icon">${badge ? `<div class="gw-char-rank">${badge}</div>` : ''}<img src="${icon}" alt=""><div class="gw-char-label">${label}</div></div><div class="gw-char-name">${name}</div></div>`;
      }

      let chars = charHtml(main, '出战');
      chars += (r.support_avatars || []).slice(0, 2).map(s => charHtml(s, '支援')).join('');

      if (r.elf && r.elf.avatar) {
        const e = r.elf;
        const eIcon = absIcon(e.avatar || '');
        const isCollab = e.is_collaborator;
        const rankText = isCollab ? (collabRank[e.star] || 'S') : '★'.repeat(Math.min(e.star || 1, 4));
        chars += `<div class="gw-char gw-elf"><div class="gw-char-icon"><img src="${eIcon}" alt=""><div class="gw-char-label">人偶</div></div><div class="gw-elf-rank">${rankText}</div></div>`;
      }

      if (r.extra_item_icon) {
        chars += `<div class="gw-item"><img src="${absIcon(r.extra_item_icon)}" alt=""><span>追忆</span></div>`;
      }
      if (r.assistant_extra_item) {
        const ai = typeof r.assistant_extra_item === 'string' ? r.assistant_extra_item : (r.assistant_extra_item.icon || '');
        if (ai) chars += `<div class="gw-item"><img src="${absIcon(ai)}" alt=""><span>助战</span></div>`;
      }

      const buffs = (r.buffs || []).slice(0, 8);
      const buffHtml = buffs.map(b => {
        const bIcon = absIcon(b.icon || '');
        return `<div class="gw-buff"><img src="${bIcon}" alt=""><span>${b.number || 0}</span></div>`;
      }).join('');

      const cbuffs = r.challenge_buffs || [];
      const cbuffHtml = cbuffs.map(cb => {
        const name = cb.name || '增益';
        const cost = cb.cost ?? cb.level ?? '';
        return `<span class="gw-cbuff"><span class="gw-cbuff-name">${name}</span>${cost !== '' ? `<span class="gw-cbuff-level">Lv.${cost}</span>` : ''}</span>`;
      }).join('');

      const settle = fmtTs(r.settle_time_second);
      const cost = fmtCost(r.cost_time);
      const diffName = fmtPunish(r.punish_level);

      return `<div class="record-card"><div class="gw-top"><span>结算 ${settle}</span><span class="gw-diff">${diffName}</span><span>${cost}</span></div><div class="gw-body"><div class="gw-chars">${chars}</div><div class="gw-score"><div class="gw-score-val">${r.score || 0}</div><div class="gw-score-lbl">最高积分</div></div></div><div class="gw-buffs-row">${buffHtml}</div>${cbuffHtml ? `<div class="gw-cbuffs">${cbuffHtml}</div>` : ''}</div>`;
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
      rating: pref.comprehensive_rating || 'C',
      bg,
      summaryHtml,
      transHtml,
      recordCards,
      avatarTranscript,
      records,
      dataTime: moment().format('MM-DD HH:mm'),
    };

    let buf;
    try {
      buf = await puppeteer.render('小花火/bh3_godwar/godwar', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_godwar/godwar.html',
        saveId: 'bh3_godwar',
      });
    } catch (err) {
      logger.error('[bh3_godwar] render failed:', err);
    }

    if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);

    // Text fallback
    const lines = [
      `🌿 UID${uid} 往世乐土`,
      `舰长: ${data.nickname}  Lv.${data.level}`,
      `解锁装甲:${summary.avatar_numbers || 0} 满强化:${summary.max_level_avatar_number || 0} 最高分:${summary.max_challenge_score || 0}`,
      ...records.map((r, i) => {
        const main = r.main_avatar || {};
        const supports = (r.support_avatars || []).map(s => s.name || '').join('、');
        return `  #${i+1} ${main.name || '?'} + ${supports}  分数:${r.score || 0}  难度:${fmtPunish(r.punish_level)}  结算:${fmtTs(r.settle_time_second)}`;
      }),
      `更新时间: ${data.dataTime}`,
    ];
    return sendMsg(e, lines.join('\n'));
  }
}
