import { config, MysSign, zd_MysSign, yaml, sleep } from '#xhh'
import lodash from 'lodash'
import Runtime from '../../../lib/plugins/runtime.js'

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
        if (this.e?.msg?.includes('本群') && this.e.isGroup) groups = [this.e.group_id]
        for (const group of groups) {
            if (data.sign_group && !data.sign_group.includes(group)) continue//非白名单群
            if(data.sign[group].length === 0) continue//群里没人
            let data_ = {
                qqs : data.sign[group]
            }
            let path = 'sign/list'
            //渲染
            let img = await render(path, data_)
            try {
                Bot.pickGroup(Number(group)).sendMsg(img)
            } catch (err) {
                logger.error(err)
                continue
            }
            const { num, z_num,cg_qqs,sbai_qqs} = await zd_MysSign(data.sign[group])//开始签到
            data_={
                num,
                z_num,
                cg_qqs,
                sbai_qqs
            }
            path='sign/end_list'
            img = await render(path, data_)
            Bot.pickGroup(Number(group)).sendMsg(img)
            //删除签到失败的qq
            for(const qq of sbai_qqs){
                del(qq,group)
            }
            //等待一会再执行下一个群
            await sleep(lodash.random(15000, 30000))
        }
        signing = false
    }

}

function del(qq,group) {
    const path = './plugins/xhh/config/sign.yaml'
    const data = yaml.get(path)
    data.sign[group].splice(data.sign[group].indexOf(qq), 1)
    return yaml.set(path, 'sign', data.sign)
}

async function render(path, data_) {
    let tplFile = process.cwd()+'/plugins/xhh/resources/'+path+'.html'
    const img = await new Runtime().render('小花火', path, data_, {
        retType: 'base64',
        beforeRender({ data }) {
            return {
                sys: { scale: `style=transform:scale(${config().img_quality / 100 * 2.4 || 2.4 * 0.8})` },
                ...data_,
                ppath: '../../../../../plugins/xhh/resources/',
                tplFile: tplFile,
                saveId: path.split('/')[path.split('/').length - 1]
            }
        }
    })
    return img
}