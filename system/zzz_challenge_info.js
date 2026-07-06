import NoteUser from '../../genshin/model/mys/NoteUser.js';
import { mhy, api } from '#xhh';

const zzzServerMap = {
  cn_gf01: '国服',
  cn_qd01: 'B服',
  os_usa: '美服',
  os_euro: '欧服',
  os_asia: '亚服',
  os_cht: '港澳台服',
};

async function getZzzAuth(e) {
  const qq = e?.at || e?.user_id;
  let uid = '';
  let ck = '';
  try {
    const nu = await NoteUser.create(qq);
    uid = nu.getUid('zzz');
    ck = nu.getMysUser('zzz')?.ck || '';
  } catch (_) {}
  if (!uid && e?.user?.getUid) {
    try { uid = e.user.getUid('zzz'); } catch (_) {}
  }
  if (!ck && e?.user?.getMysUser) {
    try { ck = e.user.getMysUser('zzz')?.ck || ''; } catch (_) {}
  }
  const region = uid ? mhy.getServer(uid, 'zzz') : 'cn_gf01';
  return { qq, uid, region, ck };
}

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function fmtTime(t = {}) {
  if (!t || !t.year) return '';
  const pad = n => String(n || 0).padStart(2, '0');
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

export function formatCurrentZzzDefenseInfo(info, compact = false) {
  if (!info) return '';
  const prefix = compact ? '本期防卫战速查' : '绝区零当前式舆防卫战';
  return [
    prefix,
    info.period ? `周期：${info.period}` : '',
    info.rating ? `评价：${info.rating}` : '',
    info.score ? `分数：${info.score}` : '',
    `数据源：${info.nickname || '已绑定账号'} ${info.region || ''}`,
  ].filter(Boolean).join('\n');
}

export function formatCurrentZzzDeadlyInfo(info, compact = false) {
  if (!info) return '';
  const prefix = compact ? '本期危局速查' : '绝区零当前危局强袭战';
  const bosses = info.bosses?.length ? info.bosses.join(' / ') : '未知';
  return [
    prefix,
    info.period ? `周期：${info.period}` : '',
    `Boss：${bosses}`,
    `星数：${info.star || 0}/${info.totalStar || 9}`,
    info.score ? `总分：${info.score}` : '',
    `数据源：${info.nickname || '已绑定账号'} ${info.region || ''}`,
  ].filter(Boolean).join('\n');
}

export async function getCurrentZzzDefenseInfoByEvent(e) {
  const auth = await getZzzAuth(e);
  if (!auth.uid || !auth.ck) return null;
  const headers = mhy.getHeaders({ user_id: auth.qq || e?.user_id || 0 }, auth.ck);
  const res = await api(e, { type: 'zzz_challenge', uid: auth.uid, server: auth.region, headers, game: 'zzz', schedule_type: 1, silent: true });
  const data = res?.data?.hadal_info_v2 || res?.data;
  if (res?.retcode !== 0 || !data) return null;
  const brief = data.brief || {};
  const period = data.hadal_begin_time && data.hadal_end_time
    ? `${fmtTime(data.hadal_begin_time)} ~ ${fmtTime(data.hadal_end_time)}`
    : '';
  return {
    period,
    rating: brief.rating || '',
    score: brief.score || 0,
    nickname: '',
    region: zzzServerMap[auth.region] || auth.region,
  };
}

export async function getCurrentZzzDeadlyInfoByEvent(e) {
  const auth = await getZzzAuth(e);
  if (!auth.uid || !auth.ck) return null;
  const headers = mhy.getHeaders({ user_id: auth.qq || e?.user_id || 0 }, auth.ck);
  const res = await api(e, { type: 'zzz_deadly', uid: auth.uid, server: auth.region, headers, game: 'zzz', schedule_type: 1, silent: true });
  const data = res?.data;
  if (res?.retcode !== 0 || !data?.has_data) return null;
  const bosses = uniq((data.list || []).flatMap(item => (item.boss || []).map(v => v?.name)));
  return {
    period: data.start_time && data.end_time ? `${fmtTime(data.start_time)} ~ ${fmtTime(data.end_time)}` : '',
    bosses,
    star: data.total_star || 0,
    totalStar: 9,
    score: data.total_score || 0,
    nickname: data.nick_name || '',
    region: zzzServerMap[auth.region] || auth.region,
  };
}
