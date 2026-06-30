import { yaml, mhy, api } from '#xhh';
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

const areaMap = {
  4: '终极组',
};
function fmtArea(area) {
  return areaMap[area] || `第${area}组`;
}

export class bh3_battlefield extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三记忆战场',
      dsc: '崩坏3记忆战场战报',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(战场|记忆战场|战场战报)$', fnc: 'battlefield' },
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

  async battlefield(e) {
    const auth = await this.getAuth(e);
    if (!auth.uid) return sendMsg(e, '请先扫码绑定崩坏3账号');
    if (!auth.ck) return sendMsg(e, '未找到有效Cookie，请先扫码绑定');

    const { uid, region, ck } = auth;
    const headers = mhy.getHeaders(e, ck);

    let indexRes, bfRes;
    try {
      [indexRes, bfRes] = await Promise.all([
        api(e, { type: 'bh3_index', uid, headers, game: 'bh3', server: region }),
        api(e, { type: 'bh3_battle_field', uid, headers, game: 'bh3', server: region }),
      ]);
    } catch (err) {
      logger.error('[bh3_battlefield] API error:', err);
      return sendMsg(e, '查询失败，请稍后重试');
    }

    if (!indexRes || indexRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取玩家信息失败`);
    if (!bfRes || bfRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取战场数据失败`);

    const role = indexRes.data?.role || {};
    const stats = indexRes.data?.stats || {};
    const pref = indexRes.data?.preference || {};

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

    const collabRank = ['', 'S', 'SS', 'SSS'];

    const reports = (bfRes.data?.reports || []).sort(
      (a, b) => parseInt(b.time_second || 0) - parseInt(a.time_second || 0)
    );

    if (!reports.length) return sendMsg(e, `UID${uid} 暂无战场数据`);

    const latest = reports[0];
    const totalScore = latest.score || 0;
    const rank = latest.rank || 0;
    const rankingPct = latest.ranking_percentage || '0';
    const area = latest.area || 0;

    const battleInfos = (latest.battle_infos || []).slice(0, 3);

    const infoCards = battleInfos.map((bi) => {
      const boss = bi.boss || {};
      const bossIcon = absIcon(boss.avatar || '');
      const bossImg = bossIcon
        ? `<img src="${bossIcon}" alt="">`
        : `<span>${(boss.name || '?')[0]}</span>`;
      const bossName = boss.name || '未知Boss';
      const bossScore = bi.score || 0;

      const lineup = (bi.lineup || []).slice(0, 3).map(c => {
        const icon = absIcon(c.icon_path || '');
        const cname = c.name || '';
        const badge = rankBadge(charStars[cname]);
        if (icon) {
          return `<div class="char"><div class="char-icon-wrap"><img class="char-icon" src="${icon}" alt="">${badge}</div><div class="char-name">${cname}</div></div>`;
        }
        return `<div class="char"><div class="char-icon-wrap"><div class="char-icon char-placeholder">${(cname || '?')[0]}</div>${badge}</div><div class="char-name">${cname}</div></div>`;
      }).join('');

      const elf = bi.elf;
      const elfHtml = elf ? (() => {
        const eIcon = absIcon(elf.avatar || '');
        const eImg = eIcon ? `<img src="${eIcon}" alt="">` : `<span>${(elf.name || '?')[0]}</span>`;
        const isCollab = elf.is_collaborator;
        const rankText = isCollab ? (collabRank[elf.star] || 'S') : '★'.repeat(Math.min(elf.star || 1, 4));
        const rankClass = isCollab ? 'collab-rank' : 'elf-stars';
        return `<div class="elf-card"><div class="elf-icon">${eImg}</div><div class="${rankClass}">${rankText}</div><div class="elf-name">${elf.name || ''}</div></div>`;
      })() : '';

      return `<div class="report-card"><div class="boss-section"><div class="boss-icon">${bossImg}</div><div class="boss-name">${bossName}</div></div><div class="boss-score">${bossScore}</div><div class="lineup">${lineup}${elfHtml}</div></div>`;
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
      totalScore,
      rank,
      rankingPct,
      area: fmtArea(area),
      bg,
      infoCards,
      dataTime: moment().format('MM-DD HH:mm'),
    };

    let buf;
    try {
      buf = await puppeteer.render('小花火/bh3_battlefield/battlefield', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_battlefield/battlefield.html',
        saveId: 'bh3_battlefield',
      });
    } catch (err) {
      logger.error('[bh3_battlefield] render failed:', err);
    }

    if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);

    const lines = [
      `⚔️ UID${uid} 记忆战场战报`,
      `舰长: ${data.nickname}  Lv.${data.level}`,
      `${data.area} 总分:${totalScore}  ${rank}档  前${rankingPct}%`,
      ...battleInfos.map((bi, i) => {
        const boss = bi.boss || {};
        const chars = (bi.lineup || []).map(c => c.name || '').join('、');
        return `  #${i+1} ${boss.name || '?'} ${bi.score || 0}分\n  阵容: ${chars}`;
      }),
      `更新时间: ${data.dataTime}`,
    ];
    return sendMsg(e, lines.join('\n'));
  }
}
