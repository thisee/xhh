import fetch from 'node-fetch'
import moment from "moment"
import {
    mhy,
    render,
    api,
    config
} from '#xhh'

const path = process.cwd();

export class TL extends plugin {
    constructor(e) {
        super({
            name: '[小花火]体力小组件',
            dsc: '体力',
            event: 'message',
            priority: -99,
            rule: [{
                reg: '^(#|\\*|%)*(原神|星铁|绝区零)*体力$',
                fnc: 'note_',
            }, ]
        })
        this.gsUrl = 'https://api-takumi-record.mihoyo.com/game_record/genshin/aapi/widget/v2'
        this.srUrl = 'https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/aapi/widget'
        this.zzzUrl = 'https://api-takumi-record.mihoyo.com/event/game_record_zzz/api/zzz/widget'
        this.week = [
            "星期日",
            "星期一",
            "星期二",
            "星期三",
            "星期四",
            "星期五",
            "星期六",
        ]
    }

    async note_(e) {
        if (!config().Tl) return false
        let hasAllData = false
        const isQueryAll = e.msg === '体力';
        const isStarRail = e.msg.includes('星铁');
        const isZZZ = e.msg.includes('绝区零');
        const getZZZData = async () => {
            const data = await this.note(e, 'zzz', isQueryAll);
            if (data && !['过期', '没有'].includes(data) && !data.s2_bounty_commission) {
                data.s2_bounty_commission = {
                    num: 0,
                    total: 0
                };
            }
            return data;
        };

        let resultData = {};

        if (isQueryAll) {
            hasAllData = true;
            const [gsData, srData, zzzData] = await Promise.all([
                this.note(e, 'gs'),
                this.note(e, 'sr'),
                getZZZData()
            ]);
            resultData = {
                gs_data: gsData,
                sr_data: srData,
                zzz_data: zzzData
            };
        } else if (isStarRail) {
            resultData = {
                sr_data: await this.note(e, 'sr', false)
            };
        } else if (isZZZ) {
            resultData = {
                zzz_data: await getZZZData()
            };
        } else {
            resultData = {
                gs_data: await this.note(e, 'gs', false)
            };
        }

        if (Object.values(resultData).every(v => v === '没有')) {
            if (hasAllData) e.reply('没有绑定米游社，请[扫码绑定]米游社', true);
            return true
        }
        if (Object.values(resultData).every(v => v === '过期')) {
            if (hasAllData) e.reply('米游社验证已过期。请重新：扫码绑定 ', true)
            return true
        }

        // if (Object.values(resultData).every(v => !v)) return true

        const renderData = {
            bg: Object.values(resultData).filter(Boolean).length > 1 ? 'bg' : 'bg1',
            qq: e.user_id,
            qqname: e.sender?.nickname?.length < 11 ? e.sender?.nickname : e.user_id,
            time: `${moment().format("MM-DD HH:mm")} ${this.week[moment().day()]}`
        };
        
        //3体力，去掉失效的
        for (const key in resultData) {
            if (resultData[key] === '没有' || resultData[key] === '过期') {
                resultData[key] = false;
            }
        }


       const { ..._data_} = {...renderData, ...resultData }
        render('Tl/Tl', _data_, {
            e,
            ret: true
        })
    }


    //体力
    async note(e, game = 'gs', san = true) {

        let uid = e.user.getUid(game)

        if (!uid) {
            if(!san) e.reply('未发现绑定的uid，请[扫码绑定]米游社~')
            return '没有'
        }

        let sk = await mhy.getstoken(e, uid)
        if (!sk) {
            if(!san) e.reply('UID:' + uid + '未绑定米游社SToken，请[扫码绑定]米游社~', true)
            return '没有'
        }
        let headers = mhy.getHeaders(e, sk, false)
        let url = game == 'gs' ? this.gsUrl : game == 'sr' ? this.srUrl : this.zzzUrl
        let res = await fetch(url, {
            method: "get",
            headers
        }).then(res => res.json())
        if ([-10001, 10001, -100].includes(res?.retcode)) {
            if (!san) {
                e.reply('登录验证过期。请重新：扫码绑定 ')
            }
            return '过期'
        }

        if (!res || res.retcode !== 0) {
            logger.error(res)
            return false
        }
        let time = res.data.resin_recovery_time || res.data.stamina_recover_time || res.data.energy?.restore
        if (!time) time = 0
        let game_ = await this.getGameDate(e,headers, uid)
        //派遣，委托 是否全部完成
        if (res.data.expeditions?.length) {
            res.data.expeditions_ = res.data.expeditions.every(v => v.status === 'Finished');
        }
        let data = {
            uid: uid,
            ...game_,
            time: time == 0 ? '已满' : getTime(time),
            ...res.data
        }
        return data
    }



    async getGameDate(e,headers, uid) {
        headers.DS = mhy.getDs()
        let res = await api(e,{
            type: 'GameRoles',
            headers: headers
        })
        let data
        res.data.list.forEach((v) => {
            if (v.game_uid == uid) {
                data = {
                    level: v.level,
                    name: v.nickname
                }
            }
        })
        return data
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
    const now = new Date().getTime()
    const date = new Date(time * 1000 + now)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0')
    // 当前日期（去除时分秒）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 目标日期（去除时分秒）
    const targetDate = date
    targetDate.setHours(0, 0, 0, 0);

    // 计算日期差值（天数）
    let days = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));

    let day = days === 0 ? '今天' : days === 1 ? '明天' : '后天'
    return `${day}${hours}:${minutes}`;
}