import { api, mhy, yaml, config } from '#xhh';
import puppeteer from '../../../lib/puppeteer/puppeteer.js';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import moment from "moment";
import fs from 'fs';

async function sendMsg(e, msg) {
    if (typeof msg === 'string') {
        if (e.group) await e.group.sendMsg([{ type: 'text', data: { text: msg } }]);
        else if (e.friend) await e.friend.sendMsg([{ type: 'text', data: { text: msg } }]);
    } else {
        if (e.group) await e.group.sendMsg([msg]);
        else if (e.friend) await e.friend.sendMsg([msg]);
    }
}

const HITOKOTO_API = "https://v1.hitokoto.cn/?c=d&encode=json"

export class bh3_ledger extends plugin {
    constructor(e) {
        super({
            name: '[小花火]崩三水晶',
            dsc: '崩坏3水晶统计查询',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: '^#*水晶$',
                    fnc: 'ledger',
                },
                {
                    reg: '^#*上月水晶$',
                    fnc: 'ledgerLastMonth',
                },
                {
                    reg: '^#*切换水晶uid.*',
                    fnc: 'switchBh3Uid',
                },
            ],
        });
    }

    async getBh3Auth(e) {
        let qq, uid, ck, region;

        if (e.message.length > 1) {
            for (const message of e.message) {
                if (message.type == 'at') {
                    qq = message.qq;
                    break;
                }
            }
        }

        if (!qq) qq = e.user_id;

        // 0. 检查是否用户通过 #切换水晶uid 手动指定了uid
        const savedUid = await redis.get(`xhh:bh3_uid:${qq}`);
        const savedRegion = savedUid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
        if (savedUid && savedRegion) {
            uid = savedUid;
            region = savedRegion;
            // 用 SToken 刷新指定 UID 的 CK，不依赖 NoteUser 缓存（可能存的是别的号的CK）
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = await yaml.get(stokenPath);
                    let entry = stokenData[savedUid];
                    if (entry?.stoken && entry?.stuid) {
                        let hdrs = mhy.getHeaders(e, entry.ck_stoken);
                        let { ltoken } = await mhy.refresh_cookies(e, hdrs, entry.stoken, entry.stuid);
                        if (ltoken) ck = (await NoteUser.create(qq)).getMysUser('bh3')?.ck;
                    }
                } catch (_) { }
            }
        }

        // 1. 尝试从 genshin NoteUser 获取
        if (!uid || !ck) {
            uid = (await NoteUser.create(qq)).getUid('bh3');
            ck = (await NoteUser.create(qq)).getMysUser('bh3')?.ck;
        }

        // 1.5 如果 uid 实际是原神 uid，从 xhh Stoken YAML 查找真正的崩三 uid
        if (uid && String(uid) === String(e.user.getUid('gs')) && qq) {
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = JSON.parse(JSON.stringify(await yaml.get(stokenPath)));
                    const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
                    for (let key in stokenData) {
                        let r = stokenData[key].region || '';
                        if (bh3Regions.includes(r)) {
                            uid = key;
                            region = r;
                            break;
                        }
                    }
                } catch (_) { }
            }
        }

        // 2. 如果 genshin 没有，从 xhh Stoken YAML 获取
        if (!uid || !ck) {
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = await yaml.get(stokenPath);
                    const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
                    for (let key in stokenData) {
                        let r = stokenData[key].region || '';
                        if (bh3Regions.includes(r)) {
                            uid = key;
                            region = r;
                            // 用 SToken 刷新 CK 并绑定到 genshin NoteUser
                            let ck_stoken = stokenData[key].ck_stoken;
                            if (ck_stoken) {
                                let stuid = stokenData[key].stuid;
                                let stoken = stokenData[key].stoken;
                                if (stoken && stuid) {
                                    let hdrs = mhy.getHeaders(e, ck_stoken);
                                    let { ltoken } = await mhy.refresh_cookies(e, hdrs, stoken, stuid);
                                    if (ltoken) {
                                        ck = (await NoteUser.create(qq)).getMysUser('bh3')?.ck;
                                    }
                                }
                            }
                            break;
                        }
                    }
                } catch (_) { }
            }
        }

        if (!uid || !ck) return e.reply('请先扫码绑定账号！');

        let headers = mhy.getHeaders(e, ck);

        // 从Redis获取正确Bh3服务器码
        if (!region) {
            try {
                let usergame = JSON.parse(await redis.get(`genshin:usergame:${uid}:bh3_role`));
                if (usergame) region = usergame.region;
            } catch (_) { }
        }

        if (!region) {
            try {
                const queryStr = 'game_biz=bh3_cn';
                const ds = mhy.getDs2(queryStr, '', '4');
                let roleRes = await fetch('https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie?' + queryStr, {
                    headers: {
                        Cookie: ck,
                        DS: ds,
                        'x-rpc-client_type': '5',
                        'x-rpc-app_version': '2.73.1',
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; XQ-AT52 Build/58.2.A.7.93; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.88 Mobile Safari/537.36 miHoYoBBS/2.73.1',
                        Referer: 'https://webstatic.mihoyo.com/',
                    },
                }).then(r => r.json());
                if (roleRes?.retcode === 0 && roleRes.data?.list?.length) {
                    let role = roleRes.data.list.find(r => String(r.game_uid) === String(uid));
                    if (role) {
                        region = role.region;
                        redis.set(`genshin:usergame:${uid}:bh3_role`, JSON.stringify({ game_biz: role.game_biz, region }));
                    }
                }
            } catch (_) { }
        }

        return { uid, headers, qq, region };
    }

    async switchBh3Uid(e) {
        const qq = e.user_id;
        const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
        if (!fs.existsSync(stokenPath)) return e.reply('请先 #小花火扫码绑定 后再切换UID');

        let stokenData;
        try { stokenData = await yaml.get(stokenPath); } catch (_) { }
        if (!stokenData) return e.reply('读取绑定数据失败');

        const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
        let uidList = [];
        for (let key in stokenData) {
            let r = stokenData[key].region || '';
            if (bh3Regions.includes(r)) {
                uidList.push({ uid: key, region: r, name: stokenData[key].region_name || '' });
            }
        }

        if (uidList.length === 0) return e.reply('没有找到已绑定的崩坏3账号');

        const num = parseInt(e.msg.replace(/^#*切换水晶uid\s*/, '').trim());
        if (!isNaN(num) && num > 0 && num <= uidList.length) {
            const idx = num - 1;
            await redis.set(`xhh:bh3_uid:${qq}`, uidList[idx].uid);
            await redis.set(`xhh:bh3_region:${qq}`, uidList[idx].region);
            return e.reply(`已将水晶查询UID切换为 ${uidList[idx].uid} (${uidList[idx].name || uidList[idx].region})`);
        }

        const current = await redis.get(`xhh:bh3_uid:${qq}`);
        let msg = `当前共 ${uidList.length} 个崩坏3账号：\n`;
        uidList.forEach((item, i) => {
            const isCurrent = item.uid === current ? ' ← 当前' : '';
            msg += `${i + 1}. ${item.uid} (${item.name || item.region})${isCurrent}\n`;
        });
        msg += `\n发送 #切换水晶uid 序号 来切换，如 #切换水晶uid 1`;
        e.reply(msg);
        return true;
    }

    async getHitokoto() {
        try {
            const res = await fetch(HITOKOTO_API, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            })
            if (res) {
                const data = await res.json()
                if (data?.hitokoto) {
                    let text = data.hitokoto
                    if (text.length > 25) text = text.slice(0, 24) + '…'
                    return text
                }
            }
        } catch (e) {
            logger.warn("一言API调用失败", e)
        }
        return "每天都是一个小进步"
    }

    async getUserInfo(e, headers, uid, server) {
        if (!server) server = mhy.getServer(uid, 'bh3');
        let res = await api(e, {
            type: 'bh3_index',
            uid,
            headers,
            game: 'bh3',
            server,
        });
        let avatarUrl = "", nickname = "", userLevel = 0, serverName = "";
        if (res && res.retcode === 0 && res.data?.role) {
            avatarUrl = res.data.role.AvatarUrl || "";
            nickname = res.data.role.nickname || "";
            userLevel = res.data.role.level || 0;
            const region = res.data.role.region || "";
            const serverMap = {
                "cn_gf01": "官服", "cn_qd01": "B服", "os_usa": "美服", "os_euro": "欧服",
                "os_asia": "亚服", "os_cht": "港澳台服", "android01": "安卓官服", "ios01": "iOS服",
                "bb01": "哔哩哔哩", "pc01": "全平台（桌面）服", "yyb01": "应用宝服", "hun01": "渠道1服", "hun02": "渠道2服"
            };
            serverName = serverMap[region] || region || "未知";
        }
        if (!avatarUrl) {
            try {
                let char = await api(e, {
                    type: 'bh3_character',
                    uid,
                    headers,
                    game: 'bh3',
                    server,
                });
                if (char && char.retcode === 0 && char.data?.characters?.length > 0) {
                    avatarUrl = char.data.characters[0].character?.avatar?.icon_path || "";
                }
            } catch (_) { }
        }
        return { avatarUrl, nickname, userLevel, serverName };
    }

    async ledger(e) {
        try {
            sendMsg(e, '正在获取水晶，请稍后...');
            const auth = await this.getBh3Auth(e);
            if (!auth) return false;
            const { uid, headers, qq, region } = auth;

            let res = await api(e, {
                type: 'bh3_ledger',
                uid,
                headers,
                game: 'bh3',
                server: region,
            });

            if (!res || res.retcode !== 0 || !res.data) {
                logger.error(`bh3_ledger API err: ${JSON.stringify(res)}`);
                sendMsg(e, '获取水晶数据失败');
                return true;
            }

            let MonthData = res.data;

        let hcoinRes = await api(e, {
            type: 'bh3_hcoinBalance',
            uid,
            headers,
            game: 'bh3',
        });
        let hcoinBalance = 0;
        if (hcoinRes && hcoinRes.retcode === 0 && hcoinRes.data?.list?.length > 0) {
            let firstItem = hcoinRes.data.list[0].item.find(i => i.label === "当前水晶余量");
            if (firstItem) hcoinBalance = parseInt(firstItem.value);
        }

        let equipSupplyCardNum = 0;
        let page = 1;
        while (page <= 200) {
            let equipSupplyCard = await api(e, {
                type: 'bh3_equipSupplyCard',
                uid,
                headers,
                game: 'bh3',
                page,
            });
            if (!equipSupplyCard || equipSupplyCard.retcode !== 0 || !equipSupplyCard.data?.list?.length) break;
            for (const record of equipSupplyCard.data.list) {
                const nameItem = record.item?.find(i => i.label === "材料名称" && (i.value === "角色补给卡" || i.value === "装备补给卡"));
                if (nameItem) {
                    const opItem = record.item?.find(i => i.value === "购买补给卡");
                    if (opItem) continue;
                    const numItem = record.item?.find(i => i.label === "材料变化数");
                    if (numItem) {
                        const change = parseInt(numItem.value) || 0;
                        if (change > 0) equipSupplyCardNum += change;
                    }
                }
            }
            page++;
        }
        if (equipSupplyCardNum < 0) equipSupplyCardNum = 0;

        let { avatarUrl, nickname, userLevel, serverName } = await this.getUserInfo(e, headers, uid, region);

        let dateParts = (MonthData.date || "").split("-");
        let date_day = 0, date_month = 0;
        if (dateParts.length === 3) {
            date_day = parseInt(dateParts[1]);
            date_month = parseInt(dateParts[2]);
        }

        const hitokoto = await this.getHitokoto();
        let chars = ["Coralie", "Senadina", "Helia"];
        let icons = ["1-1", "1-2", "1-3", "2-1", "2-2", "2-3", "3-1", "3-2", "3-3"];

        let scale = (config().img_quality / 100) * 2.4 || 2.4;
        let buf = await puppeteer.render('小花火/bh3_ledger/ledger', {
            ...MonthData,
            MonthData,
            uid,
            qq,
            equipSupplyCardNum,
            hcoinBalance,
            avatarUrl,
            nickname,
            userLevel,
            serverName,
            juese_url: chars[Math.floor(Math.random() * chars.length)],
            icon_url: icons[Math.floor(Math.random() * icons.length)],
            date_day,
            date_month,
            isLastMonth: false,
            hitokoto,
            hcoinList: [],
            hcoinListB64: "",
            sys: { scale: `style=transform:scale(${scale})` },
            ppath: '../../../../../plugins/xhh/resources/',
            tplFile: process.cwd() + '/plugins/xhh/resources/bh3_ledger/ledger.html',
            saveId: 'ledger',
        });
        try {
            if (buf && Buffer.isBuffer(buf)) {
                let seg = segment.image(buf);
                if (e.group) {
                    await e.group.sendMsg([seg]);
                } else if (e.friend) {
                    await e.friend.sendMsg([seg]);
                }
            }
        } catch (err) {
            logger.error('bh3_ledger: error sending image', err);
        }
        return true;
        } catch (err) {
            logger.error('bh3_ledger ledger error:', err);
            sendMsg(e, '获取水晶数据失败');
            return true;
        }
    }

    async ledgerLastMonth(e) {
        try {
            sendMsg(e, '正在获取上月水晶，请稍后...');
            const auth = await this.getBh3Auth(e);
            if (!auth) return false;
            const { uid, headers, qq, region } = auth;

            let res = await api(e, {
                type: 'bh3_ledger_lastMonth',
                uid,
                headers,
                game: 'bh3',
                server: region,
            });

            if (!res || res.retcode !== 0 || !res.data) {
                logger.error(`bh3_ledger_last API err: ${JSON.stringify(res)}`);
                sendMsg(e, '获取上月水晶数据失败');
                return true;
            }

            let lastMonthData = res.data;

        let hcoinRes = await api(e, {
            type: 'bh3_hcoinBalance',
            uid,
            headers,
            game: 'bh3',
        });
        let hcoinBalance = 0;
        if (hcoinRes && hcoinRes.retcode === 0 && hcoinRes.data?.list?.length > 0) {
            let firstItem = hcoinRes.data.list[0].item.find(i => i.label === "当前水晶余量");
            if (firstItem) hcoinBalance = parseInt(firstItem.value);
        }

        let equipSupplyCardNum = lastMonthData?.equipSupplyCardNum || 0;

        let { avatarUrl, nickname, userLevel, serverName } = await this.getUserInfo(e, headers, uid, region);

        let date_day = 0, date_month = 0, date_str = "";
        let end = null;
        if (lastMonthData.month_end) {
            end = moment(lastMonthData.month_end);
            date_day = end.date();
            date_month = end.month() + 1;
            date_str = `${end.month() + 1}月`;
        }
        if (lastMonthData.month_start && end) {
            const start = moment(lastMonthData.month_start);
            date_str = `${start.month() + 1}月-${end.month() + 1}月`;
        }

        let color = ["#73a8c6", "#d56565", "#70b2b4", "#bd9a5a", "#739970", "#7a6da7", "#597ea0"];
        let hcoinList = [];
        if (lastMonthData.group_by && lastMonthData.group_by.length) {
            hcoinList = lastMonthData.group_by.map((item, i) => ({
                ...item,
                color: color[i % color.length]
            }));
        }

        const prevMonth = parseInt(lastMonthData.month) - 1 || 12;
        const hcoinDiffPercent = lastMonthData.hcoin_rate || 0;
        const starDiffPercent = lastMonthData.star_rate || 0;
        const hcoinDiffPercentAbs = Math.abs(hcoinDiffPercent);
        const starDiffPercentAbs = Math.abs(starDiffPercent);

        let chars = ["Coralie", "Senadina", "Helia"];
        let icons = ["1-1", "1-2", "1-3", "2-1", "2-2", "2-3", "3-1", "3-2", "3-3"];

        let scale = (config().img_quality / 100) * 2.4 || 2.4;
        let buf = await puppeteer.render('小花火/bh3_ledger/ledger', {
            ...lastMonthData,
            MonthData: lastMonthData,
            uid,
            qq,
            equipSupplyCardNum,
            hcoinBalance,
            avatarUrl,
            nickname,
            userLevel,
            serverName,
            juese_url: chars[Math.floor(Math.random() * chars.length)],
            icon_url: icons[Math.floor(Math.random() * icons.length)],
            date_day,
            date_month,
            date_str,
            isLastMonth: true,
            hcoinList,
            hcoinListB64: Buffer.from(JSON.stringify(hcoinList)).toString('base64'),
            prevMonth,
            hcoinDiffPercentAbs,
            starDiffPercentAbs,
            sys: { scale: `style=transform:scale(${scale})` },
            ppath: '../../../../../plugins/xhh/resources/',
            tplFile: process.cwd() + '/plugins/xhh/resources/bh3_ledger/ledger.html',
            saveId: 'ledger',
        });
        try {
            if (buf && Buffer.isBuffer(buf)) {
                let seg = segment.image(buf);
                if (e.group) {
                    await e.group.sendMsg([seg]);
                } else if (e.friend) {
                    await e.friend.sendMsg([seg]);
                }
            }
        } catch (err) {
            logger.error('bh3_ledger_last: error sending image', err);
        }
        return true;
        } catch (err) {
            logger.error('bh3_ledger_last error:', err);
            sendMsg(e, '获取上月水晶数据失败');
            return true;
        }
    }
}
