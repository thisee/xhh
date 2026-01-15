import {
    mhy,
    config
} from '#xhh';
import {
    user
} from '../apps/user.js';

async function api(e, data = {}) {
    let signActId = {
        gs: 'e202311201442471',
        sr: 'e202304121516551',
        zzz: 'e202406242138391',
    };
    const game = data.game;
    const uid = data.uid;
    const server = data.server || ((uid && game) ? mhy.getServer(uid, game) : '');

    const api_list = {
        /* createGeetest: {
            url: `https://api-takumi.mihoyo.com/event/toolcomsrv/risk/createGeetest?is_high=true&app_key=${data.app_key}`,
            obj: {
                method: 'GET',
            },
        },
        verifyGeetest: {
            url: 'https://api-takumi.mihoyo.com/event/toolcomsrv/risk/verifyGeetest',
            obj: {
                method: 'POST',
                body: data.body,
            },
        },
        createVerification: {
            url: 'https://api-takumi-record.mihoyo.com/game_record/app/card/wapi/createVerification?is_high=true',
            obj: {
                method: 'GET',
            },
        },
        verifyVerification: {
            url: 'https://api-takumi-record.mihoyo.com/game_record/app/card/wapi/verifyVerification',
            obj: {
                method: 'POST',
                body: data.body,
            },
        },*/
        createVerification: {
            url: 'https://bbs-api.miyoushe.com/misc/wapi/createVerification?gids=2&is_high=false',
            obj: {
                method: 'GET',
            },
        },
        verifyVerification: {
            url: 'https://bbs-api.miyoushe.com/misc/wapi/verifyVerification',
            obj: {
                method: 'POST',
                body: data.body,
            },
        },
        //账号游戏信息
        GameRoles: {
            url: 'https://api-takumi.miyoushe.com/binding/api/getUserGameRolesByStoken',
            obj: {
                method: 'GET',
            },
        },
        sign_info: {
            url: `https://api-takumi.mihoyo.com/event/luna/info?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
            obj: {
                method: 'GET',
            },
        },
        sign_home: {
            url: `https://api-takumi.mihoyo.com/event/luna/home?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
            obj: {
                method: 'GET',
            },
        },
        sign: {
            url: 'https://api-takumi.mihoyo.com/event/luna/sign',
            obj: {
                method: 'POST',
                body: JSON.stringify({
                    act_id: signActId[game],
                    region: server,
                    uid: uid,
                    lang: 'zh-cn',
                }),
            },
        },
        //货币战争
        huobi: {
            url: `https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/grid_fight?server=${server}&role_id=${uid}`,
            obj: {
                method: 'GET',
            }
        },
        //绝区零母带
        zzz_md: {
            url: `https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/cur_gacha_detail?uid=${uid}&region=${server}`,
            obj: {
                method: 'GET',
            }
        }
    };

    const {
        url,
        obj
    } = api_list[data.type];

    obj.headers = data.headers;

    let res

    try {
        res = await fetch(url, obj).then(res => res.json());
    } catch (error) {
        logger.error(error);
    }
    const sign = data.type.includes('sign');
    const _err = sign ?
        api_err(e, res, false, data.type) :
        api_err(e, res, data.uid, data.type);
    if (_err) {
        if (sign) return _err
        else if (res.retcode == 1034 || res.retcode == 10035) {
            const yz = await new user().yz(e, game, data.headers)
            if (yz) {
                res = await fetch(url, obj).then(res => res.json())
                if (res.retcode == 1034 || res.retcode == 10035) e.reply(_err)
                else return res
            } else e.reply(_err)
        }
        return false;
    }
    return res;
}

function api_err(e, res, uid, type) {
    if (res.retcode == 0) return false;
    let msg;
    switch (res.retcode) {
        case -1:
        case -100:
        case 1001:
        case 10001:
        case 10103:
            msg = `${uid ? 'UID:' + uid : ''}米游社查询失败，无法查询`;
            if (/(登录|login)/i.test(res.message)) {
                msg = `${uid ? 'UID:' + uid : ''}Cookie失效，请[刷新ck]或[扫码绑定]`;
            }
            break;
        case -10002:
            msg = `${uid ? 'UID:' + uid : ''}${res.message}`;
            break;
        case 10102:
        case 5003:
        case 10041:
            msg = `${uid ? 'UID:' + uid : ''}米游社账号异常,无法查询！`;
            break;
        case 1034:
        case 10035:
            if (!type.includes('sign')) msg = `${uid ? 'UID:' + uid : ''}米游社查询遇到验证码，${config().bdsb ? '暂时无法查询，部分安卓手机可发送：设备帮助\n绑定常用设备后查询！':'暂时无法查询！'}`
            else msg = '签到遇到验证码，暂时无法签到' //res.data.gt   res.data.challenge
            break;
        default:
            msg = '米游社接口异常...';
            logger.error(res);
            break;
    }
    if ([1034, 10035].includes(res.retcode)) return msg
    if (type.includes('sign')) {
        if (res.first_bind) return '签到失败：首次请先手动签到';
        return msg;
    }
    e.reply(msg);
    return true;
}

export default api;