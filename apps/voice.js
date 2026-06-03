import fs from 'fs';
import {
    yyjson,
    yaml,
    render,
    mys,
    config,
    getSource
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
                reg: '^(#|\\*)(星铁|原神)?(.*)语音(列表)?$',
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
        let isSrMode = e.msg.startsWith("*") || e.msg.includes("星铁");
        let name = e.msg.replace(/#|\*|星铁|原神|语音|列表/g, "");
        let miaoPath = "./plugins/miao-plugin/config/roleName.yaml";
        let miaoRoleName = fs.existsSync(miaoPath) ? yaml.get(miaoPath) : null;

        //调用小花火原神别名
        let gsnames = yaml.get("./plugins/xhh/system/default/gs_js_names.yaml") || {};
        if (miaoRoleName && miaoRoleName.gs) {
            for (let key in miaoRoleName.gs) {
                if (!gsnames[key]) gsnames[key] = [];
                if (Array.isArray(miaoRoleName.gs[key])) gsnames[key] = gsnames[key].concat(miaoRoleName.gs[key]);
            }
        }
        if (!isSrMode) {
            for (let i in gsnames) {
                if (gsnames[i] && gsnames[i].includes(name)) {
                    name = i;
                    break;
                }
            }
        }
        //先查原神
        // let gs_id = (await mys.data(name)).id;
        let background = '../../../../../plugins/xhh/resources/yytable/bg0.png';

        if (name == '空') {
            // gs_id = '505542'
            background = '../../../../../plugins/xhh/resources/yytable/bg.png';
        } else if (name == '荧') {
            // gs_id = '505527'
            background = '../../../../../plugins/xhh/resources/yytable/bg.png';
        }
        let img;
        let data, table = [];
        let mysData = null;

        // ======= 步骤1：尝试走 MYS 官方主源 =======
        try {
            if (isSrMode) {
                let sr_id = (await mys.data(name, "js", true))?.id;
                if (sr_id) mysData = await yyjson.sr_download(sr_id);
            } else {
                let gs_id = (await mys.data(name))?.id;
                if (gs_id) mysData = await yyjson.gs_download(gs_id);
            }
        } catch (err) {
            logger.info("[小花火] MYS接口暂无数据或失效，准备走内鬼网备用源...");
        }

        // ======= 步骤2：检查主源数据，失败则走内鬼网备用源 =======
        if (mysData && mysData.list && mysData.list.length > 0) {
            data = mysData;
            data.isMys = true; // 增加MYS数据标记，方便发语音时区分
            if (isSrMode) background = "../../../../../plugins/xhh/resources/yytable/sr.png";
        } else {
            if (isSrMode) {
                let srnames = yaml.get("./plugins/xhh/system/default/sr_js_names.yaml") || {};
                if (miaoRoleName && miaoRoleName.sr) {
                    for (let key in miaoRoleName.sr) {
                        if (!srnames[key]) srnames[key] = [];
                        if (Array.isArray(miaoRoleName.sr[key])) srnames[key] = srnames[key].concat(miaoRoleName.sr[key]);
                    }
                }
                for (let i in srnames) {
                    if (srnames[i] && srnames[i].includes(name)) {
                        name = i;
                        break;
                    }
                }
                data = await yyjson.sr_other_download(name);
                background = "../../../../../plugins/xhh/resources/yytable/sr.png";
            } else {
                data = await yyjson.gs_other_download(name);
            }
        }

        if (!data || !data.list || data.list.length === 0) {
            await e.reply("未获取到" + name + "的语音数据，如确认为已实装角色，请检查配置文件。");
            return false;
        }

        // ======= 步骤3：生成图片 =======
        for (let v of data.list) {
            table.push(v.title);
        }
        img = await this.tu(e, table, name, background);

        // if (!isSr) {
        //     data = {
        //         name,
        //         isSr,
        //         list,
        //         list
        //     };
        // } else {
        //     data = {
        //         name,
        //         isSr,
        //         table,
        //         yy,
        //         list
        //     };
        // }

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
        let source = await getSource(e)
        if (!source) return false;
        if (Number(source.user_id) !== Number(Bot.uin)) return false;
        if (source.message[0]?.type != 'image') return false;

        if (e.msg && e.msg.length > 5) return false;
        let xh = /\d+/.exec(e.msg);
        let n = xh - 1;
        let lx
        if (/日语|日文/.test(e.msg)) {
            // type = '日语'
            lx = 'jp'
        } else if (/汉语|中文|华语/.test(e.msg)) {
            // type = '汉语'
            lx = 'cn'
        } else if (/外语|英语|英文/.test(e.msg)) {
            // type = '英语'
            lx = 'en'
        } else if (/韩语|韩文/.test(e.msg)) {
            // type = '韩语'
            lx = 'kr'
        } else if (/^([0-9]|[0-9][0-9]|[1-2][0-9][0-9])$/.test(e.msg)) {
            // type = '汉语'
            lx = 'cn'
        } else {
            return false;
        }

        source.message_id = source.message_id.toString().replace(/\//g, '');

        if (!fs.existsSync(`./plugins/xhh/temp/yy_pic/${source.message_id}.json`)) return false;
        let data = JSON.parse(
            fs.readFileSync(
                `./plugins/xhh/temp/yy_pic/${source.message_id}.json`,
                'utf-8'
            )
        );
        // let isSr = data.isSr;
        // let list = data.list;
        // let table = data.table;
        let {
            list,
            id
        } = data;
        if (!list[n]) return e.reply('喂喂喂！你这序号不对吧🤔', true);
        // let yy = data.yy;
        // let x;
        // const pattern = /[\u4e00-\u9fa5]+/g; // 匹配中文字符
        // if (isSr) {
        //     switch (type) {
        //         case '汉语': {
        //             x = 0;
        //             break;
        //         }
        //         case '英语': {
        //             x = 1;
        //             break;
        //         }
        //         case '日语': {
        //             x = 2;
        //             break;
        //         }
        //         case '韩语': {
        //             x = 3;
        //             break;
        //         }
        //         default:
        //             return false;
        //     }
        // } else {
        //     for (let v of list) {
        //         if (v.tab_name == type) {
        //             table = v.table;
        //             break;
        //         }
        //     }
        // }
        // if (table.length) {
        //     for (let i in table) {
        //         if (table[i].name.match(pattern).join('') == list[n].title.match(pattern).join('')) {
        //             yy = isSr ? yy[x][i].replace(/sourcesrc=|><\/audio><\/div>/g, '') : table[i].audio_url
        //             break;
        //         }
        //     }
        // }
        if (!ffmpeg()) return false;
        let yy;

        // 判断当前缓存的数据是否为 MYS 源
        if (data.isMys) {
            yy = list[n]["audio_" + lx] || list[n].audio_cn; // 动态提取对应的语种
            logger.mark(`[小花火语音] 正在获取 MYS 源语音: \x1B[36m${yy}\x1B[0m`);
            let res = await fetch(yy);
            if (!res.ok) return e.reply("获取MYS语音失败，请检查是否更新", true);
            let bufferData = Buffer.from(await res.arrayBuffer());
            yy = "./plugins/xhh/temp/yy_pic/temp.mp3";
            fs.writeFileSync(yy, bufferData);
        } else {
            // 内鬼网备用源防盗链拉取逻辑
            yy = list[n].id + lx + ".ogg";
            logger.mark(`[小花火语音] 正在获取内鬼网语音: \x1B[36m${yy}\x1B[0m`);
            let res = await fetch(yy);
            if (!res.ok) {
                logger.mark("语音直接访问失败，尝试添加防盗链请求头下载...");
                let headers = {
                    "accept": "*/*",
                    "accept-encoding": "identity;q=1, *;q=0",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                    "cookie": "_first_time=1;_lr_retry_request=true;",
                    "Range": "bytes=0-",
                    "referer": id.includes("-character") ? `https://starrail.honeyhunterworld.com/${id}/` : `https://gensh.honeyhunterworld.com/${id}/`,
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"
                };
                res = await fetch(yy, { method: "GET", headers });
                if (!res.ok) return e.reply("获取备用源语音失败，请检查是否更新", true);
                let bufferData = Buffer.from(await res.arrayBuffer());
                yy = "./plugins/xhh/temp/yy_pic/temp.ogg";
                fs.writeFileSync(yy, bufferData);
            }
        }
        // if (!yy_ || typeof yy_ != 'string') return e.reply('获取该语音失败~', true);
        let vo = segment.record(yy);
        await e.reply(
            `[简述]:${list[n].title}\n[内容]:${list[n].dec.replace(/<br\\\/>/g, '\n').replace(/<color=#37FFFF>|<\\\/color>/g, '')}`
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

    async temp() {
        if (!fs.existsSync('./plugins/xhh/temp/yy_pic/')) {
            fs.mkdirSync('./plugins/xhh/temp/yy_pic/', {
                recursive: true
            });
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