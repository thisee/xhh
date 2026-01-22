import {
    mhy,
    yaml,
    QR,
    sleep,
    reply_recallMsg,
    recallMsg,
    makeForwardMsg,
    api,
    config
} from '#xhh';
import YAML from 'yaml';
import fs from 'fs';
import moment from 'moment';
import {
    Restart
} from '../../other/restart.js';

export class user extends plugin {
    constructor(e) {
        super({
            name: '[小花火]user',
            dsc: '',
            event: 'message',
            handler: [{
                key: 'mys.req.err',
                fn: 'mysReqErrHandler',
            }, ],
            priority: -666,
            rule: [{
                    reg: '^#?(删除|绑定)*设备(.*)$',
                    fnc: 'fp',
                },
                {
                    reg: '^#?扫码(登录|绑定|登陆)$',
                    fnc: 'sm',
                },
                {
                    reg: '^#?(绑定)?设备(绑定)?帮助$',
                    fnc: 'help',
                },
                {
                    reg: '^#?删除stoken$',
                    fnc: 'del',
                },
                {
                    reg: '^#?刷新(cookie|ck)$',
                    fnc: 'refresh_ck',
                },
                {
                    reg: '^#*(小花火|xhh)开启设备(绑定)?$',
                    fnc: 'kq',
                },
                {
                    reg: '^#*解码(余额)*$',
                    fnc: 'yue',
                }
            ],
        });
    }

    async kq(e) {
        if (!e.isMaster) return false
        let path = './plugins/xhh/config/config.yaml';
        fs.cpSync('./plugins/xhh/system/checkCode/gs.txt', './plugins/genshin/model/mys/mysInfo.js')
        fs.cpSync('./plugins/xhh/system/checkCode/sr.txt', './plugins/StarRail-plugin/runtime/MysSRApi.js')
        await yaml.set(path, 'bdsb', true);
        await e.reply('开启设备完成，执行重启！')
        new Restart(this.e).restart();
    }



    fp(e) {
        if (!config().bdsb) return false
        if (e.msg.includes('删除')) return this.Delete(e);
        let msg = e.msg.replace(/绑定|设备|#/g, '');
        let info;
        try {
            info = JSON.parse(msg);
        } catch (err) {
            return false;
        }
        if (e.isGroup) {
            // e.reply('请私聊绑定设备'
            recallMsg(e);
        }
        return mhy.shebei(e, info);
    }

    async help(e) {
        if (!config().bdsb) return false
        const msg = [
            '[注意点]',
            '1.绑定设备主要是解决查询米游社报的异常问题，我通过模拟你的常用设备访问米游社获取fp设备指纹参数，用于后续查询米游社时使用',
            '2.如果你不信任我，请不要使用此功能\n',
            '[绑定设备]',
            '方法一（仅适用于部分安卓设备）：',
            '1. 使用常用米游社手机下载下面链接的APK文件（复制到浏览器打开），并安装',
            'https://e-e.lanzouw.com/isfXD2f00v6f',
            '密码:xhh',
            '2. 打开app后点击按钮复制设备信息(注意:oaid不能全是0，也不能出现error)',
            '3. 发送：设备（+设备信息）',
            '-------------------------------',
            '方法二(不会抓包就别试了)：',
            '1. 使用抓包软件抓取常用手机的米游社APP请求',
            '2. 在请求头内找到【x-rpc-device_id】和【x-rpc-device_fp】',
            '3. 自行构造如下格式的信息：',
            '   {"device_id": "x-rpc-device_id的内容", "device_fp": "x-rpc-device_fp的内容"}',
            '4. 发送：设备（+构造的设备信息）',
            '-------------------------------',
            '[删除设备]',
            '发送 删除设备 即可',
        ].join('\n');
        e.reply(await makeForwardMsg(e, msg));
    }

    async sm(e) {
        if (!config().sm) return false;
        let CD = config().sm_cd || 0;
        let now_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
        const last_time = await redis.get(`xhh_sm:${e.user_id}_CD`);
        if (last_time && !e.isMaster) {
            const seconds = moment(now_time).diff(moment(last_time), 'seconds');
            e.reply(
                '扫码登录CD中，请不要重复触发！剩余时间：' + (CD - seconds) + '秒',
                true
            );
            return true;
        }

        let url = 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch'; //获取二维码
        const app_id = 2;
        /**
        1 《崩坏3》
        2 《未定事件簿》
        4 《原神》
        7 《崩坏学园2》
        8 《崩坏：星穹铁道》
        12 《绝区零》
         * 
         */

        let headers = mhy.getHeaders(e);

        let body = {
            app_id: app_id,
            device: headers['x-rpc-device_id'],
        };
        let res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        }).then(res => res.json());

        const sm_url = res.data.url;

        let img = segment.image(
            (await QR.toDataURL(sm_url)).replace(
                'data:image/png;base64,',
                'base64://'
            )
        );

        const re = await reply_recallMsg(
            e,
            [
                '请在60秒内使用手机米游社扫码登录',
                img,
                '调用[未定事件铺]接口,获取米游社game_token,谁触发谁扫码,请不要帮别人绑定自己的米游社！！！',
            ],
            60,
            true
        );
        if (re.data?.message_id) re.message_id = re.data.message_id;
        await sleep(2000);

        url = 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/query'; //查询二维码状态
        let ticket = sm_url.split('ticket=')[1];
        body['ticket'] = ticket;
        let zt;
        now_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
        await redis.set(`xhh_sm:${e.user_id}_CD`, now_time, {
            EX: CD
        }); //进入CD
        for (var n = 1; n < 150; n++) {
            await sleep(1000);
            res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            }).then(res => res.json());
            if (res.retcode != 0) return e.reply('二维码已过期~', true);
            if (res.data.stat == 'Init') continue;
            if (res.data.stat == 'Scanned' && !zt) {
                zt = true;
                recallMsg(e, re.message_id);
                e.reply('二维码已被扫，请确认登录~', true);
            }
            if (res.data.stat == 'Confirmed') {
                const data = JSON.parse(res.data.payload.raw);
                //通过game_token获取SToken
                url =
                    'https://passport-api.mihoyo.com/account/ma-cn-session/app/getTokenByGameToken';
                body = {
                    account_id: Number(data.uid),
                    game_token: data.token,
                };
                res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                }).then(res => res.json());
                //SToken
                const SToken = res.data.token.token;
                //stuid
                const stuid = data.uid;
                //mid
                const mid = res.data.user_info.mid;
                //用SToken获取cookie
                const ck = `stuid=${stuid};stoken=${SToken};mid=${mid};`;
                headers.Cookie = ck;
                const {
                    sendMsg,
                    ltoken
                } = await mhy.refresh_cookies(
                    e,
                    headers,
                    SToken,
                    stuid
                );
                if (SToken && stuid && mid && ltoken) {
                    res = await api(e, {
                        type: 'GameRoles',
                        headers: headers
                    });
                    let data_ = {};
                    /*
                    hk4e_cn国服原神
                    hkrpg_cn国服星铁
                    nap_cn国服绝区零
                    */
                    const game_list = ['hk4e_cn', 'hkrpg_cn', 'nap_cn'];
                    res.data.list.map(v => {
                        if (game_list.includes(v.game_biz)) {
                            data_[v.game_uid] = {
                                uid: v.game_uid,
                                stuid: stuid,
                                stoken: SToken,
                                ck_stoken: `stuid=${stuid};stoken=${SToken};mid=${mid};`,
                                mid: mid,
                                ltoken: ltoken,
                                region_name: v.region_name,
                                region: v.region,
                            };
                        }
                    });
                    let yaml_url = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
                    await this.process_files(yaml_url, data_);
                    const yaml_path = './plugins/xiaoyao-cvs-plugin/data/yaml/';
                    if (fs.existsSync(yaml_path)) { //fs.mkdirSync(yaml_path, { recursive: true });
                        yaml_url = `${yaml_path}${e.user_id}.yaml`;
                        for (let k in data_) {
                            data_[k]['userId'] = Number(e.user_id);
                            data_[k]['is_sign'] = true;
                        }
                        await this.process_files(yaml_url, data_);
                    }
                }
                if (e.no_reply) e.reply = e.no_reply;
                if (sendMsg.length < 2) e.reply(sendMsg)
                else e.reply(await makeForwardMsg(e, sendMsg));
                break;
            }
        }
        return true;
    }

    //删除设备
    async Delete(e) {
        const path = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
        if (!fs.existsSync(path)) return e.reply('你没有绑定过设备', true);
        fs.unlinkSync(path);
        //ZZZ-Plugin???
        const ltuid = e.user.getMysUser('zzz').ltuid
        await redis.del(`ZZZ:DEVICE_FP:${ltuid}:FP`);
        await redis.del(`ZZZ:DEVICE_FP:${ltuid}:ID`);
        e.reply('删除成功!', true);
        return true;
    }

    //删除stoken
    del(e) {
        const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
        const path2 = `./plugins/xiaoyao-cvs-plugin/data/yaml/${e.user_id}.yaml`;
        if (!fs.existsSync(path) && !fs.existsSync(path2)) {
            return e.reply('你没有绑定过stoken', true);
        }
        if (fs.existsSync(path2)) fs.unlinkSync(path2);
        if (fs.existsSync(path)) fs.unlinkSync(path);
        e.reply('删除成功!', true);
        return true;
    }

    //刷新ck
    async refresh_ck(e) {
        let msgs = [],
            kg;
        let data_ = await mhy.getSToken(e);
        if (!data_) return e.reply(`未绑定米游社，请发送[扫码绑定]`, true);
        const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
        let data;
        if (!Array.isArray(data_)) data = yaml.get(path);
        else((data = data_[1]), (data_ = data_[0]));
        for (let k in data_) {
            const [SToken, ck] = data_[k];
            const headers = mhy.getHeaders(e, ck);
            const {
                sendMsg,
                ltoken
            } = await mhy.refresh_cookies(
                e,
                headers,
                SToken,
                k
            );
            if (ltoken && data) {
                for (let m in data) {
                    if (data[m].stoken == SToken) {
                        data[m].ltoken = ltoken;
                        kg = 1;
                    }
                }
            }
            msgs.push(...sendMsg);
        }
        if (kg) fs.writeFileSync(path, YAML.stringify(data), 'utf-8');
        if (e.no_reply) e.reply = e.no_reply;
        msgs.map((v, i) => {
            if (typeof msgs[i] === 'string') msgs[i] = msgs[i].replace(/绑定Cookie/g, '刷新Cookie');
        })
        if (msgs.length < 2) e.reply(msgs)
        else e.reply(await makeForwardMsg(e, msgs));
    }

    async process_files(yaml_url, data_) {
        if (!fs.existsSync(yaml_url)) {
            fs.writeFileSync(yaml_url, YAML.stringify(data_), 'utf-8');
        } else {
            const _data_ = await yaml.get(yaml_url);
            for (let k in data_) {
                if (_data_[k]?.hasOwnProperty('is_sign'))
                    data_[k]['is_sign'] = _data_[k].is_sign;
                _data_[k] = data_[k];
            }
            fs.writeFileSync(yaml_url, YAML.stringify(_data_), 'utf-8');
        }
    }

    async mysReqErrHandler(e, args, reject) {
        if (!config().bdsb) return reject();
        let {
            data,
            mysApi,
            type
        } = args;
        if (![1034, 10035, 10041, 5003].includes(Number(args?.res?.retcode))) {
            return reject();
        }
        if (e.mysReq) return await mysApi.getData(type, data);

        mysApi.getUrl = (...args) => this.getUrl.apply(mysApi, args)

        const yaml_url = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
        if (fs.existsSync(yaml_url)) {
            let data_ = fs.readFileSync(yaml_url, 'utf-8');
            data_ = YAML.parse(data_);
            let fp;
            if (data_.fp) fp = data_.fp;
            if (!fp) return reject();
            if (data?.headers) {
                data.headers['x-rpc-device_fp'] = fp;
            } else {
                if (!data) data = {};
                data.headers = {
                    'x-rpc-device_fp': fp
                };
            }
            data.headers['x-rpc-device_id'] = data_.device_id
            if (!e.deviceFp) e.reply(`米游社访问异常,正在调用QQ：${e.user_id}常用设备重试米游社......`)
            e.deviceFp = true
        } else if ([1034, 10035].includes(Number(args?.res?.retcode))) {
            if (!config().Verification_API_KEY) return reject()
            let create = await mysApi.getData('createVerification')
            if (!create || create.retcode !== 0) return reject();
            let verify = await this.ManualVerify(e, create.data)
            if (!verify) {
                if (e.isGroup) {
                    Bot.pickGroup(e.group_id).sendMsg('自动解码失败！🥀')
                } else {
                    Bot.pickFriend(e.user_id).sendMsg('自动解码失败！🥀')
                }
                return reject();
            }
            let submit = await mysApi.getData('verifyVerification', verify)
            if (!submit || submit.retcode !== 0) return reject();
            e.mysReq = true
            await sleep(2000)
        } else return reject();

        let res = await mysApi.getData(type, data);
        if (![1034, 5003, 10035, 10041].includes(Number(res?.retcode))) {
            logger.mark(`[[xhh]mys重试成功][uid:${mysApi.uid}][qq:${e.user_id}]`)
            return res;
        }
        return reject();
    }

    getUrl(type, data = {}) {
        let urlMap = {
            ...this.apiTool.getUrlMap({
                ...data,
                deviceId: this.device
            }),
            createVerification: {
                url: 'https://bbs-api.miyoushe.com/misc/wapi/createVerification',
                query: 'gids=2&is_high=false'
            },
            verifyVerification: {
                url: 'https://bbs-api.miyoushe.com/misc/wapi/verifyVerification',
                body: data
            }
        }
        if (!urlMap[type]) return false


        let {
            url,
            query = '',
            body = ''
        } = urlMap[type]

        if (query) url += `?${query}`
        if (body) body = JSON.stringify(body)

        let headers = this.getHeaders(query, body)
        if (this.isSr) headers['x-rpc-challenge_game'] = '6'
        if (this.game == 'zzz') headers['x-rpc-challenge_game'] = '8'

        return {
            url,
            headers,
            body
        }
    }

    async yz(e, game, headers) {
        if (!config().Verification_API_KEY) return false
        //获取headers
        if (!headers) headers = mhy.getHeaders(e, e.user.getMysUser().ck)
        headers['x-rpc-client_type'] = 5
        headers.DS = mhy.getDs2('gids=2&is_high=false', '', 4)
        headers['x-rpc-challenge_game'] = game == 'zzz' ? '8' : game == 'sr' ? '6' : '2'

        let data = {
            headers,
            type: "createVerification"
        }

        let res = await api(e, data);
        if (!res || res.retcode !== 0) return false

        let body = await this.ManualVerify(e, res.data)

        if (!body) {
            e.reply('自动解码失败！')
            return false
        }
        body = JSON.stringify(body)
        headers.DS = mhy.getDs2('', body, 4)

        data = {
            headers,
            type: "verifyVerification",
            body
        }

        res = await api(e, data);
        if (!res || res.retcode !== 0) {
            e.reply('自动解码失败！🥀')
            return false
        }
        return true
    }


    async ManualVerify(e, data) {
        if (!data.gt) return false

        e.reply('查询该账号的米游社时遇到验证码，正在尝试解开🍀')

        const API_KEY = config().Verification_API_KEY
        const MAX_RETRIES = 8
        const INITIAL_DELAY = 3000
        const RETRY_DELAY = 1000
        const BASE_URL = 'http://api.ttocr.com/api'

        // 第一步：创建识别请求
        const recognizeRes = await fetch(`${BASE_URL}/recognize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                appkey: API_KEY,
                gt: data.gt,
                challenge: data.challenge,
                itemid: 388,
                referer: 'https://webstatic.mihoyo.com'
            })
        }).then(res => res.json())

        if (!recognizeRes.resultid) return false

        // 第二步：轮询结果
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                appkey: API_KEY,
                resultid: recognizeRes.resultid
            })
        }

        let result
        let retries = 0

        await sleep(INITIAL_DELAY)

        while (retries < MAX_RETRIES) {
            result = await fetch(`${BASE_URL}/results?appkey=${API_KEY}&resultid=${recognizeRes.resultid}`, requestOptions)
                .then(res => res.json())

            if (result?.status !== 2) break

            await sleep(RETRY_DELAY)
            retries++
        }

        // 处理成功结果
        if (result?.data && result.status === 1) {
            const msg = `自动解码成功☘️,用时：${result.time / 1000}秒\n将在2秒后重试！`
            if (e.isGroup) {
                Bot.pickGroup(e.group_id).sendMsg(msg)
            } else {
                Bot.pickFriend(e.user_id).sendMsg(msg)
            }

            return {
                geetest_challenge: result.data.challenge,
                geetest_validate: result.data.validate,
                geetest_seccode: `${result.data.validate}|jordan`
            }
        }

        return false
    }

    async yue(e) {
        if (!config().Verification_API_KEY) return false
        let url = 'http://api.ttocr.com/api/points?appkey=' + config().Verification_API_KEY
        let data = await (await fetch(url)).json()
        if (data.msg == '查询成功' && data.points) return e.reply(`剩余可用次数：约${Math.floor(data.points/10)}次`)
        else return e.reply(data.msg)
    }

}