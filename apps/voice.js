import fs from 'fs';
import {
    uploadRecord,
    yyjson,
    yaml,
    render,
    mys,
    config
} from '#xhh';
import {
    execSync
} from 'child_process';

const path = process.cwd();

export class voice extends plugin {
    constructor() {
        super({
            name: '[小花火]角色语音',
            dsc: '',
            event: 'message',
            priority: 15,
            rule: [{
                    reg: '^#*(小花火)?清(空|除)语音(图片(列表)?)?缓存$',
                    fnc: 'qc',
                    permission: 'master',
                },
                {
                    reg: '^#*(开启|关闭)?超清语音(开启|关闭)?$',
                    fnc: 'kg',
                },
                {
                    reg: '^(#|\\*)?(星铁|原神)?(.*)语音(列表)?$',
                    fnc: 'yylb',
                },
                {
                    reg: '^((\\d+)(.*))|((.*)(\\d+))$',
                    fnc: 'fsyy',
                },
            ],
        });
        this.task = {
            cron: '0 20 4 * * *', //Cron表达式，(秒 分 时 日 月 星期)
            name: '[小花火]清空语音列表图片缓存',
            fnc: () => this.qc(),
        };
    }

    async check() {
        let kg = await yaml.get(path + '/plugins/xhh/config/config.yaml');
        return kg;
    }

    async tu(e, table, name, background) {
        let kg = await this.check();
        let data = {
            name,
            table,
            background,
            kg: kg.voice,
        };
        let img = await render('yytable/table', data, {
            e
        });
        if (img) return img;
    }

    async kg(e) {
        if (!config().all_voice) return false;
        if (!e.msg || e.msg.length > 7) {
            return false;
        }
        if (!e.isMaster) return false;
        if (e.msg.includes('开')) {
            yaml.set(path + '/plugins/xhh/config/config.yaml', 'voice', true);
            await e.reply('已开启超清语音，⚠️pc端QQ无法听取超清语音');
        } else {
            yaml.set(path + '/plugins/xhh/config/config.yaml', 'voice', false);
            await e.reply('已关闭超清语音🍃');
        }
        return true;
    }

    async yylb(e) {
        if (!config().all_voice) return false;
        let name = e.msg.replace(/#|\*|星铁|原神|语音|列表/g, '');
        let name2;
        let def = true;
        let sr_id;
        //星铁主角系列处理
        if (name.includes('星')) {
            name2 = name.replace(/星/g, '');
            switch (name2) {
                case '物理':
                case '物主':
                case '毁灭':
                case '毁灭主':
                    sr_id = 3128;
                    break;
                case '火主':
                case '存护':
                    sr_id = 3127;
                    break;
                case '虚数':
                case '同谐':
                case '同谐主':
                    sr_id = 872;
                    break;
                case '记忆':
                case '记忆主':
                case '冰主':
                case '':
                    sr_id = 4442;
                    break;
            }
        }
        if (name.includes('穹')) {
            name2 = name.replace(/穹/g, '');
            switch (name2) {
                case '物理':
                case '物主':
                case '毁灭':
                case '毁灭主':
                    sr_id = 3124;
                    break;
                case '火主':
                case '存护':
                    sr_id = 3123;
                    break;
                case '虚数':
                case '同谐':
                case '同谐主':
                    sr_id = 411;
                case '记忆':
                case '记忆主':
                case '冰主':
                case '':
                    sr_id = 4441;
                    break;
            }
        }
        //处理三月七
        if (name.includes('三月七') || name.includes('3月7')) {
            name2 = name.replace(/三月七|3月7/g, '');
            if (name2) {
                switch (name2) {
                    case '虚数':
                    case '巡猎':
                    case '仙舟':
                        sr_id = 3121;
                        break;
                }
            }
        }

        //调用小花火原神别名
        let gsnames = yaml.get('./plugins/xhh/system/default/gs_js_names.yaml');
        for (let i in gsnames) {
            if (gsnames[i].includes(name)) {
                name = i;
                break;
            }
        }

        //先查原神
        let gs_id = (await mys.data(name)).id;
        let background = '../../../../../plugins/xhh/resources/yytable/bg0.png';

        if (name == '空') {
            gs_id = '505542'
            background = '../../../../../plugins/xhh/resources/yytable/bg.png';
        } else if (name == '荧') {
            gs_id = '505527'
            background = '../../../../../plugins/xhh/resources/yytable/bg.png';
        }
        let list = false;
        let img = false;
        let isSr = false;
        let data, yy, table;
        if (gs_id) {
            list = await yyjson.gs_download(gs_id);
            if (!list?.length) return e.reply('暂时没有该角色语音💔');
            table = list[0].table;
            img = await this.tu(e, table, name, background);
            def = false;
        }

        //非原神查星铁
        if (def) {
            if (!sr_id) {
                let srnames = yaml.get('./plugins/xhh/system/default/sr_js_names.yaml');
                for (let i in srnames) {
                    if (srnames[i].includes(name)) {
                        name = i;
                        break;
                    }
                }
                sr_id = (await mys.data(name, 'js', true)).id;
            }
            if (sr_id) {
                let sr = await yyjson.sr_download(sr_id);
                if (!sr?.table?.length) return e.reply('暂时没有该角色语音💔');
                table = sr.table;
                yy = sr.sr_yy;
                background = '../../../../../plugins/xhh/resources/yytable/sr.png';
                img = await this.tu(e, table, name, background);
                isSr = true;
            }
        }

        if (!isSr) {
            data = {
                name,
                isSr,
                list
            };
        } else {
            data = {
                name,
                isSr,
                table,
                yy
            };
        }

        if (img) {
            let f = await e.reply(img);
            await this.temp();
            if (f.data?.message_id) f.message_id = f.data.message_id;
            f.message_id = f.message_id.toString().replace(/\//g, '');
            fs.writeFileSync(
                `./plugins/xhh/temp/yy_pic/${f.message_id}.json`,
                JSON.stringify(data),
                'utf-8'
            );
            return true;
        }
        return false;
    }

    async fsyy(e) {
        if (!e.source && !e.getReply) return false;
        if (!config().all_voice) return false;
        if (e.source && Number(e.source.user_id) !== Number(Bot.uin)) return false;
        // if (!/^\[图片]$/.test(e.source.message)) return false
        let source = {};

        if (e.source) {
            if (e.source.message_id) {
                try {
                    source = await Bot.getMsg(e.source.message_id);
                } catch (error) {
                    source = await e.bot.getMsg(e.source.message_id);
                }
            } else {
                source = e.isGroup ? (await e.group.getChatHistory(e.source?.seq, 1)).pop() : (await e.friend.getChatHistory((e.source?.time + 1), 1)).pop();
            }
        } else {
            source = await e.getReply(); //无e.source的情况
        }

        if (!source) return false;

        if (source.message.length != 1 && source.message[0]?.type != 'image') return false;

        if (e.msg && e.msg.length > 5) return false;
        let xh = /\d+/.exec(e.msg);
        let n = xh - 1;
        let type;
        if (/日语|日文/.test(e.msg)) {
            type = '日语';
        } else if (/汉语|中文|华语/.test(e.msg)) {
            type = '汉语';
        } else if (/外语|英语|英文/.test(e.msg)) {
            type = '英语';
        } else if (/韩语|韩文/.test(e.msg)) {
            type = '韩语';
        } else if (/^([0-9]|[0-9][0-9]|[1-2][0-9][0-9])$/.test(e.msg)) {
            type = '汉语';
        } else {
            return false;
        }

        source.message_id = source.message_id.toString().replace(/\//g, '');
        //if(e.reply_id) source.message_id=e.reply_id //napcat

        if (!fs.existsSync(`./plugins/xhh/temp/yy_pic/${source.message_id}.json`))
            return false;
        let data = JSON.parse(
            fs.readFileSync(
                `./plugins/xhh/temp/yy_pic/${source.message_id}.json`,
                'utf-8'
            )
        );
        let name = data.name;
        let isSr = data.isSr;
        let list = data.list;
        let table = data.table;
        let yy = data.yy;
        if (isSr) {
            let x;
            switch (type) {
                case '汉语': {
                    x = 0;
                    break;
                }
                case '英语': {
                    x = 1;
                    break;
                }
                case '日语': {
                    x = 2;
                    break;
                }
                case '韩语': {
                    x = 3;
                    break;
                }
                default:
                    return false;
            }
            yy = yy[x][n];
            yy = yy.replace(/sourcesrc=|><\/audio><\/div>/g, '');
        } else {
            for (let v of list) {
                if (v.tab_name == type) {
                    table = v.table;
                    break;
                }
            }
            if (!table[n]) return e.reply('喂喂喂！你这序号不对吧🤔', true);
            yy = table[n].audio_url;
            if (!yy) return e.reply('该语言暂未公布', true);
        }
        if (!table[n]) return e.reply('喂喂喂！你这序号不对吧🤔', true);
        let kg = await this.check();
        if (table[n].content == '？？？')
            return logger.error('[小花火]相关语言暂未公布');
        logger.mark(`\x1B[36m${yy}\x1B[0m`);

        if (!ffmpeg()) return false;

        let vo;
        if (kg.voice) vo = await uploadRecord(yy, 0, false);
        else vo = segment.record(yy);
        let content = table[n].content.replace(/\n| /g, '')
        content = content.replace(/●/g, '\n●')
        await e.reply(
            `[简述]:${table[n].name}\n[内容]:${table[n].content.replace(/\n| /g, '')}`
        );
        e.reply(vo);
        return true;
    }

    async qc(e) {
        try {
            fs.rmSync('./plugins/xhh/temp/yy_pic/', {
                recursive: true
            });
        } catch (err) {}
        if (e) return e.reply('已清空语音列表图片缓存');
    }

    temp() {
        if (!fs.existsSync('./plugins/xhh/temp/')) {
            fs.mkdirSync('./plugins/xhh/temp/');
        }
        if (!fs.existsSync('./plugins/xhh/temp/yy_pic/')) {
            fs.mkdirSync('./plugins/xhh/temp/yy_pic/');
        }
    }
}

function ffmpeg() {
    try {
        const ret = execSync('ffmpeg -version').toString();
        if (!ret.includes('version')) {
            logger.error('未安装 ffmpeg 无法发送语音');
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}