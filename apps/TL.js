import fetch from 'node-fetch';
import moment from 'moment';
import fs from 'fs';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import { mhy, render, api, config, yaml, pluginPriority } from '#xhh';

const path = process.cwd();

function cookiePart(ck = '', key) {
  const m = String(ck).match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? m[1] : '';
}

async function ensureCookieToken(e, ck, entry = null) {
  if (!ck || /(?:^|;\s*)cookie_token=/.test(ck)) return ck;
  const stuid = entry?.stuid || cookiePart(ck, 'stuid') || cookiePart(ck, 'ltuid');
  const stoken = entry?.stoken || cookiePart(ck, 'stoken');
  if (!stuid || !stoken) return ck;
  try {
    const headers = mhy.getHeaders(e, ck);
    const cookieRes = await fetch(`https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoBySToken?stoken=${encodeURIComponent(stoken)}&uid=${encodeURIComponent(stuid)}`, { method: 'GET', headers }).then(r => r.json());
    const ltokenRes = await fetch('https://passport-api.mihoyo.com/account/auth/api/getLTokenBySToken', { method: 'GET', headers }).then(r => r.json());
    const cookieToken = cookieRes?.data?.cookie_token;
    const ltoken = ltokenRes?.data?.ltoken || entry?.ltoken;
    if (cookieToken && ltoken) return `ltoken=${ltoken};ltuid=${stuid};cookie_token=${cookieToken};account_id=${stuid};`;
    if (cookieToken) return `stuid=${stuid};stoken=${stoken};cookie_token=${cookieToken};account_id=${stuid};`;
  } catch (err) {
    logger.debug?.(`[xhh][TL][bh3] refresh cookie_token failed: ${err.message}`);
  }
  return ck;
}

export class TL extends plugin {
  constructor(e) {
    super({
      name: '[小花火]体力小组件',
      dsc: '体力',
      event: 'message',
      priority: pluginPriority('tl', -99),
      rule: [
        {
          reg: '^(#|\\*|%)*(原神|星铁|绝区零)*体力$',
          fnc: 'note_',
        },
      ],
    });
    this.gsUrl =
      'https://api-takumi-record.mihoyo.com/game_record/genshin/aapi/widget/v2';
    this.srUrl =
      'https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/aapi/widget';
    this.zzzUrl =
      'https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/widget';
    this.week = [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六',
    ];
  }

  async note_(e) {
    if (!config().Tl) return false;
    let hasAllData = false;
    const rawMsg = (e.msg || '').replace(/^(#|\*|%)*/, '');
    const isQueryAll = rawMsg === '体力' || rawMsg === '小花火体力';
    const isStarRail = e.msg.includes('星铁');
    const isZZZ = e.msg.includes('绝区零');
    const isBH3 = /崩三|崩坏3|崩坏三|BH3/i.test(e.msg);
    const getZZZData = async () => {
      const data = await this.note(e, 'zzz', isQueryAll);
      if (
        data &&
        !['过期', '没有'].includes(data) &&
        !data.s2_bounty_commission
      ) {
        data.s2_bounty_commission = {
          num: 0,
          total: 0,
        };
      }
      return data;
    };

    let resultData = {};

    if (isQueryAll) {
      hasAllData = true;
      const [gsData, srData, zzzData, bh3Data] = await Promise.all([
        this.note(e, 'gs'),
        this.note(e, 'sr'),
        getZZZData(),
        this.bh3Note(e, true),
      ]);
      resultData = {
        gs_data: gsData,
        sr_data: srData,
        zzz_data: zzzData,
        bh3_data: bh3Data,
      };
    } else if (isStarRail) {
      resultData = {
        sr_data: await this.note(e, 'sr', false),
      };
    } else if (isZZZ) {
      resultData = {
        zzz_data: await getZZZData(),
      };
    } else if (isBH3) {
      resultData = {
        bh3_data: await this.bh3Note(e, false),
      };
    } else {
      resultData = {
        gs_data: await this.note(e, 'gs', false),
      };
    }

    if (Object.values(resultData).every(v => v === '没有')) {
      if (hasAllData) e.reply('没有绑定米游社，请[扫码绑定]米游社', true);
      return true;
    }
    if (Object.values(resultData).every(v => v === '过期')) {
      if (hasAllData) e.reply('米游社验证已过期。请重新：扫码绑定 ', true);
      return true;
    }

    // if (Object.values(resultData).every(v => !v)) return true
    const renderData = {
      bg: Object.values(resultData).filter(Boolean).length > 1 ? 'bg' : 'bg1',
      qq: e.user_id,
      qqname: e.sender.card&&(e.sender.card.length < 11) ? e.sender.card : e.sender.nickname&&(e.sender.nickname.length<11) ? e.sender.nickname : e.user_id,
      time: `${moment().format('MM-DD HH:mm')} ${this.week[moment().day()]}`,
    };

    //3体力，去掉失效的
    for (const key in resultData) {
      if (resultData[key] === '没有' || resultData[key] === '过期') {
        resultData[key] = false;
      }
    }

    const { ..._data_ } = { ...renderData, ...resultData };
    render('Tl/Tl', _data_, {
      e,
      ret: true,
    });
  }


  async getBh3Auth(e) {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at') { qq = msg.qq; break; }
    }

    let uid = await redis.get(`xhh:bh3_uid:${qq}`);
    let region = uid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
    let ck = null;
    let signEntry = null;

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
        signEntry = entry;
        region = entry.region || region;
      }
      if (entry?.stuid) {
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

    if (!uid) {
      try { uid = (await NoteUser.create(qq)).getUid('bh3'); } catch (_) {}
    }
    if (!region) region = 'cn_gf01';
    if (!ck) {
      try {
        const nu = await NoteUser.create(qq);
        for (const ltuid in nu.mysUsers || {}) {
          if (nu.mysUsers[ltuid]?.ck) { ck = nu.mysUsers[ltuid].ck; break; }
        }
      } catch (_) {}
    }
    return { uid, region, ck, signEntry };
  }

  async bh3Note(e, san = true) {
    const auth = await this.getBh3Auth(e);
    if (!auth.uid) {
      if (!san) e.reply('请先扫码绑定崩坏3账号');
      return '没有';
    }
    if (!auth.ck) {
      if (!san) e.reply('未找到有效Cookie，请先扫码绑定');
      return '没有';
    }
    const headers = mhy.getHeaders(e, auth.ck);
    const signCk = await ensureCookieToken(e, auth.signEntry?.ck_stoken || auth.ck, auth.signEntry);
    const signHeaders = mhy.getHeaders(e, signCk);
    let indexRes, noteRes, signRes;
    try {
      [indexRes, noteRes, signRes] = await Promise.all([
        api(e, { type: 'bh3_index', uid: auth.uid, headers, game: 'bh3', server: auth.region }),
        api(e, { type: 'bh3_note', uid: auth.uid, headers, game: 'bh3', server: auth.region }),
        api(e, { type: 'sign_info', uid: auth.uid, headers: signHeaders, game: 'bh3', server: auth.region }).catch(() => null),
      ]);
    } catch (err) {
      logger.error('[xhh][TL][bh3] API error:', err);
      return false;
    }
    if ([-10001, 10001, -100].includes(indexRes?.retcode) || [-10001, 10001, -100].includes(noteRes?.retcode)) {
      if (!san) e.reply('米游社验证已过期。请重新：扫码绑定');
      return '过期';
    }
    if (indexRes?.retcode !== 0 || noteRes?.retcode !== 0) return false;
    const role = indexRes.data?.role || {};
    const note = noteRes.data || {};
    const level = Number(role.level || 0);
    const ultra = note.ultra_endless || null;
    const greedy = note.greedy_endless || null;
    const isOldAbyss = level > 0 && level <= 80;
    const abyss = isOldAbyss
      ? (greedy || ultra || null)
      : (ultra?.is_open ? ultra : greedy?.is_open ? greedy : ultra || greedy || null);
    const abyssName = isOldAbyss ? '量子流形' : (ultra ? '超弦空间' : greedy ? '量子流形' : '超弦空间');
    return {
      uid: auth.uid,
      level,
      name: role.nickname || '未知舰长',
      current_stamina: note.current_stamina || 0,
      max_stamina: note.max_stamina || 200,
      time: note.stamina_recover_time ? getTime(note.stamina_recover_time) : '已满',
      current_train_score: note.current_train_score || 0,
      max_train_score: note.max_train_score || 500,
      abyss,
      abyss_name: abyssName,
      battle_field: note.battle_field || null,
      god_war: note.god_war || null,
      is_sign: signRes?.data?.is_sign === true,
    };
  }

  //体力
  async note(e, game = 'gs', san = true) {
    let uid = e.user.getUid(game);

    if (!uid) {
      if (!san) e.reply('未发现绑定的uid，请[扫码绑定]米游社~');
      return '没有';
    }

    let sk = await mhy.getstoken(e, uid);
    if (!sk) {
      if (!san)
        e.reply('UID:' + uid + '未绑定米游社SToken，请[扫码绑定]米游社~', true);
      return '没有';
    }
    let headers = mhy.getHeaders(e, sk, false);
    let url =
      game == 'gs' ? this.gsUrl : game == 'sr' ? this.srUrl : this.zzzUrl;
    let res = await fetch(url, {
      method: 'get',
      headers,
    }).then(res => res.json());
    if ([-10001, 10001, -100].includes(res?.retcode)) {
      if (!san) {
        e.reply('登录验证过期。请重新：扫码绑定 ');
      }
      return '过期';
    }

    if (!res || res.retcode !== 0) {
      logger.error(res);
      return false;
    }
    let time =
      res.data.resin_recovery_time ||
      res.data.stamina_recover_time ||
      res.data.energy?.restore;
    if (!time) time = 0;
    let game_ = await this.getGameDate(e, headers, uid);
    //派遣，委托 是否全部完成
    if (res.data.expeditions?.length) {
      res.data.expeditions_ = res.data.expeditions.every(
        v => v.status === 'Finished'
      );
    }
    let data = {
      uid: uid,
      ...game_,
      time: time == 0 ? '已满' : getTime(time),
      ...res.data,
    };
    return data;
  }

  async getGameDate(e, headers, uid) {
    headers.DS = mhy.getDs();
    let res = await api(e, {
      type: 'GameRoles',
      headers: headers,
    });
    let data;
    res.data.list.forEach(v => {
      if (v.game_uid == uid) {
        data = {
          level: v.level,
          name: v.nickname,
        };
      }
    });
    return data;
  }
}

/*
function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600); // 获取小时数
  const minutes = Math.floor((seconds % 3600) / 60); // 获取分钟数
  //const remainingSeconds = seconds % 60; // 获取剩余的秒数
  if (hours == 0) return `${minutes}分钟`
  if (hours == 0 && minutes == 0) return '无'
  return `${hours}小时${minutes}分钟`;
}
  */

function getTime(time) {
  const now = new Date().getTime();
  const date = new Date(time * 1000 + now);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  // 当前日期（去除时分秒）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 目标日期（去除时分秒）
  const targetDate = date;
  targetDate.setHours(0, 0, 0, 0);

  // 计算日期差值（天数）
  let days = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));

  let day = days === 0 ? '今天' : days === 1 ? '明天' : '后天';
  return `${day}${hours}:${minutes}`;
}
