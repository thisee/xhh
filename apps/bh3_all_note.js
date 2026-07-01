import fetch from 'node-fetch';
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

const gsServerMap = {
  cn_gf01: '官服', cn_qd01: 'B服', os_usa: '美服', os_euro: '欧服',
  os_asia: '亚服', os_cht: '港澳台服',
};

const srServerMap = {
  cn_gf01: '官服', cn_qd01: 'B服', os_usa: '美服', os_euro: '欧服',
  os_asia: '亚服', os_cht: '港澳台服',
};

const zzzServerMap = {
  cn_gf01: '官服', cn_qd01: 'B服', os_usa: '美服', os_euro: '欧服',
  os_asia: '亚服', os_cht: '港澳台服',
};

export class bh3_all_note extends plugin {
  constructor(e) {
    super({
      name: '[小花火]四游戏体力聚合',
      dsc: '原神/星铁/绝区零/崩三 体力一键查询',
      event: 'message',
      priority: pluginPriority('bh3_all_note', 100),
      rule: [
        { reg: '^#*(小花火体力|全体力|四游戏体力|米游社体力|体力总览)$', fnc: 'allNote' },
      ],
    });
  }

  async getAuth(e, game) {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at') { qq = msg.qq; break; }
    }

    let uid = await redis.get(`xhh:${game}_uid:${qq}`);
    let region = uid ? await redis.get(`xhh:${game}_region:${qq}`) : null;
    let ck = null;

    const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
    if (fs.existsSync(stokenPath)) {
      const stokenData = yaml.get(stokenPath) || {};
      if (!uid) {
        const gameRegions = this.getGameRegions(game);
        for (const key of Object.keys(stokenData)) {
          const entry = stokenData[key];
          if (gameRegions.includes(entry?.region || '')) {
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
      try { uid = (await NoteUser.create(qq)).getUid(game); } catch (_) {}
    }
    if (!region) region = this.getDefaultRegion(game);

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

  getGameRegions(game) {
    const maps = {
      gs: ['cn_gf01', 'cn_qd01', 'os_usa', 'os_euro', 'os_asia', 'os_cht'],
      sr: ['cn_gf01', 'cn_qd01', 'os_usa', 'os_euro', 'os_asia', 'os_cht'],
      zzz: ['cn_gf01', 'cn_qd01', 'os_usa', 'os_euro', 'os_asia', 'os_cht'],
      bh3: ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'],
    };
    return maps[game] || [];
  }

  getDefaultRegion(game) {
    const defaults = { gs: 'cn_gf01', sr: 'cn_gf01', zzz: 'cn_gf01', bh3: 'android01' };
    return defaults[game] || 'cn_gf01';
  }

  async allNote(e) {
    await e.reply('正在获取四游戏体力数据...', true);

    const results = [];
    const add = (item) => {
      if (!item) return;
      item.staminaPercent = Math.min(Math.round((item.currentStamina || 0) / (item.maxStamina || 1) * 100), 100);
      results.push(item);
    };

    // 原神/星铁/绝区零小组件接口
    await Promise.all([
      this.getWidgetNote(e, 'gs').then(add).catch(err => logger.warn('[all_note] 原神体力获取失败:', err.message)),
      this.getWidgetNote(e, 'sr').then(add).catch(err => logger.warn('[all_note] 星铁体力获取失败:', err.message)),
      this.getWidgetNote(e, 'zzz').then(add).catch(err => logger.warn('[all_note] 绝区零体力获取失败:', err.message)),
      this.getBh3Note(e).then(add).catch(err => logger.warn('[all_note] 崩三体力获取失败:', err.message)),
    ]);

    if (!results.length) return sendMsg(e, '未获取到任何体力数据，请先绑定账号或检查 Cookie');

    const data = {
      games: results.sort((a, b) => ['gs', 'sr', 'zzz', 'bh3'].indexOf(a.gameKey) - ['gs', 'sr', 'zzz', 'bh3'].indexOf(b.gameKey)),
      bg: ['bg', 'bg1', 'IMG_20250717_034154'][Math.floor(Math.random() * 3)],
      dataTime: moment().format('MM-DD HH:mm'),
    };
    let buf;
    try {
      buf = await puppeteer.render('小花火/all_note/all_note', {
        ...data,
        sys: { scale: 'style=transform:scale(1)' },
        deviceScaleFactor: 2,
        ppath: '../../../../../plugins/xhh/resources/',
        tplFile: process.cwd() + '/plugins/xhh/resources/all_note/all_note.html',
        saveId: 'all_note',
      });
    } catch (err) {
      logger.error('[all_note] render failed:', err);
    }

    if (buf && Buffer.isBuffer(buf)) return sendMsg(e, buf);

    const lines = ['📊 四游戏体力总览'];
    for (const g of results) {
      lines.push(`\n【${g.game}】${g.nickname} Lv.${g.level}`);
      lines.push(`  ${g.staminaLabel}: ${g.currentStamina} / ${g.maxStamina}  (${g.staminaRecover})`);
      if (g.gameKey === 'gs') lines.push(`  委托: ${g.finishedTask}/${g.totalTask}  派遣: ${g.expedition}/${g.maxExpedition}`);
      if (g.gameKey === 'sr') lines.push(`  实训: ${g.trainScore}/${g.maxTrainScore}  后备: ${g.reserveStamina}`);
      if (g.gameKey === 'zzz') lines.push(`  活跃: ${g.vitalityCurrent}/${g.vitalityMax}  周纪: ${g.weeklyCur}/${g.weeklyMax}`);
      if (g.gameKey === 'bh3') {
        lines.push(`  历练: ${g.currentTrain} / ${g.maxTrain}`);
        if (g.ultraEndless?.is_open) lines.push(`  ${g.ultraLabel}: ${g.ultraEndless.challenge_score || '?'}分 剩余${g.ultraEndless.remain}`);
        if (g.battleField?.is_open) lines.push(`  战场: ${g.battleField.cur_reward || 0}/${g.battleField.max_reward || 0} 剩余${g.battleField.remain}`);
        if (g.godWar?.is_open) lines.push(`  乐土: ${g.godWar.cur_reward || 0}/${g.godWar.max_reward || 0} 剩余${g.godWar.remain}`);
      }
    }
    lines.push(`\n更新: ${moment().format('MM-DD HH:mm')}`);
    return sendMsg(e, lines.join('\n'));
  }

  async getRoleInfo(e, headers, uid) {
    const roles = await api(e, { type: 'GameRoles', headers });
    return roles?.data?.list?.find(v => String(v.game_uid) === String(uid)) || {};
  }

  async getWidgetNote(e, game) {
    const auth = await this.getAuth(e, game);
    if (!auth.uid || !auth.ck) return null;
    const headers = mhy.getHeaders(e, auth.ck, false);
    const urls = {
      gs: 'https://api-takumi-record.mihoyo.com/game_record/genshin/aapi/widget/v2',
      sr: 'https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/aapi/widget',
      zzz: 'https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/widget',
    };
    const [role, res] = await Promise.all([
      this.getRoleInfo(e, headers, auth.uid),
      fetch(urls[game], { method: 'get', headers }).then(r => r.json()),
    ]);
    if (res?.retcode !== 0) return null;
    const note = res.data || {};
    const common = {
      gameKey: game,
      uid: auth.uid,
      nickname: role.nickname || '未知',
      level: role.level || 0,
      region: (game === 'sr' ? srServerMap : game === 'zzz' ? zzzServerMap : gsServerMap)[auth.region] || auth.region,
    };
    if (game === 'gs') {
      return {
        ...common,
        game: '原神',
        icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/ys_icon.png',
        staminaLabel: '原粹树脂',
        currentStamina: note.current_resin || 0,
        maxStamina: note.max_resin || 200,
        staminaRecover: note.resin_recovery_time ? this.fmtRecover(note.resin_recovery_time) : '已回满',
        finishedTask: note.finished_task_num || 0,
        totalTask: note.total_task_num || 4,
        expedition: note.current_expedition_num || 0,
        maxExpedition: note.max_expedition_num || 5,
      };
    }
    if (game === 'sr') {
      return {
        ...common,
        game: '星穹铁道',
        icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/sr_icon.png',
        staminaLabel: '开拓力',
        currentStamina: note.current_stamina || 0,
        maxStamina: note.max_stamina || 300,
        staminaRecover: note.stamina_recover_time ? this.fmtRecover(note.stamina_recover_time) : '已回满',
        trainScore: note.current_train_score || 0,
        maxTrainScore: note.max_train_score || 500,
        reserveStamina: note.current_reserve_stamina || 0,
      };
    }
    return {
      ...common,
      game: '绝区零',
      icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/zzz_icon.png',
      staminaLabel: '电量',
      currentStamina: note.energy?.progress?.current ?? note.battery_charge ?? 0,
      maxStamina: note.energy?.progress?.max ?? note.max_battery_charge ?? 240,
      staminaRecover: note.energy?.restore ? this.fmtRecover(note.energy.restore) : (note.battery_recovery_time ? this.fmtRecover(note.battery_recovery_time) : '已回满'),
      vitalityCurrent: note.vitality?.current || 0,
      vitalityMax: note.vitality?.max || 400,
      weeklyCur: note.weekly_task?.cur_point || 0,
      weeklyMax: note.weekly_task?.max_point || 800,
    };
  }

  async getBh3Note(e) {
    const bh3Auth = await this.getAuth(e, 'bh3');
    if (!bh3Auth.uid || !bh3Auth.ck) return null;
    const headers = mhy.getHeaders(e, bh3Auth.ck);
    const [indexRes, noteRes] = await Promise.all([
      api(e, { type: 'bh3_index', uid: bh3Auth.uid, headers, game: 'bh3', server: bh3Auth.region }),
      api(e, { type: 'bh3_note', uid: bh3Auth.uid, headers, game: 'bh3', server: bh3Auth.region }),
    ]);
    if (indexRes?.retcode !== 0 || noteRes?.retcode !== 0) return null;
    const role = indexRes.data?.role || {};
    const note = noteRes.data || {};
    return {
      gameKey: 'bh3',
      game: '崩坏3',
      icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/bh3_icon.png',
      uid: bh3Auth.uid,
      nickname: role.nickname || '未知舰长',
      level: role.level || 0,
      region: serverMap[bh3Auth.region] || bh3Auth.region,
      staminaLabel: '体力',
      currentStamina: note.current_stamina || 0,
      maxStamina: note.max_stamina || 200,
      staminaRecover: this.fmtRecover(note.stamina_recover_time),
      currentTrain: note.current_train_score || 0,
      maxTrain: note.max_train_score || 500,
      ultraEndless: note.ultra_endless ? { ...note.ultra_endless, remain: this.fmtEndTs(note.ultra_endless.schedule_end) } : null,
      greedyEndless: note.greedy_endless ? { ...note.greedy_endless, remain: this.fmtEndTs(note.greedy_endless.schedule_end) } : null,
      battleField: note.battle_field ? { ...note.battle_field, remain: this.fmtEndTs(note.battle_field.schedule_end) } : null,
      godWar: note.god_war ? { ...note.god_war, remain: this.fmtEndTs(note.god_war.schedule_end) } : null,
    };
  }

  fmtRecover(seconds) {
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

  fmtEndTs(ts) {
    if (!ts) return '';
    try {
      const end = parseInt(ts);
      const endMs = end > 1e12 ? end : end * 1000;
      const now = Date.now();
      const remain = Math.floor((endMs - now) / 1000);
      if (remain <= 0) return '已结束';
      return this.fmtRecover(remain);
    } catch {
      return '';
    }
  }
}