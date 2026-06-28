import { api, mhy, render, yaml } from '#xhh';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import moment from "moment";
import fs from 'fs';

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
            ],
        });
    }

    async getBh3Auth(e) {
        let qq, uid, ck;

        if (e.message.length > 1) {
            for (const message of e.message) {
                if (message.type == 'at') {
                    qq = message.qq;
                    break;
                }
            }
        }

        if (qq) {
            uid = (await NoteUser.create(qq)).getUid('bh3');
            ck = (await NoteUser.create(qq)).getMysUser('bh3')?.ck;
        }

        if (!uid || !ck) {
            uid = e.user.getUid('bh3');
            const mys = e.user.getMysUser('bh3');
            ck = mys?.ck;
            qq = e.user_id;
        }

        // 如果uid与gs相同，尝试从xhh Stoken YAML查找崩三uid
        if (uid && String(uid) === String(e.user.getUid('gs')) && qq) {
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = await yaml.get(stokenPath);
                    const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
                    for (let key in stokenData) {
                        let r = stokenData[key].region || '';
                        if (bh3Regions.includes(r)) {
                            uid = key;
                            break;
                        }
                    }
                } catch (_) { }
            }
        }

        if (!uid || !ck) return e.reply('请先扫码绑定账号！');

        let headers = mhy.getHeaders(e, ck);

        // 从Redis获取正确Bh3服务器码(如pc01/android01/ios01)
        let region;
        try {
            let usergame = JSON.parse(await redis.get(`genshin:usergame:${uid}:bh3_role`));
            if (usergame) region = usergame.region;
        } catch (_) { }

        // Redis无缓存则直接fetch API获取
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
        e.reply('正在获取水晶，请稍后...');
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

        if (!res || res.retcode !== 0) return e.reply('获取水晶数据失败');

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

        render('bh3_ledger/ledger', {
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
        }, { e, ret: true });

        return true;
    }

    async ledgerLastMonth(e) {
        e.reply('正在获取上月水晶，请稍后...');
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

        if (!res || res.retcode !== 0) return e.reply('获取上月水晶数据失败');

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

        render('bh3_ledger/ledger', {
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
        }, { e, ret: true });

        return true;
    }
}
