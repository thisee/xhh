import { api, mhy, yaml, config, pluginPriority } from '#xhh';
import puppeteer from '../../../lib/puppeteer/puppeteer.js';
import NoteUser from '../../genshin/model/mys/NoteUser.js';
import moment from "moment";
import fs from 'fs';
import YAML from 'yaml';

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
const LEDGER_DATA_DIR = "./data/Bh3Ledger"
const BH3_LEGACY_REGIONS = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
const BH3_REGION_LABELS = {
    android01: '安卓官服',
    ios01: 'iOS服',
    pc01: '桌面服',
    bb01: '哔哩哔哩',
    yyb01: '应用宝服',
    hun01: '渠道1服',
    hun02: '渠道2服',
    cn_gf01: '官服',
    cn_qd01: '渠道服',
};

function isBh3StokenEntry(entry = {}) {
    if (entry.game_biz) return entry.game_biz === 'bh3_cn';
    return BH3_LEGACY_REGIONS.includes(entry.region || '');
}

function debugLog(...args) {
    if (config().debug) logger.mark(...args);
}

export class bh3_ledger extends plugin {
    constructor(e) {
        super({
            name: '[小花火]崩三水晶',
            dsc: '崩坏3水晶统计查询',
            event: 'message',
            priority: pluginPriority('bh3_ledger', 100),
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
                    reg: '^#*删除水晶uid.*',
                    fnc: 'deleteBh3Uid',
                },
                {
                    reg: '^#*切换水晶uid.*',
                    fnc: 'switchBh3Uid',
                },
            ],
        });
    }

    getDataPath(uid) {
        return `${LEDGER_DATA_DIR}/${uid}.json`;
    }

    loadLedgerData(uid) {
        const path = this.getDataPath(uid);
        if (!fs.existsSync(path)) return {};
        try {
            return JSON.parse(fs.readFileSync(path, 'utf8')) || {};
        } catch (_) {
            return {};
        }
    }

    getLedgerMonthKey(monthData) {
        if (!monthData) return moment().format('YYYYMM');
        if (monthData.data_month) return String(monthData.data_month);
        if (monthData.month_start) return moment(monthData.month_start).format('YYYYMM');
        if (monthData.date) return moment(monthData.date).format('YYYYMM');
        if (monthData.month) return moment().format('YYYY') + String(monthData.month).padStart(2, '0');
        return moment().format('YYYYMM');
    }

    async saveLedger(uid, monthData) {
        if (!uid || !monthData) return false;
        const monthKey = this.getLedgerMonthKey(monthData);
        const data = this.loadLedgerData(uid);
        if (data[monthKey] && data[monthKey].isUpdate) {
            data[monthKey] = { ...data[monthKey], ...monthData, equipSupplyCardNum: monthData.equipSupplyCardNum ?? data[monthKey].equipSupplyCardNum, isUpdate: true };
        } else {
            data[monthKey] = { ...monthData, isUpdate: true };
        }
        try {
            fs.mkdirSync(LEDGER_DATA_DIR, { recursive: true });
            fs.writeFileSync(this.getDataPath(uid), JSON.stringify(data, null, 2));
            debugLog('[水晶] saveLedger:', uid, monthKey, 'equipSupplyCardNum:', data[monthKey]?.equipSupplyCardNum);
            return true;
        } catch (err) {
            logger.error('[水晶] saveLedger failed:', err);
            return false;
        }
    }

    getHistoryMonth(uid, monthKey) {
        const data = this.loadLedgerData(uid);
        return data[monthKey] || null;
    }

    parseMaterialRecordTime(record, monthRef = moment()) {
        const candidates = [];
        for (const key of ['time', 'date', 'created_at', 'create_time', 'createdTime', 'createTime']) {
            if (record?.[key]) candidates.push(record[key]);
        }
        for (const item of record?.item || []) {
            if (item?.label && /时间|日期/.test(item.label) && item.value) candidates.push(item.value);
            if (typeof item?.value === 'string' && /\d{1,4}[-/.年]\d{1,2}/.test(item.value)) candidates.push(item.value);
        }
        for (let value of candidates) {
            if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
                const n = Number(value);
                const m = moment(n > 1e12 ? n : n * 1000);
                if (m.isValid()) return m;
            }
            value = String(value).trim();
            const normalized = value.replace(/[年月]/g, '-').replace(/日/g, '').replace(/\./g, '-').replace(/\//g, '-');
            const formats = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD', 'MM-DD HH:mm:ss', 'MM-DD HH:mm', 'MM-DD'];
            for (const fmt of formats) {
                let m = moment(normalized, fmt, true);
                if (m.isValid()) {
                    if (!fmt.startsWith('YYYY')) m.year(monthRef.year());
                    return m;
                }
            }
            const loose = moment(normalized);
            if (loose.isValid()) return loose;
        }
        return null;
    }

    async getHandbookSupplyCardCount(uid, headers, region, isLastMonth = false) {
        const queryStr = `game_biz=bh3_cn&bind_uid=${uid}&bind_region=${region}`;
        const url = `https://api-takumi.mihoyo.com/event/handbook/${isLastMonth ? 'last_month_count' : 'current_month_count'}?${queryStr}`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    Cookie: headers.Cookie,
                    origin: 'https://webstatic.mihoyo.com',
                    referer: 'https://webstatic.mihoyo.com/',
                    'x-rpc-client_type': '5',
                    'x-rpc-app_version': '2.73.1',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; XQ-AT52 Build/58.2.A.7.93; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.88 Mobile Safari/537.36 miHoYoBBS/2.73.1',
                },
            }).then(r => r.json());
            debugLog(`[水晶] handbook ${isLastMonth ? 'last' : 'current'} count response:`, JSON.stringify(res));
            if (res?.retcode === 0 && res.data && Number.isFinite(Number(res.data.count))) {
                return Number(res.data.count) || 0;
            }
        } catch (err) {
            logger.warn?.('[水晶] handbook count failed:', err);
        }
        return null;
    }

    async getEquipSupplyCardNum(e, uid, headers, monthStart = null, monthEnd = null) {
        let equipSupplyCardNum = 0;
        let page = 1;
        while (page <= 200) {
            const equipSupplyCard = await api(e, {
                type: 'bh3_equipSupplyCard',
                uid,
                headers,
                game: 'bh3',
                page,
            });
            if (!equipSupplyCard || equipSupplyCard.retcode !== 0 || !equipSupplyCard.data?.list?.length) break;
            for (const record of equipSupplyCard.data.list) {
                const nameItem = record.item?.find(i => i.label === '材料名称' && (i.value === '角色补给卡' || i.value === '装备补给卡'));
                if (!nameItem) continue;
                const opItem = record.item?.find(i => i.value === '购买补给卡');
                if (opItem) continue;
                if (monthStart && monthEnd) {
                    const recordTime = this.parseMaterialRecordTime(record, monthStart);
                    if (!recordTime || recordTime.isBefore(monthStart) || recordTime.isAfter(monthEnd)) continue;
                }
                const numItem = record.item?.find(i => i.label === '材料变化数');
                const change = parseInt(numItem?.value) || 0;
                if (change > 0) equipSupplyCardNum += change;
            }
            page++;
        }
        return Math.max(equipSupplyCardNum, 0);
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

        const savedUid = await redis.get(`xhh:bh3_uid:${qq}`);
        const savedRegion = savedUid ? await redis.get(`xhh:bh3_region:${qq}`) : null;
        debugLog('[水晶] savedUid:', savedUid, 'savedRegion:', savedRegion);

        if (savedUid && savedRegion) {
            uid = savedUid;
            region = savedRegion;
        }

        if (uid) {
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = await yaml.get(stokenPath);
                    let entry = stokenData[uid];
                    debugLog('[水晶] entry found:', !!entry, 'stuid:', entry?.stuid);
                    if (entry?.stuid) {
                        region = entry.region || region;
                        let nu = await NoteUser.create(qq);
                        for (let ltuid in nu.mysUsers) {
                            if (String(ltuid) === String(entry.stuid)) {
                                ck = nu.mysUsers[ltuid].ck;
                                debugLog('[水晶] matched CK by ltuid:', ltuid);
                                break;
                            }
                        }
                        if (!ck && entry?.ck_stoken && entry?.stoken && entry?.stuid) {
                            debugLog('[水晶] refreshing CK for stuid:', entry.stuid);
                            let hdrs = mhy.getHeaders(e, entry.ck_stoken);
                            let result = await mhy.refresh_cookies(e, hdrs, entry.stoken, entry.stuid);
                            debugLog('[水晶] refresh result:', { hasLtoken: !!result.ltoken, hasCk: !!result.ck });
                            if (result.ltoken && result.ck) {
                                let nu2 = await NoteUser.create(qq);
                                for (let ltuid in nu2.mysUsers) {
                                    if (String(ltuid) === String(entry.stuid)) {
                                        ck = nu2.mysUsers[ltuid].ck;
                                        break;
                                    }
                                }
                                if (!ck) ck = result.ck;
                            }
                        }
                    }
                } catch (_) {}
            }
        }

        if (!uid) {
            try {
                uid = (await NoteUser.create(qq)).getUid('bh3');
                debugLog('[水晶] fallback uid from NoteUser:', uid);
            } catch (_) {}
        }
        if (!ck) {
            try {
                let nu = await NoteUser.create(qq);
                for (let g of ['bh3', 'gs', 'sr', 'zzz']) {
                    let mu = nu.getMysUser(g);
                    if (mu) { ck = mu.ck; debugLog('[水晶] fallback CK from:', g); break; }
                }
                if (!ck) {
                    for (let ltuid in nu.mysUsers) {
                        ck = nu.mysUsers[ltuid].ck;
                        if (ck) { debugLog('[水晶] fallback CK from mysUsers'); break; }
                    }
                }
            } catch (_) {}
        }

        if (uid && String(uid) === String(e.user.getUid('gs')) && qq) {
            debugLog('[水晶] uid matches gs, searching Stoken YAML');
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = JSON.parse(JSON.stringify(await yaml.get(stokenPath)));
                    const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
                    for (let key in stokenData) {
                        if (bh3Regions.includes(stokenData[key].region || '')) {
                            uid = key;
                            region = stokenData[key].region;
                            debugLog('[水晶] found bh3 uid:', uid, region);
                            break;
                        }
                    }
                } catch (_) {}
            }
        }

        if (!uid || !ck) {
            debugLog('[水晶] step4 scanning Stoken YAML');
            let stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
            if (fs.existsSync(stokenPath)) {
                try {
                    let stokenData = await yaml.get(stokenPath);
                    const bh3Regions = ['android01', 'ios01', 'pc01', 'bb01', 'yyb01', 'hun01', 'hun02'];
                    for (let key in stokenData) {
                        if (!bh3Regions.includes(stokenData[key].region || '')) continue;
                        if (!uid) { uid = key; region = stokenData[key].region; }
                        let e2 = stokenData[key];
                        if (!ck && e2?.ck_stoken && e2?.stoken && e2?.stuid) {
                            let hdrs = mhy.getHeaders(e, e2.ck_stoken);
                            let result = await mhy.refresh_cookies(e, hdrs, e2.stoken, e2.stuid);
                            debugLog('[水晶] step4 refresh result:', { uid: key, hasLtoken: !!result.ltoken, hasCk: !!result.ck });
                            if (result.ltoken && result.ck) {
                                ck = result.ck;
                            }
                        }
                        if (uid && ck) break;
                    }
                } catch (_) {}
            }
        }

        debugLog('[水晶] final auth:', { uid, hasCk: !!ck, region });
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

        let uidList = [];
        for (let key in stokenData) {
            let r = stokenData[key].region || '';
            if (isBh3StokenEntry(stokenData[key])) {
                uidList.push({ uid: key, region: r, name: stokenData[key].region_name || BH3_REGION_LABELS[r] || '' });
            }
        }

        if (uidList.length === 0) return e.reply('没有找到已绑定的崩坏3账号');

        const current = await redis.get(`xhh:bh3_uid:${qq}`);
        const num = parseInt(e.msg.replace(/^#*切换水晶uid\s*/, '').trim());
        if (!isNaN(num) && num > 0 && num <= uidList.length) {
            const idx = num - 1;
            await redis.set(`xhh:bh3_uid:${qq}`, uidList[idx].uid);
            await redis.set(`xhh:bh3_region:${qq}`, uidList[idx].region);
            return this.renderSwitchUidCard(e, uidList, uidList[idx].uid, { mode: 'switch', account: uidList[idx] });
        }

        await this.renderSwitchUidCard(e, uidList, current);
        return true;
    }

    async deleteBh3Uid(e) {
        const qq = e.user_id;
        const arg = e.msg.replace(/^#*删除水晶uid\s*/, '').trim();
        const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
        const current = await redis.get(`xhh:bh3_uid:${qq}`);
        const currentRegion = await redis.get(`xhh:bh3_region:${qq}`);
        const { data: stokenData, uidList } = await this.loadBh3UidList(qq);

        if (/^(全部|全删|清空|all)$/i.test(arg)) {
            if (!uidList.length) {
                await redis.del(`xhh:bh3_uid:${qq}`);
                await redis.del(`xhh:bh3_region:${qq}`);
                return this.renderSwitchUidCard(e, [], '', { mode: 'delete_empty' });
            }
            for (const item of uidList) delete stokenData[item.uid];
            await this.writeStokenFile(stokenPath, stokenData);
            await this.deleteBh3FromXiaoyao(qq, uidList.map(v => v.uid));
            await redis.del(`xhh:bh3_uid:${qq}`);
            await redis.del(`xhh:bh3_region:${qq}`);
            return this.renderSwitchUidCard(e, [], '', { mode: 'delete_all', deletedCount: uidList.length });
        }

        if (arg) {
            let target = null;
            const num = parseInt(arg);
            if (!isNaN(num) && num > 0 && num <= uidList.length) target = uidList[num - 1];
            if (!target) target = uidList.find(v => String(v.uid) === String(arg));
            if (!target) return e.reply(`未找到要删除的崩坏3 UID：${arg}\n发送 #删除水晶uid 全部 可清空全部崩三UID`, true);
            delete stokenData[target.uid];
            await this.writeStokenFile(stokenPath, stokenData);
            await this.deleteBh3FromXiaoyao(qq, [target.uid]);
            if (String(current) === String(target.uid)) {
                await redis.del(`xhh:bh3_uid:${qq}`);
                await redis.del(`xhh:bh3_region:${qq}`);
            }
            const rest = uidList.filter(v => String(v.uid) !== String(target.uid));
            return this.renderSwitchUidCard(e, rest, String(current) === String(target.uid) ? '' : current, {
                mode: 'delete_one',
                account: target,
            });
        }

        await redis.del(`xhh:bh3_uid:${qq}`);
        await redis.del(`xhh:bh3_region:${qq}`);
        if (!current) return this.renderSwitchUidCard(e, uidList, '', { mode: 'delete_empty' });
        return this.renderSwitchUidCard(e, uidList, '', {
            mode: 'delete',
            account: { uid: current, region: currentRegion, name: BH3_REGION_LABELS[currentRegion] || currentRegion || '未知服务器' },
        });
    }

    async loadBh3UidList(qq) {
        const stokenPath = `./plugins/xhh/data/Stoken/${qq}.yaml`;
        let data = {};
        if (fs.existsSync(stokenPath)) {
            try { data = await yaml.get(stokenPath) || {}; } catch (_) { data = {}; }
        }
        const uidList = [];
        for (let key in data || {}) {
            const r = data[key].region || '';
            if (isBh3StokenEntry(data[key])) {
                uidList.push({ uid: key, region: r, name: data[key].region_name || BH3_REGION_LABELS[r] || '' });
            }
        }
        return { data, uidList };
    }

    async writeStokenFile(path, data = {}) {
        fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
        fs.writeFileSync(path, YAML.stringify(data), 'utf-8');
    }

    async deleteBh3FromXiaoyao(qq, uids = []) {
        const path = `./plugins/xiaoyao-cvs-plugin/data/yaml/${qq}.yaml`;
        if (!fs.existsSync(path) || !uids.length) return;
        try {
            const data = await yaml.get(path) || {};
            for (const uid of uids) delete data[uid];
            fs.writeFileSync(path, YAML.stringify(data), 'utf-8');
        } catch (_) { }
    }

    async renderSwitchUidCard(e, uidList = [], current = '', action = null) {
        const selected = action?.account || null;
        const accounts = uidList.map((item, i) => ({
            ...item,
            index: i + 1,
            server: item.name || BH3_REGION_LABELS[item.region] || item.region || '未知服务器',
            isCurrent: String(item.uid) === String(current),
            isSelected: selected && String(item.uid) === String(selected.uid) && action?.mode === 'switch',
        }));
        const mode = action?.mode || 'list';
        const headline = mode === 'switch'
            ? '水晶UID切换完成'
            : mode === 'delete'
                ? '默认水晶UID已删除'
                : mode === 'delete_one'
                    ? '崩三UID绑定已删除'
                    : mode === 'delete_all'
                        ? '崩三UID已全部删除'
                : mode === 'delete_empty'
                    ? '暂无默认水晶UID'
                    : '选择水晶查询UID';
        const description = mode === 'switch'
            ? `已将默认水晶查询账号切换为 UID ${selected?.uid || ''}`
            : mode === 'delete'
                ? `已清除默认水晶查询UID：${selected?.uid || ''}，下次扫码绑定会重新自动设置`
                : mode === 'delete_one'
                    ? `已删除崩坏3 UID：${selected?.uid || ''}，不会影响其他游戏绑定`
                    : mode === 'delete_all'
                        ? `已删除 ${action?.deletedCount || 0} 个崩坏3 UID，并清除默认水晶查询UID`
                : mode === 'delete_empty'
                    ? '当前没有设置默认水晶查询UID，扫码绑定时会自动设置'
                    : `当前共绑定 ${accounts.length} 个崩坏3账号，发送 #切换水晶uid 序号 即可切换`;
        try {
            const buf = await puppeteer.render('小花火/bh3_ledger/uid_switch', {
                accounts,
                current,
                selected,
                mode,
                headline,
                description,
                count: accounts.length,
                time: moment().format('YYYY-MM-DD HH:mm:ss'),
                sys: { scale: `style=transform:scale(2.4)` },
                ppath: '../../../../../plugins/xhh/resources/',
                tplFile: process.cwd() + '/plugins/xhh/resources/bh3_ledger/uid_switch.html',
                saveId: `bh3_uid_switch_${e.user_id}`,
            });
            if (buf && Buffer.isBuffer(buf)) return e.reply(segment.image(buf));
        } catch (err) {
            logger.warn(`[xhh][bh3_ledger] 切换UID卡片渲染失败，回退文字: ${err?.message || err}`);
        }
        let msg = mode === 'delete'
            ? `已删除默认水晶查询UID：${selected?.uid || ''}`
            : mode === 'delete_one'
                ? `已删除崩坏3 UID：${selected?.uid || ''}`
                : mode === 'delete_all'
                    ? `已删除全部崩坏3 UID，共 ${action?.deletedCount || 0} 个`
            : mode === 'delete_empty'
                ? '当前没有设置默认水晶查询UID'
                : selected
            ? `已将水晶查询UID切换为 ${selected.uid} (${selected.name || selected.region})`
            : `当前共 ${uidList.length} 个崩坏3账号：\n`;
        if (!selected) {
            uidList.forEach((item, i) => {
                const isCurrent = item.uid === current ? ' ← 当前' : '';
                msg += `${i + 1}. ${item.uid} (${item.name || item.region})${isCurrent}\n`;
            });
            msg += `\n发送 #切换水晶uid 序号 来切换，如 #切换水晶uid 1`;
        }
        return e.reply(msg);
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
            let queryStr = `game_biz=bh3_cn&bind_uid=${uid}&bind_region=${region}`;
            debugLog('[水晶] query:', queryStr);
            let res = await fetch(`https://api.mihoyo.com/bh3-weekly_finance/api/index?${queryStr}`, {
                method: 'GET',
                headers: {
                    Cookie: headers.Cookie,
                    DS: mhy.getDs2(queryStr, '', '4'),
                    'x-rpc-client_type': '5',
                    'x-rpc-app_version': '2.73.1',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; XQ-AT52 Build/58.2.A.7.93; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.88 Mobile Safari/537.36 miHoYoBBS/2.73.1',
                    Referer: 'https://webstatic.mihoyo.com/',
                },
            }).then(r => r.json());

            debugLog('[水晶] API response:', JSON.stringify(res));

            if (!res || res.retcode !== 0 || !res.data) {
                let msg = '获取水晶数据失败';
                if (res?.retcode === -110) msg = `UID:${uid} 该账号没有绑定崩坏3角色`;
                else if (res?.retcode === -120) msg = `UID:${uid} 崩坏3角色等级不足`;
                sendMsg(e, msg);
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

        let equipSupplyCardNum = await this.getHandbookSupplyCardCount(uid, headers, region, false);
        if (equipSupplyCardNum === null) equipSupplyCardNum = await this.getEquipSupplyCardNum(e, uid, headers);
        MonthData.equipSupplyCardNum = equipSupplyCardNum;
        await this.saveLedger(uid, MonthData);


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
            sys: { scale: `style=transform:scale(2.4)` },
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
            const lastMonthKey = moment().subtract(1, 'month').format('YYYYMM');
            const cachedLastMonthData = this.getHistoryMonth(uid, lastMonthKey);

            let queryStr = `game_biz=bh3_cn&bind_uid=${uid}&bind_region=${region}`;
            let res = await fetch(`https://api.mihoyo.com/bh3-weekly_finance/api/getLastMonthInfo?${queryStr}`, {
                method: 'GET',
                headers: {
                    Cookie: headers.Cookie,
                    DS: mhy.getDs2(queryStr, '', '4'),
                    'x-rpc-client_type': '5',
                    'x-rpc-app_version': '2.73.1',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; XQ-AT52 Build/58.2.A.7.93; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.88 Mobile Safari/537.36 miHoYoBBS/2.73.1',
                    Referer: 'https://webstatic.mihoyo.com/',
                },
            }).then(r => r.json());

            let lastMonthData = res?.data;
            if (!res || res.retcode !== 0 || !lastMonthData) {
                if (cachedLastMonthData) {
                    lastMonthData = cachedLastMonthData;
                    debugLog('[上月水晶] API失败，使用本地缓存:', lastMonthKey);
                } else {
                    let msg = '获取上月水晶数据失败';
                    if (res?.retcode === -110) msg = `UID:${uid} 该账号没有绑定崩坏3角色`;
                    else if (res?.retcode === -120) msg = `UID:${uid} 崩坏3角色等级不足`;
                    sendMsg(e, msg);
                    return true;
                }
            }
            if (cachedLastMonthData?.equipSupplyCardNum && !lastMonthData.equipSupplyCardNum) {
                lastMonthData.equipSupplyCardNum = cachedLastMonthData.equipSupplyCardNum;
                debugLog('[上月水晶] equipSupplyCardNum from cache:', lastMonthData.equipSupplyCardNum);
            }

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

        let equipSupplyCardNum = await this.getHandbookSupplyCardCount(uid, headers, region, true);
        if (equipSupplyCardNum === null) {
            const lastMonthStart = moment().subtract(1, 'month').startOf('month');
            const lastMonthEnd = moment().subtract(1, 'month').endOf('month');
            equipSupplyCardNum = await this.getEquipSupplyCardNum(e, uid, headers, lastMonthStart, lastMonthEnd);
        }
        if (!equipSupplyCardNum) equipSupplyCardNum = Number(lastMonthData?.equipSupplyCardNum || cachedLastMonthData?.equipSupplyCardNum || 0);
        lastMonthData.equipSupplyCardNum = equipSupplyCardNum;
        await this.saveLedger(uid, lastMonthData);

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
            sys: { scale: `style=transform:scale(2.4)` },
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
