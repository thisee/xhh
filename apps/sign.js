import {
    config,
    MysSign,
    zd_MysSign,
    yaml,
    sleep
} from '#xhh';
import lodash from 'lodash';
import Runtime from '../../../lib/plugins/runtime.js';

let signing = false;
export class Sign extends plugin {
    constructor(e) {
        super({
            name: '[小花火]签到',
            dsc: '签到',
            event: 'message',
            priority: -26,
            rule: [{
                    reg: '^#*(小花火|xhh)*(原神|星铁|绝区零)*签到$',
                    fnc: 'sign',
                },
                {
                    reg: '^#(小花火|xhh)*(本群)*开始签到$',
                    fnc: 'scheduled_sign',
                    permission: 'master',
                },
            ],
        });
        this.task = {
            cron: '0 0 0 * * *', //凌晨0.00自动签到
            name: '[小花火]米游社签到',
            fnc: () => this.scheduled_sign(),
            log: true,
        };
    }

    async sign(e) {
        if (!config().sign) return false;
        if (signing) return e.reply('有签到任务进行中, 过会儿再试吧！');
        signing = true;
        const GAME_MAP = {
            星铁: ['sr'],
            绝区零: ['zzz'],
            原神: ['gs'],
            '#': ['gs'],
        };
        try {
            for (const [key, value] of Object.entries(GAME_MAP)) {
                if (e.msg.includes(key)) {
                    await MysSign(e, value);
                    signing = false;
                    return true;
                }
            }

            await MysSign(e, ['gs', 'sr', 'zzz']);
        } catch (error) {
            logger.error(`签到异常: ${error.message}`);
        } finally {
            signing = false;
        }
        return true;
    }

    async scheduled_sign() {
        const data = yaml.get('./plugins/xhh/config/sign.yaml');
        if (!data.zd_sign || !data.sign || typeof data.sign != 'object') return false;
        signing = true;
        try {

            let groups = Object.keys(data.sign).sort(
                (a, b) => data.sign[b].length - data.sign[a].length
            );
            if (this.e?.msg?.includes('本群') && this.e.isGroup)
                groups = [this.e.group_id];
            for (const group of groups) {
                if (data.sign_group && !data.sign_group.includes(group)) continue; //非白名单群
                if (data.sign[group].length === 0) continue; //群里没人
                let data_ = {
                    qqs: data.sign[group],
                };
                let path = 'sign/list';
                //渲染
                let img = await render(path, data_);
                try {
                    Bot.pickGroup(Number(group)).sendMsg(img);
                } catch (err) {
                    logger.error(err);
                    continue;
                }
                const {
                    num,
                    z_num,
                    cg_qqs,
                    sbai_qqs
                } = await zd_MysSign(
                    data.sign[group]
                ); //开始签到
                data_ = {
                    num,
                    z_num,
                    cg_qqs,
                    sbai_qqs,
                };
                path = 'sign/end_list';
                img = await render(path, data_);
                await Bot.pickGroup(Number(group)).sendMsg(img);
                //删除签到失败的qq
                del(sbai_qqs, group);
                if (data.sbai) {
                    let atqq = sbai_qqs.map(v => v = segment.at(v))
                    Bot.pickGroup(Number(group)).sendMsg(atqq);
                }
                await sleep(200);
            }

        } catch (error) {
            logger.error(`自动签到异常: ${error.message}`);
        } finally {
            signing = false;
        }
    }
}

function del(qqs, group) {
    const path = './plugins/xhh/config/sign.yaml';
    const data = yaml.get(path);
    data.sign[group] = removeCommonElements(data.sign[group], qqs)
    return yaml.set(path, 'sign', data.sign);
}

function removeCommonElements(arr1, arr2) {
    // 将数组2转为Set提高查找效率
    const set2 = new Set(arr2);
    // 过滤掉数组1中存在于数组2的元素
    return arr1.filter(item => !set2.has(item));
}

async function render(path, data_) {
    let tplFile = process.cwd() + '/plugins/xhh/resources/' + path + '.html';
    const img = await new Runtime().render('小花火', path, data_, {
        retType: 'base64',
        beforeRender({
            data
        }) {
            return {
                sys: {
                    scale: `style=transform:scale(${(config().img_quality / 100) * 2.4 || 2.4 * 0.8})`,
                },
                ...data_,
                ppath: '../../../../../plugins/xhh/resources/',
                tplFile: tplFile,
                saveId: path.split('/')[path.split('/').length - 1],
            };
        },
    });
    return img;
}