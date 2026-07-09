import fetch from 'node-fetch';
import moment from 'moment';
import fs from 'fs';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import { mhy, render, api, config, yaml, pluginPriority, makeForwardMsg } from '#xhh';

const path = process.cwd();

function cookiePart(ck = '', key) {
  const m = String(ck).match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? m[1] : '';
}

function getEventText(e = {}) {
  const parts = [];
  if (e.raw_message) parts.push(String(e.raw_message));
  if (e.msg) parts.push(String(e.msg));
  if (Array.isArray(e.message)) {
    for (const item of e.message) {
      const text = item?.text || item?.data?.text;
      if (text) parts.push(String(text));
    }
  }
  return [...new Set(parts)].join(' ').trim();
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
    if (config().debug) logger.mark(`[xhh][TL][bh3] refresh cookie_token failed: ${err.message}`);
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
          reg: '^(#|\\*|%)*(小花火体力|全体力|四游戏体力|米游社体力|体力总览|(小花火|xhh)*(原神|星铁|绝区零|崩三|崩坏3|崩坏三|BH3)*体力)$',
          fnc: 'note_',
        },
      ],
    });
    this.gsUrl =
      'https://api-takumi-record.mihoyo.com/game_record/genshin/aapi/widget/v2';
    this.gsDailyNoteUrl =
      'https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/dailyNote';
    this.srUrl =
      'https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/aapi/widget';
    this.srNoteUrl =
      'https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/note';
    this.zzzUrl =
      'https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/widget';
    this.zzzNoteUrl =
      'https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/note';
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
    const rawMsg = (e.msg || '').replace(/^(#|\*|%)*/, '').trim();
    const fullMsg = getEventText(e).replace(/^(#|\*|%)*/, '').trim();
    const detectMsg = `${fullMsg} ${rawMsg}`;
    const isStarRail = detectMsg.includes('星铁');
    const isZZZ = detectMsg.includes('绝区零');
    const isBH3 = /崩三|崩坏3|崩坏三|BH3/i.test(detectMsg);
    const isGenshinOnly = /原神/.test(detectMsg);
    const singleGameKey = isGenshinOnly ? 'gs' : isStarRail ? 'sr' : isZZZ ? 'zzz' : isBH3 ? 'bh3' : '';
    const isQueryAll = !singleGameKey && ['体力', '小花火体力', '全体力', '四游戏体力', '米游社体力', '体力总览'].includes(rawMsg);
    const tipName = isQueryAll ? '四游戏' : singleGameKey ? this.getGameMeta(singleGameKey).name : '原神';
    await e.reply(`正在获取${tipName}体力数据，请稍后...`, true);
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
    } else if (singleGameKey) {
      return this.gameAllNotes(e, singleGameKey);
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
    const img = await this.renderTlImage(e, resultData);
    if (img) await e.reply(img);
  }

  buildRenderData(e, resultData) {
    return {
      bg: Object.values(resultData).filter(Boolean).length > 1 ? 'bg' : 'bg1',
      qq: e.user_id,
      qqname: e.sender.card&&(e.sender.card.length < 11) ? e.sender.card : e.sender.nickname&&(e.sender.nickname.length<11) ? e.sender.nickname : e.user_id,
      time: `${moment().format('MM-DD HH:mm')} ${this.week[moment().day()]}`,
    };
  }

  async renderTlImage(e, resultData = {}) {
    const renderData = this.buildRenderData(e, resultData);

    //3体力，去掉失效的
    for (const key in resultData) {
      if (resultData[key] === '没有' || resultData[key] === '过期') {
        resultData[key] = false;
      }
    }

    const { ..._data_ } = { ...renderData, ...resultData };
    return render('Tl/Tl', _data_, {
      e,
      ret: false,
    });
  }

  getGameMeta(game = 'gs') {
    const map = {
      gs: {
        name: '原神',
        dataKey: 'gs_data',
        biz: ['hk4e_cn', 'hk4e_global'],
        regions: ['cn_gf01', 'cn_qd01', 'os_usa', 'os_euro', 'os_asia', 'os_cht'],
      },
      sr: {
        name: '崩坏：星穹铁道',
        dataKey: 'sr_data',
        biz: ['hkrpg_cn', 'hkrpg_global'],
        regions: ['prod_gf_cn', 'prod_qd_cn', 'prod_official_usa', 'prod_official_eur', 'prod_official_asia', 'prod_official_cht'],
      },
      zzz: {
        name: '绝区零',
        dataKey: 'zzz_data',
        biz: ['nap_cn', 'nap_global'],
        regions: ['prod_gf_cn', 'prod_qd_cn', 'prod_gf_us', 'prod_gf_jp', 'prod_gf_eu', 'prod_gf_sg'],
      },
      bh3: {
        name: '崩坏3',
        dataKey: 'bh3_data',
        biz: ['bh3_cn', 'bh3_global'],
        regions: ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'],
      },
    };
    return map[game] || map.gs;
  }

  isGameEntry(entry = {}, game = 'gs') {
    const meta = this.getGameMeta(game);
    if (entry.game_biz) return meta.biz.includes(entry.game_biz);
    const regionName = String(entry.region_name || '');
    if (game === 'gs' && regionName) return /天空岛|世界树/.test(regionName);
    if (game === 'sr' && regionName) return /星穹列车|星穹|列车/.test(regionName);
    if (game === 'zzz' && regionName) return /新艾利都|绝区零/.test(regionName);
    if (game === 'bh3' && regionName) return /国服|桌面|安卓|iOS|哔哩|渠道|全平台/.test(regionName);
    return meta.regions.includes(entry.region || '');
  }

  async getAllGameUids(e, game = 'gs') {
    const uidSet = new Set();
    const defaultUid = e.user?.getUid?.(game === 'bh3' ? 'bh3' : game);
    if (defaultUid) uidSet.add(String(defaultUid));
    const stokenPath = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    if (fs.existsSync(stokenPath)) {
      try {
        const stokenData = yaml.get(stokenPath) || {};
        for (const [uid, entry] of Object.entries(stokenData)) {
          if (this.isGameEntry(entry, game)) uidSet.add(String(uid));
        }
      } catch (_) {}
    }
    return [...uidSet];
  }

  async gameAllNotes(e, game = 'gs') {
    const meta = this.getGameMeta(game);
    const uids = await this.getAllGameUids(e, game);
    if (!uids.length) {
      await e.reply(`未发现绑定的${meta.name}UID，请先扫码绑定米游社~`, true);
      return true;
    }

    const list = [];
    const fails = [];
    const done = new Set();
    for (const uid of uids) {
      if (done.has(String(uid))) continue;
      const data = game === 'bh3'
        ? await this.bh3Note(e, true, uid)
        : await this.noteWithTempUid(e, game, uid);
      if (data?.error) {
        fails.push(`UID ${uid}：${data.error}`);
        continue;
      }
      if (!data || data === '没有' || data === '过期') {
        fails.push(`UID ${uid}：${data === '过期' ? '登录验证过期' : '获取失败'}`);
        continue;
      }
      if (game === 'zzz' && data && !data.s2_bounty_commission) {
        data.s2_bounty_commission = { num: 0, total: 0 };
      }
      list.push(this.toMultiCard(game, data));
    }

    if (!list.length) {
      await e.reply(fails.length ? fails.join('\n') : `未获取到任何${meta.name}体力数据`, true);
      return true;
    }

    if (list.length > 4) {
      const nodes = [];
      for (let i = 0; i < list.length; i += 4) {
        const chunk = list.slice(i, i + 4);
        const img = await this.renderTlImage(e, { multi_list: chunk, multi_game_name: meta.name });
        if (img) nodes.push([`${meta.name}体力 ${i + 1}-${i + chunk.length}/${list.length}`, img]);
      }
      if (fails.length) nodes.push(`以下UID获取失败：\n${fails.join('\n')}`);
      const forward = await makeForwardMsg(e, nodes, `${meta.name}全部UID体力（${list.length}个）`);
      await e.reply(forward);
      return true;
    }

    const img = await this.renderTlImage(e, { multi_list: list, multi_game_name: meta.name });
    if (img) await e.reply(img);
    if (fails.length) await e.reply(`以下UID获取失败：\n${fails.join('\n')}`, true);
    return true;
  }

  async noteWithTempUid(e, game = 'gs', uid = '') {
    const user = e.user;
    const oldUid = user?.getUid?.(game) || '';
    const gameKey = game;
    try {
      if (user?.setMainUid) {
        user.setMainUid(uid, gameKey, false);
      }
      if (String(user?.getUid?.(gameKey) || '') !== String(uid) && user?.getGameDs) {
        user.getGameDs(gameKey).uid = String(uid);
      } else if (!user?.setMainUid && user?._games?.[gameKey]) {
        user._games[gameKey].uid = String(uid);
      }
      return await this.note(e, game, true);
    } finally {
      try {
        if (user?.setMainUid) {
          user.setMainUid(oldUid, gameKey, false);
        } else if (user?._games?.[gameKey]) {
          user._games[gameKey].uid = oldUid;
        }
      } catch (_) {}
    }
  }

  getStokenEntry(e, uid) {
    const stokenPath = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    if (!uid || !fs.existsSync(stokenPath)) return null;
    try {
      const data = yaml.get(stokenPath) || {};
      return data[uid] || null;
    } catch (_) {
      return null;
    }
  }

  toMultiCard(game = 'gs', data = {}) {
    const common = {
      uid: data.uid,
      level: data.level || 0,
      name: data.name || '未知',
      time: data.time || '已满',
    };
    if (game === 'gs') {
      return {
        ...common,
        icon: 'Tl/imgs/原神.jpg',
        mainIcon: 'Tl/imgs/树脂.png',
        mainName: '原粹树脂',
        current: data.current_resin || 0,
        max: data.max_resin || 160,
        mainWarn: Number(data.current_resin || 0) > 160,
        signed: !!data.has_signed,
        signText: data.has_signed ? '今日已签' : '尚未签到',
        rows: [
          { icon: 'Tl/imgs/冒险委托.png', label: '冒险委托', value: `${data.finished_task_num || 0}/${data.total_task_num || 4}`, warn: (data.finished_task_num || 0) < (data.total_task_num || 4) },
          { icon: 'Tl/imgs/冒险委托.png', label: '委托奖励', value: data.is_extra_task_reward_received ? '已领取' : '未领取', warn: !data.is_extra_task_reward_received },
          { icon: 'Tl/imgs/洞天宝钱.png', label: '洞天财瓮', value: `${data.current_home_coin || 0}/${data.max_home_coin || 0}`, warn: Number(data.current_home_coin || 0) > 2000 },
          { icon: 'Tl/imgs/探索派遣.png', label: '探索派遣', value: `${data.current_expedition_num || 0}/${data.max_expedition_num || 0}`, warn: false },
          { icon: 'Tl/imgs/探索派遣.png', label: '派遣完成', value: data.expeditions_ ? '已全部完成' : '未完成', warn: !!data.expeditions_ },
        ],
      };
    }
    if (game === 'sr') {
      return {
        ...common,
        icon: 'Tl/imgs/星铁.jpg',
        mainIcon: 'Tl/imgs/开拓力.png',
        mainName: '开拓力',
        current: data.current_stamina || 0,
        max: data.max_stamina || 240,
        mainWarn: Number(data.current_stamina || 0) > 260,
        signed: !!data.has_signed,
        signText: data.has_signed ? '今日已签' : '尚未签到',
        rows: [
          { icon: 'Tl/imgs/每日实训.png', label: '每日实训', value: `${data.current_train_score || 0}/${data.max_train_score || 500}`, warn: (data.current_train_score || 0) < (data.max_train_score || 500) },
          { icon: 'Tl/imgs/模拟宇宙.png', label: '模拟宇宙', value: `${data.current_rogue_score || 0}/${data.max_rogue_score || 0}`, warn: (data.current_rogue_score || 0) < (data.max_rogue_score || 0) },
          { icon: 'Tl/imgs/委托执行.png', label: '委托执行', value: `${data.accepted_expedition_num || 0}/${data.total_expedition_num || 0}`, warn: false },
          { icon: 'Tl/imgs/后备开拓力.png', label: '后备开拓力', value: `${data.current_reserve_stamina || 0}`, warn: false },
        ],
      };
    }
    if (game === 'zzz') {
      return {
        ...common,
        icon: 'Tl/imgs/绝区零.jpg',
        mainIcon: 'Tl/imgs/电池.png',
        mainName: '电量',
        current: data.energy?.progress?.current || 0,
        max: data.energy?.progress?.max || 240,
        mainWarn: Number(data.energy?.progress?.current || 0) > 200,
        signed: data.has_signed || data.card_sign === 'CardSignDone',
        signText: (data.has_signed || data.card_sign === 'CardSignDone') ? '今日已签' : '尚未签到',
        rows: [
          { icon: 'Tl/imgs/活跃度.png', label: '今日活跃度', value: `${data.vitality?.current || 0}/${data.vitality?.max || 400}`, warn: (data.vitality?.current || 0) < (data.vitality?.max || 400) },
          { icon: 'Tl/imgs/zzz.png', label: '刮刮卡', value: data.card_sign === 'CardSignDone' ? '今日已签' : '尚未签到', warn: data.card_sign !== 'CardSignDone' },
          { icon: 'Tl/imgs/zzz.png', label: '录像店', value: data.vhs_sale?.sale_state === 'SaleStateDoing' ? '营业中' : '待结算', warn: false },
          { icon: 'Tl/imgs/zzz.png', label: '悬赏委托', value: `${data.s2_bounty_commission?.num || 0}/${data.s2_bounty_commission?.total || 0}`, warn: (data.s2_bounty_commission?.num || 0) < (data.s2_bounty_commission?.total || 0) },
        ],
      };
    }
    return {
      ...common,
      icon: 'bh3_note/bh3_icon.png',
      mainIcon: 'bh3_note/stamina.png',
      iconClass: 'bh3-stamina-icon',
      mainName: '体力',
      current: data.current_stamina || 0,
      max: data.max_stamina || 200,
      mainWarn: Number(data.current_stamina || 0) >= Number(data.max_stamina || 200),
      signed: !!data.is_sign,
      signText: data.is_sign ? '今日已签' : '尚未签到',
      rows: [
        { icon: 'Tl/imgs/活跃度.png', label: '历练值', value: `${data.current_train_score || 0}/${data.max_train_score || 500}`, warn: (data.current_train_score || 0) < (data.max_train_score || 500) },
        { icon: 'Tl/imgs/zzz.png', label: data.abyss_name || '超弦空间', value: data.abyss ? (data.abyss.is_open ? '进行中' : '未开启') : '暂无', warn: false },
        { icon: 'Tl/imgs/zzz.png', label: '记忆战场', value: data.battle_field ? `${data.battle_field.cur_reward || 0}/${data.battle_field.max_reward || 0}` : '暂无', warn: false },
        { icon: 'Tl/imgs/zzz.png', label: '往世乐土', value: data.god_war ? `${data.god_war.cur_reward || 0}/${data.god_war.max_reward || 0}` : '暂无', warn: false },
      ],
    };
  }


  async getBh3Auth(e, uidOverride = '') {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at') { qq = msg.qq; break; }
    }

    let uid = uidOverride || await redis.get(`xhh:bh3_uid:${qq}`);
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

  async bh3Note(e, san = true, uidOverride = '') {
    const auth = await this.getBh3Auth(e, uidOverride);
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
        api(e, { type: 'bh3_index', uid: auth.uid, headers, game: 'bh3', server: auth.region, silent: san }),
        api(e, { type: 'bh3_note', uid: auth.uid, headers, game: 'bh3', server: auth.region, silent: san }),
        api(e, { type: 'sign_info', uid: auth.uid, headers: signHeaders, game: 'bh3', server: auth.region, silent: true }).catch(() => null),
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
  async note(e, game = 'gs', san = true, uidOverride = '') {
    let uid = uidOverride || e.user.getUid(game);

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
    const entry = uidOverride ? this.getStokenEntry(e, uid) : null;
    const defaultUid = e.user?.getUid?.(game);
    const useRoleEndpoint = !!uidOverride && String(uid) !== String(defaultUid || '');
    const reqCk = useRoleEndpoint && game === 'gs' ? await ensureCookieToken(e, sk, entry) : sk;
    let headers = mhy.getHeaders(e, reqCk, useRoleEndpoint ? true : false);
    let url = game == 'gs' && useRoleEndpoint
      ? `${this.gsDailyNoteUrl}?server=${encodeURIComponent(entry?.region || mhy.getServer(uid, 'gs') || 'cn_gf01')}&role_id=${encodeURIComponent(uid)}`
      : game == 'sr' && useRoleEndpoint
        ? `${this.srNoteUrl}?server=${encodeURIComponent(entry?.region || mhy.getServer(uid, 'sr') || 'prod_gf_cn')}&role_id=${encodeURIComponent(uid)}`
        : game == 'zzz' && useRoleEndpoint
          ? `${this.zzzNoteUrl}?server=${encodeURIComponent(entry?.region || mhy.getServer(uid, 'zzz') || 'prod_gf_cn')}&role_id=${encodeURIComponent(uid)}`
          : game == 'gs' ? this.gsUrl : game == 'sr' ? this.srUrl : this.zzzUrl;
    if (config().debug && uidOverride) logger.mark(`[xhh][TL] ${game} uid=${uid} roleEndpoint=${useRoleEndpoint} url=${url}`);
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
      if (uidOverride) return { error: res?.message || `接口返回异常(${res?.retcode ?? '无响应'})` };
      return false;
    }
    let time =
      res.data.resin_recovery_time ||
      res.data.stamina_recover_time ||
      res.data.energy?.restore;
    if (!time) time = 0;
    const roleHeaders = uidOverride ? mhy.getHeaders(e, sk, false) : headers;
    let game_ = await this.getGameDate(e, roleHeaders, uid);
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
      silent: true,
    });
    let data;
    if (!Array.isArray(res?.data?.list)) return data;
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
