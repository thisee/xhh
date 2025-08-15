import { config, MysSign, zd_MysSign, yaml, sleep } from '#xhh'
import lodash from 'lodash'
let signing = false
export class Sign extends plugin {
    constructor(e) {
        super({
            name: '[小花火]帮助',
            dsc: '帮助',
            event: 'message',
            priority: -26,
            rule: [
                {
                    reg: '^#*(小花火)*(原神|星铁|绝区零)*签到$',
                    fnc: 'sign'
                }, {
                    reg: '^#(小花火)*(本群)*开始签到$',
                    fnc: 'scheduled_sign',
                    permission: 'master'
                }
            ]
        })
        this.task = {
            cron: "0 0 0 * * *", //凌晨0.00自动签到
            name: "[小花火]米游社签到",
            fnc: () => this.scheduled_sign(),
            log: true
        }
    }

    async sign(e) {
        if (!config().sign) return false
        if (signing) return e.reply('有签到任务进行中, 过会儿再试吧！')
        signing = true
        const GAME_MAP = {
            '星铁': ['sr'],
            '绝区零': ['zzz'],
            '原神': ['gs'],
            '#': ['gs']
        }

        for (const [key, value] of Object.entries(GAME_MAP)) {
            if (e.msg.includes(key)) {
                await MysSign(e, value)
                signing = false
                return true
            }
        }

        await MysSign(e, ['gs', 'sr', 'zzz'])
        signing = false
        return true
    }

    async scheduled_sign() {
        const data = yaml.get('./plugins/xhh/config/sign.yaml')
        if (!data.zd_sign) return false
        signing = true
        let groups = Object.keys(data.sign)
        if(this.e?.msg?.includes('本群') && this.e.isGroup) groups=[this.e.group_id]
        for (const group of groups) {
            if(data.sign_group && !data.sign_group.includes(group)) continue
            const msg = `开始本群米游社自动签到(*^▽^*), 请稍等...\n当前群聊共${data.sign[group].length}个用户\n预计签到${data.sign[group].length*3}个游戏账号`
            Bot.pickGroup(Number(group)).sendMsg(msg)
            const { num, z_num } = await zd_MysSign(data.sign[group])
            Bot.pickGroup(Number(group)).sendMsg(`---本群签到任务完成---\n共${z_num}个游戏账号参与签到\n成功了${num}个~`)
            await sleep(lodash.random(15000, 30000))
        }
        signing = false
    }

}