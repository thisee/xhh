import fs from 'fs';
import moment from 'moment';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import { yaml, mhy, api, config } from '#xhh';

const STOKEN_DIR = './plugins/xhh/data/Stoken';
const BH3_REGIONS = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02', 'cn_gf01', 'cn_qd01'];
const CACHE_KEY = 'xhh:bh3:current_abyss_info';

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

const oldAbyssLevelMap = { 1: '禁忌', 2: '原罪', 3: '苦痛', 4: '红莲', 5: '寂灭' };
const oldAbyssLetterMap = { S: '寂灭', A: '红莲', B: '苦痛', C: '原罪', D: '禁忌' };

function fmtTs(ts) {
  if (!ts) return '未知';
  const sec = Number(ts);
  if (!sec) return '未知';
  const ms = sec > 1e12 ? sec : sec * 1000;
  return moment(ms).format('MM-DD HH:mm');
}

function getSettleTs(r = {}) {
  return r.schedule_end || r.time_second || r.settled_time_second || r.settle_time_second || r.settle_time || r.end_time || r.finish_time || r.updated_time_second;
}

function fmtLevel(level, isOld = false) {
  if (level === undefined || level === null) return '未知';
  if (typeof level === 'string') {
    const clean = level.replace(/^LV\.?/i, '').toUpperCase();
    if (isOld && oldAbyssLetterMap[clean]) return oldAbyssLetterMap[clean];
  }
  if (isOld && oldAbyssLevelMap[level]) return oldAbyssLevelMap[level];
  return abyssLevelMap[level] || `Lv.${level}`;
}

async function getAuthByQQ(qq, preferredUid = '') {
  let uid = preferredUid || await redis.get(`xhh:bh3_uid:${qq}`);
  let region = uid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
  let ck = null;

  const stokenPath = `${STOKEN_DIR}/${qq}.yaml`;
  if (fs.existsSync(stokenPath)) {
    const stokenData = yaml.get(stokenPath) || {};
    if (!uid) {
      for (const key of Object.keys(stokenData)) {
        const entry = stokenData[key];
        if (BH3_REGIONS.includes(entry?.region || '')) {
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

async function findAnyBh3Auth() {
  if (!fs.existsSync(STOKEN_DIR)) return null;
  const files = fs.readdirSync(STOKEN_DIR).filter(f => f.endsWith('.yaml'));
  for (const file of files) {
    const qq = file.replace(/\.yaml$/, '');
    const data = yaml.get(`${STOKEN_DIR}/${file}`) || {};
    for (const [uid, entry] of Object.entries(data)) {
      if (!BH3_REGIONS.includes(entry?.region || '')) continue;
      const auth = await getAuthByQQ(qq, uid);
      if (auth.uid && auth.ck) return auth;
    }
  }
  return null;
}

function buildInfo(label, report, role, region) {
  const isOld = label === '量子流形';
  const chars = (report.lineup || []).map(c => c.name).filter(Boolean);
  return {
    label,
    boss: report.boss?.name || '未知',
    level: fmtLevel(report.level, isOld),
    score: report.score || 0,
    rank: report.rank || 0,
    settle: fmtTs(getSettleTs(report)),
    lineup: chars,
    elf: report.elf?.name || '',
    uid: role?.role_id || '',
    nickname: role?.nickname || '',
    region: serverMap[region] || region,
    dataTime: moment().format('MM-DD HH:mm'),
  };
}

export function formatCurrentAbyssInfo(info, compact = false) {
  if (!info) return '';
  const lineup = info.lineup?.length ? info.lineup.join(' / ') : '暂无阵容数据';
  const elf = info.elf ? `\n助战/人偶：${info.elf}` : '';
  const prefix = compact ? '本期深渊速查' : '崩坏3当前深渊';
  return [
    `${prefix}`,
    `类型：${info.label}`,
    `分组：${info.level}`,
    `Boss：${info.boss}`,
    `结算：${info.settle}`,
    `参考阵容：${lineup}${elf}`,
    `数据源：${info.nickname || '已绑定账号'} ${info.region || ''} ${info.dataTime || ''}`,
  ].filter(Boolean).join('\n');
}

export async function fetchCurrentAbyssInfo(auth) {
  if (!auth?.uid || !auth?.ck) return null;
  const e = { user_id: auth.qq || 0 };
  const headers = mhy.getHeaders(e, auth.ck);
  const indexRes = await api(e, { type: 'bh3_index', uid: auth.uid, headers, game: 'bh3', server: auth.region });
  if (indexRes?.retcode !== 0) return null;
  const role = indexRes.data?.role || {};
  const level = Number(role.level || 0);
  const queryList = level > 0 && level <= 80
    ? [{ type: 'bh3_old_abyss', label: '量子流形' }, { type: 'bh3_new_abyss', label: '超弦空间' }]
    : [{ type: 'bh3_new_abyss', label: '超弦空间' }, { type: 'bh3_old_abyss', label: '量子流形' }];
  const serverValues = [...new Set([auth.region, mhy.getServer(auth.uid, 'bh3'), 'cn_gf01', 'cn_qd01'].filter(Boolean))];

  for (const server of serverValues) {
    for (const item of queryList) {
      try {
        const res = await api(e, { type: item.type, uid: auth.uid, headers, game: 'bh3', server, silent: true });
        const reports = (res?.data?.reports || []).sort(
          (a, b) => Number(getSettleTs(b) || 0) - Number(getSettleTs(a) || 0)
        );
        if (res?.retcode === 0 && reports.length) {
          const info = buildInfo(item.label, reports[0], role, server);
          await redis.set(CACHE_KEY, JSON.stringify(info), { EX: 2 * 3600 });
          return info;
        }
      } catch (err) {
        if (config().debug) logger.mark(`[xhh][bh3_abyss_boss] ${item.label} ${server} failed: ${err.message}`);
      }
    }
  }
  return null;
}

export async function getCurrentAbyssInfoByEvent(e) {
  const qq = e?.at || e?.user_id;
  const auth = await getAuthByQQ(qq);
  return fetchCurrentAbyssInfo(auth);
}

export async function getAnyCurrentAbyssText(compact = true) {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return formatCurrentAbyssInfo(JSON.parse(cached), compact);
  } catch (_) {}
  const auth = await findAnyBh3Auth();
  const info = auth ? await fetchCurrentAbyssInfo(auth) : null;
  return info ? formatCurrentAbyssInfo(info, compact) : '';
}
