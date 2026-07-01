import fetch from 'node-fetch';
import fs from 'fs';

import {
    sleep,
    api,
    mhy,
    render,
    yaml
} from '#xhh';
import NoteUser from '../../genshin/model/mys/NoteUser.js';


function cookiePart(ck = '', key) {
    const m = String(ck).match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
    return m ? m[1] : '';
}

function getStokenEntry(qq, uid) {
    const path = `./plugins/xhh/data/Stoken/${qq}.yaml`;
    if (!fs.existsSync(path)) return null;
    try {
        return (yaml.get(path) || {})[uid] || null;
    } catch (_) {
        return null;
    }
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
        logger.debug?.(`[xhh][sign] refresh cookie_token failed: ${err.message}`);
    }
    return ck;
}

async function getSignCookieAndServer(e, game, uid, ck) {
    let server;
    if (game === 'bh3') {
        const entry = getStokenEntry(e.user_id, uid);
        if (entry) {
            server = entry.region;
            ck = entry.ck_stoken || ck;
        }
        ck = await ensureCookieToken(e, ck, entry);
    }
    return { ck, server };
}

async function MysSign(e, games) {
    if (
        !e.user.getMysUser() &&
        !e.user.getMysUser('sr') &&
        !e.user.getMysUser('zzz') &&
        !e.user.getMysUser('bh3')
    )
        return e.reply('未绑定米游社ck,请发送[扫码绑定]', true);
    let msgs = [];
    let bj = 1;
    for (let game of games) {
        const mys = e.user.getMysUser(game);
        if (!mys) continue;
            const ck = mys.ck;
            const uids = mys.uids;
            const game_name = game == 'gs' ? '原神' : game == 'sr' ? '星铁' : game == 'zzz' ? '绝区零' : '崩坏3';
            for (let i = 0; i < uids[game].length; i++) {
                const uid = uids[game][i];
                if (i > 0) await sleep(1000);
                const signOpt = await getSignCookieAndServer(e, game, uid, ck);
                let headers = mhy.getHeaders(e, signOpt.ck);
                const Ds = mhy.getDsSign();
                headers.DS = Ds;
                headers.Origin = 'https://act.mihoyo.com';
                headers.Referer = 'https://act.mihoyo.com';
                //必加参数
                if (game === 'gs') headers['x-rpc-signgame'] = 'hk4e';
                else if (game === 'sr') headers['x-rpc-signgame'] = 'hkrpg';
                else if (game === 'zzz') headers['x-rpc-signgame'] = 'zzz';
                else delete headers['x-rpc-signgame'];
                let data = {
                    game,
                    uid,
                    headers,
                    server: signOpt.server,
                    type: 'sign_info',
                };
            let res = await api(e, data);
            /**
             * 报错
             */
            if (typeof res == 'string') {
                msgs.push({
                    game: game_name,
                    uid: uid,
                    tip: res,
                });
                logger.mark(`[${game_name}签到失败]QQ: ${e.user_id},UID: ${uid}`);
            } else if (res.retcode == 0 && res.data) {
                /**
                 * 查询签到状态成功
                 */
                //已经签到
                const day = res.data.total_sign_day;
                const rew = await reward(e, data);
                if (res.data.is_sign == true) {
                    msgs.push({
                        game: game_name,
                        uid: uid,
                        icon: rew[day - 1].icon,
                        tip: '今日已签',
                        day: day,
                        cnt: rew[day - 1].cnt,
                    });
                    if (bj) {
                        add(e);
                        bj = 0;
                    }
                } else {
                    //未签到,开始签到
                    logger.mark(`[${game_name}签到]QQ: ${e.user_id},UID: ${uid}`);
                    data.type = 'sign';
                    const sign_res = await api(e, data);
                    //签到成功
                    if (sign_res.retcode == 0) {
                        msgs.push({
                            game: game_name,
                            uid: uid,
                            icon: rew[day].icon,
                            tip: '签到成功',
                            day: day + 1,
                            cnt: rew[day].cnt,
                        });
                        if (bj) {
                            add(e);
                            bj = 0;
                        }
                    }
                    //签到失败
                    else if (typeof sign_res == 'string') {
                        msgs.push({
                            game: game_name,
                            uid: uid,
                            tip: sign_res,
                        });
                    }
                }
            }
        }
    }
    const data_ = {
        msgs,
        qq: e.user_id,
        name: e.sender.card || e.sender.nickname,
    };
    //渲染
    return render('sign/sign', data_, {
        e,
        ret: true,
    });
}

function add(e) {
    const path = './plugins/xhh/config/sign.yaml';
    const data = yaml.get(path);
    if (!data.zd_sign || !e.isGroup) return;
    if (data.sign_group && !data.sign_group.includes(e.group_id)) return;
    if (!data.sign) {
        data.sign = {};
    } else {
        const arrays = Object.values(data.sign);
        const allNumbers = arrays.flat();
        if (allNumbers.includes(e.user_id)) return;
    }
    let qqs = data.sign[e.group_id] || []
    if (qqs.includes(e.user_id)) return;
    qqs.push(e.user_id);
    data.sign[e.group_id] = qqs;
    return yaml.set(path, 'sign', data.sign);
}


const BBS_FORUMS = [
    { name: '崩坏3', signId: '1', forumId: '1' },
    { name: '原神', signId: '2', forumId: '26' },
    { name: '崩坏2', signId: '3', forumId: '30' },
    { name: '未定事件簿', signId: '4', forumId: '37' },
    { name: '大别野', signId: '5', forumId: '34' },
    { name: '崩坏星穹铁道', signId: '6', forumId: '52' },
    { name: '绝区零', signId: '8', forumId: '57' },
];

function getBbsAccounts(e) {
    const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    const accounts = new Map();
    if (fs.existsSync(path)) {
        const data = yaml.get(path) || {};
        for (const entry of Object.values(data)) {
            if (!entry?.stuid || !entry?.stoken) continue;
            if (accounts.has(String(entry.stuid))) continue;
            const ck = entry.ck_stoken || `stuid=${entry.stuid};stoken=${entry.stoken};${entry.mid ? `mid=${entry.mid};` : ''}`;
            accounts.set(String(entry.stuid), { stuid: String(entry.stuid), ck });
        }
    }
    return [...accounts.values()];
}

function bbsBaseHeaders(e, ck, body = '', useBodyDs = false) {
    const headers = mhy.getHeaders(e, ck);
    headers.Cookie = ck;
    headers.DS = useBodyDs ? mhy.getDs2('', body, 't0qEgfub6cvueAPgR5m9aQWWVciEer7v') : mhy.getDs('S9Hrn38d2b55PamfIR9BNA3Tx9sQTOem');
    headers['Content-Type'] = 'application/json';
    headers['x-rpc-app_version'] = '2.70.1';
    headers['x-rpc-client_type'] = '2';
    headers['x-rpc-device_model'] = 'Mi 10';
    headers['x-rpc-device_name'] = 'Mi 10';
    headers['x-rpc-channel'] = 'miyousheluodi';
    headers['x-rpc-sys_version'] = '12';
    headers['x-rpc-device_id'] = mhy.getDeviceGuid().replace(/-/g, '').toUpperCase();
    headers.Referer = 'https://app.mihoyo.com';
    headers['User-Agent'] = 'okhttp/4.8.0';
    delete headers.Origin;
    delete headers['X-Requested-With'];
    return headers;
}

async function bbsJson(e, account, url, body = null, useBodyDs = false) {
    const bodyText = body ? JSON.stringify(body) : '';
    const headers = bbsBaseHeaders(e, account.ck, bodyText, useBodyDs);
    return fetch(url, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? bodyText : undefined,
    }).then(r => r.json());
}

async function bbsForumTasks(e, account, forum) {
    const listUrl = `https://bbs-api.miyoushe.com/post/api/getForumPostList?forum_id=${forum.forumId}&is_good=false&is_hot=false&page_size=20&sort_type=1`;
    const listRes = await bbsJson(e, account, listUrl);
    const posts = (listRes?.data?.list || []).map(v => v.post).filter(v => v?.post_id);
    if (!posts.length) return '浏览0 点赞0 分享0';
    let browse = 0, vote = 0, share = 0;
    for (const post of posts.slice(0, 3)) {
        const res = await bbsJson(e, account, `https://bbs-api.miyoushe.com/post/api/getPostFull?post_id=${post.post_id}`);
        if (res?.retcode === 0) browse++;
        await sleep(200);
    }
    for (const post of posts.slice(0, 5)) {
        const res = await bbsJson(e, account, 'https://bbs-api.miyoushe.com/post/api/post/upvote', { post_id: post.post_id, is_cancel: false });
        if (res?.retcode === 0) vote++;
        if (res?.retcode === -300) break;
        await sleep(200);
    }
    const shareRes = await bbsJson(e, account, `https://bbs-api.miyoushe.com/apihub/api/getShareConf?entity_id=${posts[0].post_id}&entity_type=1`);
    if (shareRes?.retcode === 0) share++;
    return `浏览${browse} 点赞${vote} 分享${share}`;
}

async function bbsForumSign(e, account, forum) {
    const signRes = await bbsJson(e, account, 'https://bbs-api.miyoushe.com/apihub/app/api/signIn', { gids: forum.signId }, true);
    let signTip;
    if (signRes?.retcode === 0) signTip = '签到成功';
    else if (signRes?.retcode === 1008 || /已经|已签到|重复/.test(signRes?.message || '')) signTip = '今日已签';
    else if (signRes?.retcode === 1034) return '遇到验证码';
    else if (signRes?.retcode === -100) return '登录失效';
    else signTip = signRes?.message || `失败(${signRes?.retcode ?? '无返回'})`;
    let taskTip = '';
    try {
        taskTip = await bbsForumTasks(e, account, forum);
    } catch (err) {
        logger.debug?.(`[xhh][bbs_task] ${forum.name}: ${err.message}`);
    }
    return taskTip ? `${signTip} ${taskTip}` : signTip;
}

async function BbsAllSign(e) {
    const accounts = getBbsAccounts(e);
    if (!accounts.length) return e.reply('未找到米游社SToken，请先扫码绑定', true);
    const lines = ['米游社社区全部签到'];
    for (const account of accounts) {
        lines.push(`\n通行证 ${account.stuid}`);
        for (const forum of BBS_FORUMS) {
            let tip = '签到异常';
            try {
                tip = await bbsForumSign(e, account, forum);
            } catch (err) {
                logger.error(`[xhh][bbs_sign] ${account.stuid} ${forum.name}: ${err.message}`);
            }
            lines.push(`${forum.name}：${tip}`);
            await sleep(500);
        }
    }
    return e.reply(lines.join('\n'), true);
}

async function BbsSign(e) {
    if (/全部/.test(e.msg || '')) return BbsAllSign(e);
    const mys = e.user.getMysUser('gs');
    if (!mys) return e.reply('未绑定米游社,请发送[扫码绑定]', true);
    const ck = mys.ck;
    let headers = mhy.getHeaders(e, ck);
    headers.DS = mhy.getDsSign();
    headers.Origin = 'https://act.mihoyo.com';
    headers.Referer = 'https://act.mihoyo.com';

    const data = { headers, type: 'bbs_sign_info' };
    let res = await api(e, data);
    if (typeof res == 'string') return e.reply(`社区签到失败：${res}`, true);
    if (res?.retcode !== 0) return e.reply('社区签到查询失败', true);

    const info = res.data || {};
    if (info.is_sign) {
        return e.reply(`✅ 今日已签到米游社社区\n连续签到 ${info.total_sign_day || 0} 天`, true);
    }

    data.type = 'bbs_sign';
    const signRes = await api(e, data);
    if (signRes?.retcode === 0) {
        return e.reply(`✅ 社区签到成功！\n连续签到 ${(info.total_sign_day || 0) + 1} 天`, true);
    }
    return e.reply('❌ 社区签到失败，请稍后重试', true);
}

async function reward(e, data) {
    let rew = await redis.get(`xhh:sign:${data.game}`);
    if (rew) return JSON.parse(rew);
    data.type = 'sign_home';
    const res = await api(e, data);
    const time = getSecondsToMidnight();
    await redis.set(`xhh:sign:${data.game}`, JSON.stringify(res.data.awards), {
        EX: time,
    });
    return res.data.awards;
}

//获取到次日0点的时间（秒）
function getSecondsToMidnight() {
    // 获取当前时间
    const now = new Date();

    // 创建次日0点时间对象
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    // 计算时间差并转换为秒（取整）
    return Math.floor((midnight - now) / 1000);
}

async function zd_MysSign(qqs) {
    let num = 0,
        z_num = 0,
        cg_qqs = [],
        sbai_qqs = [];
    const games = ['gs', 'sr', 'zzz', 'bh3'];
    for (let qq of qqs) {
        let e = {};
        e.user_id = qq;
        // e.reply = (msg) => { }
        for (let game of games) {
            let user = (await NoteUser.create(qq)).getMysUser(game); //只要当前xx游戏绑定ck的账号信息（原神可能有多个，如渠道服）
            if (!user) continue;
            const ck = user.ck;
            const uids = user.uids[game];
            for (let i = 0; i < uids.length; i++) {
                z_num++;
                const uid = uids[i];
                if (i > 0) await sleep(1000);
                const signOpt = await getSignCookieAndServer(e, game, uid, ck);
                let headers = mhy.getHeaders(e, signOpt.ck);
                const Ds = mhy.getDsSign();
                headers.DS = Ds;
                headers.Origin = 'https://act.mihoyo.com';
                headers.Referer = 'https://act.mihoyo.com';
                //必加参数
                if (game === 'gs') headers['x-rpc-signgame'] = 'hk4e';
                else if (game === 'sr') headers['x-rpc-signgame'] = 'hkrpg';
                else if (game === 'zzz') headers['x-rpc-signgame'] = 'zzz';
                else delete headers['x-rpc-signgame'];
                let data = {
                    game,
                    uid,
                    headers,
                    server: signOpt.server,
                    type: 'sign_info',
                };
                let res = await api(e, data);
                /**
                 * 报错
                 */
                if (typeof res == 'string') {
                    if (!sbai_qqs.includes(qq)) {
                        if (cg_qqs.includes(qq)) {
                            const index = cg_qqs.indexOf(qq);
                            cg_qqs.splice(index, 1);
                        }
                        sbai_qqs.push(qq);
                    }
                    continue;
                } else if (res.retcode == 0 && res.data) {
                    /**
                     * 查询签到状态成功
                     */
                    //已经签到
                    if (res.data.is_sign == true) {
                        if (!cg_qqs.includes(qq)) {
                            cg_qqs.push(qq);
                        }
                        num++;
                        continue;
                    } else {
                        //未签到,开始签到
                        data.type = 'sign';
                        const sign_res = await api(e, data);
                        //签到成功
                        if (sign_res.retcode == 0) {
                            if (!cg_qqs.includes(qq)) {
                                cg_qqs.push(qq);
                            }
                            num++;
                            continue;
                        }
                        //签到失败
                        else if (typeof sign_res == 'string') {
                            if (!sbai_qqs.includes(qq)) {
                                if (cg_qqs.includes(qq)) {
                                    const index = cg_qqs.indexOf(qq);
                                    cg_qqs.splice(index, 1);
                                }
                                sbai_qqs.push(qq);
                            }
                            continue;
                        }
                    }
                }
                await sleep(500);
            }
            await sleep(500);
        }
        await sleep(500);
    }

    return {
        num,
        z_num,
        cg_qqs,
        sbai_qqs,
    };
}

export {
    MysSign,
    zd_MysSign,
    BbsSign,
};
