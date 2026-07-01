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

const attrMap = {
  1: '生物', 2: '异能', 3: '机械', 4: '量子', 5: '虚数', 6: '星尘',
};
const attrClassMap = {
  1: 'bio', 2: 'psy', 3: 'mech', 4: 'qua', 5: 'img', 6: 'sd',
};
const rankMap = ['', 'B', 'A', 'S', 'SS', 'SSS'];

function getMysRating(pref = {}) {
  const score = Number(pref.comprehensive_score || 0);
  // 米游社前端按百分制综合分展示档位；接口里的 comprehensive_rating 会出现滞后/旧档位。
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

export class bh3_profile extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三角色主页',
      dsc: '崩坏3角色主页卡片',
      event: 'message',
      priority: pluginPriority('bh3_profile', 100),
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(主页|角色主页|查询|角色查询)$', fnc: 'profile' },
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
        const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02', 'cn_gf01', 'cn_qd01'];
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

  buildCharacter(item) {
    const c = item.character || item || {};
    const av = c.avatar || c;
    const weapon = c.weapon || {};
    const stigmatas = Array.isArray(c.stigmatas) ? c.stigmatas.filter(s => s?.name) : [];
    const star = av.star || 0;
    const attr = av.attribute_id || 0;
    return {
      name: av.name || '未知装甲',
      level: av.level || 1,
      star,
      rank: rankMap[star] || `★${star}`,
      icon: absIcon(av.sec_part_icon || av.icon_path || av.large_background_path || ''),
      attrName: attrMap[attr] || '未知',
      attrClass: attrClassMap[attr] || 'unknown',
      weaponName: weapon.name || '未装备武器',
      weaponIcon: absIcon(weapon.icon || ''),
      weaponLevel: weapon.level || 0,
      stigmatas: stigmatas.slice(0, 3).map(s => ({
        name: String(s.name || '').replace(/【上】|【中】|【下】|\[上\]|\[中\]|\[下\]|\(上\)|\(中\)|\(下\)|〔上〕|〔中〕|〔下〕/g, ''),
        icon: absIcon(s.icon || ''),
        level: s.level || 0,
      })),
    };
  }

  async profile(e) {
    const auth = await this.getAuth(e);
    if (!auth.uid) return sendMsg(e, '请先扫码绑定崩坏3账号');
    if (!auth.ck) return sendMsg(e, '未找到有效Cookie，请先扫码绑定');

    const { uid, region, ck } = auth;
    const headers = mhy.getHeaders(e, ck);

    let indexRes, charRes;
    try {
      [indexRes, charRes] = await Promise.all([
        api(e, { type: 'bh3_index', uid, headers, game: 'bh3', server: region }),
        api(e, { type: 'bh3_character', uid, headers, game: 'bh3', server: region }),
      ]);
    } catch (err) {
      logger.error('[bh3_profile] API error:', err);
      return sendMsg(e, '查询失败，请稍后重试');
    }

    if (!indexRes || indexRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取玩家信息失败`);
    if (!charRes || charRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取角色信息失败`);

    const role = indexRes.data?.role || {};
    const stats = indexRes.data?.stats || {};
    const pref = indexRes.data?.preference || {};
    const rawCharacters = charRes.data?.characters || [];
    const built = rawCharacters.map(item => this.buildCharacter(item));
    // API returns pinned first (前5为置顶)，保持顺序；其余按星级/等级降序
    const pinned = built.slice(0, 5);
    const rest = built.slice(5).sort((a, b) => (b.star - a.star) || (b.level - a.level) || a.name.localeCompare(b.name, 'zh-CN'));
    const characters = [...pinned, ...rest];

    const sssCount = characters.filter(c => c.star >= 5).length;
    const statCards = [
      { label: '累计登舰', value: `${stats.active_day_number || 0}天` },
      { label: '装甲数量', value: characters.length || stats.avatar_number || 0 },
      { label: 'SSS装甲', value: stats.sss_armor_number ?? sssCount },
      { label: '五星武器', value: stats.five_star_weapon_number || 0 },
      { label: '五星圣痕', value: stats.five_star_stigmata_number || 0 },
    ];

    const data = {
      uid,
      region: serverMap[region] || region,
      nickname: role.nickname || '未知舰长',
      level: role.level || 0,
      avatarUrl: absIcon(role.AvatarUrl || ''),
      rating: getMysRating(pref),
      score: pref.comprehensive_score || 0,
      statCards,
      characters,
      dataTime: moment().format('MM-DD HH:mm'),
      bg: ['bg', 'bg1', 'IMG_20250717_034154'][Math.floor(Math.random() * 3)],
    };

    try {
      const buf = await puppeteer.render('小花火/bh3_profile/profile', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_profile/profile.html',
        saveId: 'bh3_profile',
      });
      if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);
    } catch (err) {
      logger.error('[bh3_profile] render failed:', err);
    }

    return sendMsg(e, `UID${uid} 角色主页\n舰长: ${data.nickname} Lv.${data.level}\n装甲: ${characters.length}  SSS: ${statCards[2].value}\n更新时间: ${data.dataTime}`);
  }
}
