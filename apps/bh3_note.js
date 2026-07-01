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

function fmtRecover(seconds) {
  if (!seconds || seconds <= 0) return '已回满';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}时`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}分`);
  return parts.join('') || '即将回满';
}

function fmtEndTs(ts) {
  if (!ts) return '';
  try {
    const end = parseInt(ts);
    const endMs = end > 1e12 ? end : end * 1000;
    const now = Date.now();
    const remain = Math.floor((endMs - now) / 1000);
    if (remain <= 0) return '已结束';
    return fmtRecover(remain);
  } catch {
    return '';
  }
}

const serverMap = {
  cn_gf01: '官服', cn_qd01: 'B服', os_usa: '美服', os_euro: '欧服',
  os_asia: '亚服', os_cht: '港澳台服', android01: '安卓官服', ios01: 'iOS服',
  bb01: '哔哩哔哩', pc01: '桌面服', yyb01: '应用宝服', hun01: '渠道1服', hun02: '渠道2服',
};

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

export class bh3_note extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三体力',
      dsc: '崩坏3体现实时便笺',
      event: 'message',
      priority: pluginPriority('bh3_note', 100),
      rule: [
        { reg: '^#*(崩三|崩坏3|崩坏三|BH3)(体力|便笺|便签|实时)$', fnc: 'note' },
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

  async note(e) {
    const auth = await this.getAuth(e);
    if (!auth.uid) return sendMsg(e, '请先扫码绑定崩坏3账号');
    if (!auth.ck) return sendMsg(e, '未找到有效Cookie，请先扫码绑定');

    const { uid, region, ck } = auth;
    const headers = mhy.getHeaders(e, ck);

    let indexRes, noteRes;
    try {
      [indexRes, noteRes] = await Promise.all([
        api(e, { type: 'bh3_index', uid, headers, game: 'bh3', server: region }),
        api(e, { type: 'bh3_note', uid, headers, game: 'bh3', server: region }),
      ]);
    } catch (err) {
      logger.error('[bh3_note] API error:', err);
      return sendMsg(e, '查询失败，请稍后重试');
    }

    if (!indexRes || indexRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取玩家信息失败`);
    if (!noteRes || noteRes.retcode !== 0) return sendMsg(e, `UID${uid} 获取体力信息失败`);

    const role = indexRes.data?.role || {};
    const stats = indexRes.data?.stats || {};
    const pref = indexRes.data?.preference || {};
    const note = noteRes.data || {};
    const level = Number(role.level || 0);
    const isOldAbyss = level > 0 && level <= 80;
    const ultraRaw = note.ultra_endless || null;
    const greedyRaw = note.greedy_endless || null;
    const displayAbyss = isOldAbyss ? (greedyRaw || ultraRaw) : (ultraRaw || greedyRaw);
    const displayAbyssName = isOldAbyss ? '量子流形' : (ultraRaw ? '超弦空间' : greedyRaw ? '量子流形' : '深渊');
    const displayAbyssValue = displayAbyss
      ? (isOldAbyss
        ? `${displayAbyss.cur_reward ?? displayAbyss.challenge_score ?? 0}/${displayAbyss.max_reward ?? '?'}`
        : `${displayAbyss.challenge_score ?? displayAbyss.cur_reward ?? '?'} 分`)
      : '';

    const data = {
      uid,
      region: serverMap[region] || region,
      nickname: role.nickname || '未知舰长',
      level,
      avatarUrl: role.AvatarUrl || '',
      activeDays: stats.active_day_number || 0,
      rating: getMysRating(pref),
      currentStamina: note.current_stamina || 0,
      maxStamina: note.max_stamina || 200,
      staminaPercent: Math.min((note.current_stamina || 0) / (note.max_stamina || 200) * 100, 100),
      staminaRecover: fmtRecover(note.stamina_recover_time),
      currentTrain: note.current_train_score || 0,
      maxTrain: note.max_train_score || 500,
      trainPercent: Math.min((note.current_train_score || 0) / (note.max_train_score || 500) * 100, 100),
      abyssName: displayAbyssName,
      abyssValue: displayAbyssValue,
      abyssOpen: !!displayAbyss?.is_open,
      abyssRemain: displayAbyss ? fmtEndTs(displayAbyss.schedule_end) : '',
      ultraEndless: !isOldAbyss && note.ultra_endless ? { ...note.ultra_endless, remain: fmtEndTs(note.ultra_endless.schedule_end) } : null,
      greedyEndless: isOldAbyss && displayAbyss ? { ...displayAbyss, remain: fmtEndTs(displayAbyss.schedule_end) } : (!note.ultra_endless && note.greedy_endless ? { ...note.greedy_endless, remain: fmtEndTs(note.greedy_endless.schedule_end) } : null),
      battleField: note.battle_field ? { ...note.battle_field, remain: fmtEndTs(note.battle_field.schedule_end) } : null,
      godWar: note.god_war ? { ...note.god_war, remain: fmtEndTs(note.god_war.schedule_end) } : null,
      dataTime: moment().format('MM-DD HH:mm'),
    };
    data.bg = ['bg', 'bg1', 'IMG_20250717_034154'][Math.floor(Math.random() * 3)];

    try {
      const buf = await puppeteer.render('小花火/bh3_note/note', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/bh3_note/note.html',
        saveId: 'bh3_note',
      });
      if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);
    } catch (err) {
      logger.error('[bh3_note] render failed:', err);
    }

    const lines = [
      `📊 UID${uid} 体力便笺`,
      `舰长: ${data.nickname}  Lv.${data.level}`,
      `体力: ${data.currentStamina} / ${data.maxStamina}  (${data.staminaRecover})`,
      `历练值: ${data.currentTrain} / ${data.maxTrain}`,
    ];
    if (data.abyssOpen) {
      lines.push(`${data.abyssName}: ${data.abyssValue}  剩余${data.abyssRemain}`);
    }
    if (data.battleField?.is_open) {
      lines.push(`记忆战场: ${data.battleField.cur_reward || 0}/${data.battleField.max_reward || 0}  剩余${fmtEndTs(data.battleField.schedule_end)}`);
    }
    if (data.godWar?.is_open) {
      lines.push(`往世乐土: ${data.godWar.cur_reward || 0}/${data.godWar.max_reward || 0}  剩余${fmtEndTs(data.godWar.schedule_end)}`);
    }
    lines.push(`更新时间: ${data.dataTime}`);
    return sendMsg(e, lines.join('\n'));
  }
}
