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
      priority: 100,
      rule: [
        { reg: '^#*(全体力|四游戏体力|米游社体力|体力总览)$', fnc: 'allNote' },
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
    const defaults = { gs: 'cn_gf01', sr: 'cn_gf_gf01', zzz: 'cn_gf01', bh3: 'android01' };
    return defaults[game] || 'cn_gf01';
  }

  async allNote(e) {
    await e.reply('正在获取四游戏体力数据...', true);

    const results = [];
    let hasAny = false;

    // 原神
    try {
      const gsAuth = await this.getAuth(e, 'gs');
      if (gsAuth.uid && gsAuth.ck) {
        const headers = mhy.getHeaders(e, gsAuth.ck);
        const [indexRes, noteRes] = await Promise.all([
          api(e, { type: 'GameRoles', uid: gsAuth.uid, headers, game: 'gs', server: gsAuth.region }),
          api(e, { type: 'note', uid: gsAuth.uid, headers, game: 'gs', server: gsAuth.region }),
        ]);
        if (indexRes?.retcode === 0 && noteRes?.retcode === 0) {
          const role = indexRes.data?.list?.[0] || {};
          const note = noteRes.data || {};
          results.push({
            game: '原神',
            icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/ys_icon.png',
            nickname: role.nickname || '未知',
            level: role.level || 0,
            region: 'cn_gf01',
            currentStamina: note.current_resin || 0,
            maxStamina: note.max_resin || 160,
            staminaRecover: note.resin_recovery_time ? this.fmtRecover(note.resin_recovery_time) : '已回满',
            expedition: note.finished_task_num || 0,
            homeCoin: note.current_home_coin || 0,
            transformer: note.transformer?.recovery_time ? this.fmtRecover(note.transformer.recovery_time) : null,
          });
          hasAny = true;
        }
      }
    } catch (err) {
      logger.warn('[all_note] 原神体力获取失败:', err.message);
    }

    // 星穹铁道
    try {
      const srAuth = await this.getAuth(e, 'sr');
      if (srAuth.uid && srAuth.ck) {
        const headers = mhy.getHeaders(e, srAuth.ck);
        const [indexRes, noteRes] = await Promise.all([
          api(e, { type: 'GameRoles', uid: srAuth.uid, headers, game: 'sr', server: srAuth.region }),
          api(e, { type: 'note', uid: srAuth.uid, headers, game: 'sr', server: srAuth.region }),
        ]);
        if (indexRes?.retcode === 0 && noteRes?.retcode === 0) {
          const role = indexRes.data?.list?.[0] || {};
          const note = noteRes.data || {};
          results.push({
            game: '星穹铁道',
            icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/sr_icon.png',
            nickname: role.nickname || '未知',
            level: role.level || 0,
            region: 'cn_gf01',
            currentStamina: note.current_stamina || 0,
            maxStamina: note.max_stamina || 240,
            staminaRecover: note.stamina_recover_time ? this.fmtRecover(note.stamina_recover_time) : '已回满',
            trainScore: note.current_train_score || 0,
            maxTrainScore: note.max_train_score || 18000,
            rogueScore: note.rogue_score || 0,
            weeklyMock: note.weekly_mock_score || 0,
          });
          hasAny = true;
        }
      }
    } catch (err) {
      logger.warn('[all_note] 星铁体力获取失败:', err.message);
    }

    // 绝区零
    try {
      const zzzAuth = await this.getAuth(e, 'zzz');
      if (zzzAuth.uid && zzzAuth.ck) {
        const headers = mhy.getHeaders(e, zzzAuth.ck);
        const [indexRes, noteRes] = await Promise.all([
          api(e, { type: 'GameRoles', uid: zzzAuth.uid, headers, game: 'zzz', server: zzzAuth.region }),
          api(e, { type: 'note', uid: zzzAuth.uid, headers, game: 'zzz', server: zzzAuth.region }),
        ]);
        if (indexRes?.retcode === 0 && noteRes?.retcode === 0) {
          const role = indexRes.data?.list?.[0] || {};
          const note = noteRes.data || {};
          results.push({
            game: '绝区零',
            icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/zzz_icon.png',
            nickname: role.nickname || '未知',
            level: role.level || 0,
            region: 'cn_gf01',
            currentStamina: note.battery_charge || 0,
            maxStamina: note.max_battery_charge || 180,
            staminaRecover: note.battery_recovery_time ? this.fmtRecover(note.battery_recovery_time) : '已回满',
          });
          hasAny = true;
        }
      }
    } catch (err) {
      logger.warn('[all_note] 绝区零体力获取失败:', err.message);
    }

    // 崩坏3
    try {
      const bh3Auth = await this.getAuth(e, 'bh3');
      if (bh3Auth.uid && bh3Auth.ck) {
        const headers = mhy.getHeaders(e, bh3Auth.ck);
        const [indexRes, noteRes] = await Promise.all([
          api(e, { type: 'bh3_index', uid: bh3Auth.uid, headers, game: 'bh3', server: bh3Auth.region }),
          api(e, { type: 'bh3_note', uid: bh3Auth.uid, headers, game: 'bh3', server: bh3Auth.region }),
        ]);
        if (indexRes?.retcode === 0 && noteRes?.retcode === 0) {
          const role = indexRes.data?.role || {};
          const stats = indexRes.data?.stats || {};
          const pref = indexRes.data?.preference || {};
          const note = noteRes.data || {};
          results.push({
            game: '崩坏3',
            icon: 'https://api-takumi-static.mihoyo.com/hoyowiki/pc/icon/bh3_icon.png',
            nickname: role.nickname || '未知舰长',
            level: role.level || 0,
            region: 'cn_gf01',
            currentStamina: note.current_stamina || 0,
            maxStamina: note.max_stamina || 200,
            staminaRecover: this.fmtRecover(note.stamina_recover_time),
            currentTrain: note.current_train_score || 0,
            maxTrain: note.max_train_score || 500,
            ultraEndless: note.ultra_endless ? { ...note.ultra_endless, remain: this.fmtEndTs(note.ultra_endless.schedule_end) } : null,
            greedyEndless: note.greedy_endless ? { ...note.greedy_endless, remain: this.fmtEndTs(note.greedy_endless.schedule_end) } : null,
            battleField: note.battle_field ? { ...note.battle_field, remain: this.fmtEndTs(note.battle_field.schedule_end) } : null,
            godWar: note.god_war ? { ...note.god_war, remain: this.fmtEndTs(note.god_war.schedule_end) } : null,
            activeDays: stats.active_day_number || 0,
            rating: pref.comprehensive_rating || 'C',
          });
          hasAny = true;
        }
      }
    } catch (err) {
      logger.warn('[all_note] 崩三体力获取失败:', err.message);
    }

    if (!hasAny) return sendMsg(e, '未获取到任何体力数据，请先绑定账号或检查 Cookie');

    // 渲染聚合卡片
    const data = { games: results, dataTime: moment().format('MM-DD HH:mm') };
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

    // 文本兜底
    const lines = ['📊 四游戏体力总览'];
    for (const g of results) {
      lines.push(`\n【${g.game}】${g.nickname} Lv.${g.level}`);
      lines.push(`  体力: ${g.currentStamina} / ${g.maxStamina}  (${g.staminaRecover})`);
      if (g.game === '原神') {
        lines.push(`  派遣: ${g.expedition}/4  瓶装: ${g.homeCoin}  合成台: ${g.transformer || '已回满'}`);
      } else if (g.game === '星穹铁道') {
        lines.push(`  开拓力: ${g.trainScore} / ${g.maxTrainScore}  模拟: ${g.weeklyMock}  差分: ${g.rogueScore}`);
      } else if (g.game === '绝区零') {
        lines.push(`  电池: ${g.currentStamina} / ${g.maxStamina}  (${g.staminaRecover})`);
      } else if (g.game === '崩坏3') {
        lines.push(`  历练: ${g.currentTrain} / ${g.maxTrain}`);
        if (g.ultraEndless?.is_open) lines.push(`  超弦: ${g.ultraEndless.challenge_score}分 剩余${g.ultraEndless.remain}`);
        if (g.battleField?.is_open) lines.push(`  战场: ${g.battleField.cur_reward}/${g.battleField.max_reward} 剩余${g.battleField.remain}`);
        if (g.godWar?.is_open) lines.push(`  乐土: ${g.godWar.cur_reward}/${g.godWar.max_reward} 剩余${g.godWar.remain}`);
      }
    }
    lines.push(`\n更新: ${moment().format('MM-DD HH:mm')}`);
    return sendMsg(e, lines.join('\n'));
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