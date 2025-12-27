import fs from 'fs';
import {
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

    async tu(e, table, name, background) {
        let data = {
            name,
            table,
            background,
        };
        let img = await render('yytable/table', data, {
            e
        });
        if (img) return img;
        return false;
    }

    async yylb(e) {
        if (!config().all_voice) return false;
        let name = e.msg.replace(/#|\*|星铁|原神|语音|列表/g, '');
        let def = true;

        //调用小花火原神别名
        let gsnames = yaml.get('./plugins/xhh/system/default/gs_js_names.yaml');
        for (let i in gsnames) {
            if (gsnames[i].includes(name)) {
                name = i;
                break;
            }
        }
        let other_list = await yyjson.gs_other_download(name);
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
        if (other_list.length) {
            if (gs_id) list = await yyjson.gs_download(gs_id);
            table = []
            for (let v of other_list) {
                table.push(v.title);
            }
            img = await this.tu(e, table, name, background);
            def = false;
        }

        //非原神查星铁
        if (def) {
            other_list = await yyjson.sr_other_download(name);
            let srnames = yaml.get('./plugins/xhh/system/default/sr_js_names.yaml');
            for (let i in srnames) {
                if (srnames[i].includes(name)) {
                    name = i;
                    break;
                }
            }
            let sr_id = (await mys.data(name, 'js', true)).id;
            if (other_list.length) {
                if (sr_id) {
                    let sr = await yyjson.sr_download(sr_id);
                    table = sr.table;
                    yy = sr.sr_yy;
                }
                const table_ = [];
                for (let v of other_list) {
                    table_.push(v.title);
                }
                background = '../../../../../plugins/xhh/resources/yytable/sr.png';
                img = await this.tu(e, table_, name, background);
                isSr = true;
            }
        }

        if (!isSr) {
            data = {
                name,
                isSr,
                list,
                other_list
            };
        } else {
            data = {
                name,
                isSr,
                table,
                yy,
                other_list
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
        if (!ffmpeg()) return false;
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
        let type, lx
        if (/日语|日文/.test(e.msg)) {
            type = '日语'
            lx = 'jp'
        } else if (/汉语|中文|华语/.test(e.msg)) {
            type = '汉语'
            lx = 'cn'
        } else if (/外语|英语|英文/.test(e.msg)) {
            type = '英语'
            lx = 'en'
        } else if (/韩语|韩文/.test(e.msg)) {
            type = '韩语'
            lx = 'kr'
        } else if (/^([0-9]|[0-9][0-9]|[1-2][0-9][0-9])$/.test(e.msg)) {
            type = '汉语'
            lx = 'cn'
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
        let isSr = data.isSr;
        let list = data.list;
        let table = data.table;
        let other_list = data.other_list;
        if (!other_list[n]) return e.reply('喂喂喂！你这序号不对吧🤔', true);
        let yy = data.yy;
        let x;
        const pattern = /[\u4e00-\u9fa5]+/g; // 匹配中文字符
        if (isSr) {
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
        } else {
            for (let v of list) {
                if (v.tab_name == type) {
                    table = v.table;
                    break;
                }
            }
        }
        if (table.length) {
            for (let i in table) {
                if (table[i].name.match(pattern).join('') == other_list[n].title.match(pattern).join('')) {
                    yy = isSr ? yy[x][i].replace(/sourcesrc=|><\/audio><\/div>/g, '') : table[i].audio_url
                    break;
                }
            }
        }
        let yy_ = other_list[n].id + lx + '.ogg'
        logger.mark(`\x1B[36m${yy_}\x1B[0m`);
        let res = await fetch(yy_);
        if (!res.ok) yy_ = yy;
        if (!yy_ || typeof yy_ != 'string') return e.reply('获取该语音失败~', true);
        let vo = segment.record(yy_);
        await e.reply(
            `[简述]:${other_list[n].title}\n[内容]:${other_list[n].dec.replace(/<br\\\/>/g, '\n').replace(/<color=#37FFFF>|<\\\/color>/g, '')}`
        );
        e.reply(vo);
        return true;
    }

    async qc(e) {
        try {
            fs.rmSync('./plugins/xhh/temp/yy_pic/', {
                recursive: true
            });
        } catch (err) { }
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