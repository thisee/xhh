import {
    sleep,
    api,
    mhy,
    render,
    yaml
} from '#xhh'
import NoteUser from '../../genshin/model/mys/NoteUser.js'

async function MysSign(e, games) {
    if (!e.user.getMysUser() && !e.user.getMysUser('sr') && !e.user.getMysUser('zzz')) return e.reply('未绑定米游社ck,请发送[扫码绑定]', true)
    let msgs = []
    let bj = 1
    for (let game of games) {
        const mys = e.user.getMysUser(game)
        if (!mys) continue
        const ck = mys.ck
        const uids = mys.uids
        const game_name = game == 'gs' ? '原神' : game == 'sr' ? '星铁' : '绝区零'
        for (let i = 0; i < uids[game].length; i++) {
            const uid = uids[game][i]
            if (i > 0) await sleep(1000)
            let headers = mhy.getHeaders(e, ck)
            const Ds = mhy.getDsSign()
            headers.DS = Ds
            headers.Origin = 'https://act.mihoyo.com'
            headers.Referer = 'https://act.mihoyo.com'
            //必加参数
            headers['x-rpc-signgame'] = game == 'zzz' ? 'zzz' : game == 'sr' ? 'hkrpg' : 'hk4e'
            let data = {
                game,
                uid,
                headers,
                type: 'sign_info'
            }
            let res = await api(e, data)
            /**
             * 报错
             */
            if (typeof res == 'string') {
                msgs.push({
                    game: game_name,
                    uid: uid,
                    tip: res
                })
                logger.mark(`[${game_name}签到失败]QQ: ${e.user_id},UID: ${uid}`)
            }
            /**
             * 查询签到状态成功
             */
            else if (res.retcode == 0 && res.data) {
                //已经签到
                const day = res.data.total_sign_day
                const rew = await reward(e, data)
                if (res.data.is_sign == true) {
                    msgs.push({
                        game: game_name,
                        uid: uid,
                        icon: rew[day - 1].icon,
                        tip: '今日已签',
                        day: day,
                        cnt: rew[day - 1].cnt
                    })
                    if (bj) {
                        add(e)
                        bj = 0
                    }
                } else {
                    //未签到,开始签到
                    logger.mark(`[${game_name}签到]QQ: ${e.user_id},UID: ${uid}`)

                    data.type = 'sign'
                    const sign_res = await api(e, data)
                    logger.error(sign_res)
                    //签到成功
                    if (sign_res.retcode == 0) {
                        msgs.push({
                            game: game_name,
                            uid: uid,
                            icon: rew[day].icon,
                            tip: '签到成功',
                            day: day + 1,
                            cnt: rew[day].cnt
                        })
                        if (bj) {
                            add(e)
                            bj = 0
                        }
                    }
                    //签到失败 
                    else if (typeof sign_res == 'string') {
                        msgs.push({
                            game: game_name,
                            uid: uid,
                            tip: sign_res
                        })
                    }
                }
            }
        }
    }
    const data_ = {
        msgs,
        qq: e.user_id,
        name: e.sender.nickname
    }
    //渲染
    return render('sign/sign', data_, {
        e,
        ret: true
    })
}

function add(e) {
    const path = './plugins/xhh/config/sign.yaml'
    const data = yaml.get(path)
    if (!data.zd_sign || !e.isGroup) return
    if(data.sign_group && !data.sign_group.includes(e.group_id)) return
    if (!data.sign) {
    data.sign = {}
    }else{
    const arrays = Object.values(data.sign);
    const allNumbers = arrays.flat();
    if(allNumbers.includes(e.user_id)) return
    }
    let qqs = data.sign[e.group_id]
    if (!qqs) {
        qqs = []
        qqs.push(e.user_id)
        data.sign[e.group_id] = qqs
        return yaml.set(path, 'sign', data.sign)
    } else {
        if (qqs.includes(e.user_id)) return
        qqs.push(e.user_id)
        data.sign[e.group_id] = qqs
        return yaml.set(path, 'sign', data.sign)
    }
}


async function reward(e, data) {
    let rew = await redis.get(`xhh:sign:${data.game}`)
    if (rew) return JSON.parse(rew)
    data.type = 'sign_home'
    const res = await api(e, data)
    const time = getSecondsToMidnight()
    await redis.set(`xhh:sign:${data.game}`, JSON.stringify(res.data.awards), {
        EX: time
    })
    return res.data.awards
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
    let num = 0,z_num = 0
    for (let qq of qqs) {
        let user = (await NoteUser.create(qq))?.mysUsers
        if (!user) continue
        let e = {}
        e.user_id = qq
        e.reply = (msg) => {}
        user = Object.values(user)[0] //多米游社只取一个
        for (let game of Object.keys(user.uids)) {
            const ck = user.ck
            const uids = user.uids[game]
            const game_name = game == 'gs' ? '原神' : game == 'sr' ? '星铁' : '绝区零'
            for (let i = 0; i < uids.length; i++) {
                z_num++
                const uid = uids[i]
                if (i > 0) await sleep(1000)
                let headers = mhy.getHeaders(e, ck)
                const Ds = mhy.getDsSign()
                headers.DS = Ds
                headers.Origin = 'https://act.mihoyo.com'
                headers.Referer = 'https://act.mihoyo.com'
                //必加参数
                headers['x-rpc-signgame'] = game == 'zzz' ? 'zzz' : game == 'sr' ? 'hkrpg' : 'hk4e'
                let data = {
                    game,
                    uid,
                    headers,
                    type: 'sign_info'
                }
                let res = await api(e, data)
                /**
                 * 报错
                 */
                if (typeof res == 'string') {
                    num++
                    continue
                }
                /**
                 * 查询签到状态成功
                 */
                else if (res.retcode == 0 && res.data) {
                    //已经签到
                    if (res.data.is_sign == true) {
                        num++
                        continue
                    } else {
                        //未签到,开始签到
                        data.type = 'sign'
                        const sign_res = await api(e, data)
                        //签到成功
                        if (sign_res.message == 'ok') {
                            num++
                            continue
                        }
                        //签到失败 
                        else if (typeof sign_res == 'string') {
                            continue
                        }
                    }
                }
                await sleep(500)
            }
            await sleep(500)
        }
        await sleep(500)
    }
    return {
        num,
        z_num
    }
}





export {
    MysSign,
    zd_MysSign
}