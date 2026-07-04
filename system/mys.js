import fetch from 'node-fetch';
import fs from 'fs';
import {
    yaml
} from '#xhh';
import YAML from 'yaml';

const ZZZ_NANOKA_VERSION = '3.1.3+17059869';
const ZZZ_NANOKA_BASE = `https://static.nanoka.cc/zzz/${ZZZ_NANOKA_VERSION}`;

const BH3_WIKI_BASE = 'https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki';
const BH3_APP_SN = 'bh3_wiki';

const BH3_CHANNEL_MAP = {
    js: 18,     // 角色
    wq: 20,     // 武器
    syw: 19,    // 圣痕
    yq: 21,     // 人偶/协同者
    hb: 218     // 协同者
};

class mys {
    //图鉴
    async tujian(isSr = false, isZZZ = false, isBH3 = false) {
        if (isZZZ) {
            return await this.zzz_tujian();
        }
        if (isBH3) {
            return await this.bh3_tujian();
        }
        let url =
            'https://api-takumi-static.mihoyo.com/common/blackboard/ys_obc/v1/home/content/list?app_sn=ys_obc&channel_id=189';
        if (isSr)
            url =
            'https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/home/content/list?app_sn=sr_wiki&channel_id=17';
        let res;
        try {
            res = await fetch(url).then(res => res.json());
        } catch (error) {
            logger.error('米游社访问失败');
            return false;
        }
        let children = res.data.list[0].children;
        let data = {};
        children.map(va => {
            if (va.name == '角色') data['js_list'] = va.list;
            else if (va.name == '武器') data['wq_list'] = va.list;
            else if (va.name == '圣遗物') data['syw_list'] = va.list;
            else if (va.name == '光锥') data['gz_list'] = va.list;
            else if (va.name == '遗器') data['yq_list'] = va.list;
        });
        return data;
    }
    // 绝区零图鉴 (使用 nanoka.cc)
    async zzz_tujian() {
        try {
            const [chars, weapons, equipments, bangboos] = await Promise.all([
                fetch(`${ZZZ_NANOKA_BASE}/character.json`).then(r => r.json()),
                fetch(`${ZZZ_NANOKA_BASE}/weapon.json`).then(r => r.json()),
                fetch(`${ZZZ_NANOKA_BASE}/equipment.json`).then(r => r.json()),
                fetch(`${ZZZ_NANOKA_BASE}/bangboo.json`).then(r => r.json())
            ]);
            return {
                js_list: Object.entries(chars).map(([id, c]) => ({
                    content_id: id,
                    title: c.zh,
                    icon: c.icon,
                    ext: JSON.stringify({
                        c_30: { picture: { list: [c.icon] } },
                        filter: { text: JSON.stringify([
                            `星级/${c.rank == 4 ? '四星' : '三星'}`,
                            `属性/${this.zzz_element_map[c.element] || '未知'}`,
                            `强攻类型/${this.zzz_type_map[c.type] || '未知'}`
                        ])}
                    })
                })),
                wq_list: Object.entries(weapons).map(([id, w]) => ({
                    content_id: id,
                    title: w.zh,
                    icon: w.icon,
                    ext: JSON.stringify({
                        c_30: { picture: { list: [w.icon] } },
                        filter: { text: JSON.stringify([
                            `武器星级/${w.rank == 5 ? '五星' : w.rank == 4 ? '四星' : w.rank == 3 ? '三星' : '二星'}`,
                            `武器类型/${this.zzz_weapon_type_map[w.type] || '未知'}`
                        ])}
                    })
                })),
                syw_list: Object.entries(equipments).map(([id, e]) => ({
                    content_id: id,
                    title: e.zh?.name || id,
                    icon: e.icon,
                    ext: JSON.stringify({
                        c_30: { picture: { list: [e.icon] } },
                        filter: { text: '[]' }
                    })
                })),
                yq_list: Object.entries(bangboos).map(([id, b]) => ({
                    content_id: id,
                    title: b.zh,
                    icon: b.icon,
                    ext: JSON.stringify({
                        c_30: { picture: { list: [b.icon] } },
                        filter: { text: '[]' }
                    })
                }))
            };
        } catch (error) {
            logger.error('ZZZ nanoka访问失败:', error);
            return false;
        }
    }

    zzz_element_map = {
        200: '物理',
        201: '火',
        202: '冰',
        203: '电',
        204: '以太',
        205: '风'
    };

    zzz_type_map = {
        1: '强攻',
        2: '击破',
        3: '防护',
        4: '支援',
        5: '异常'
    };

    zzz_weapon_type_map = {
        1: '单手剑',
        2: '双手剑',
        3: '长柄武器',
        4: '法器',
        5: '弓'
    };

    // 崩坏3图鉴 (使用官方 wiki API)
    async bh3_tujian() {
        try {
            const [chars, weapons, stigmatas, elves, partners] = await Promise.all([
                fetch(`${BH3_WIKI_BASE}/v1/home/content/list?app_sn=${BH3_APP_SN}&channel_id=${BH3_CHANNEL_MAP.js}`).then(r => r.json()),
                fetch(`${BH3_WIKI_BASE}/v1/home/content/list?app_sn=${BH3_APP_SN}&channel_id=${BH3_CHANNEL_MAP.wq}`).then(r => r.json()),
                fetch(`${BH3_WIKI_BASE}/v1/home/content/list?app_sn=${BH3_APP_SN}&channel_id=${BH3_CHANNEL_MAP.syw}`).then(r => r.json()),
                fetch(`${BH3_WIKI_BASE}/v1/home/content/list?app_sn=${BH3_APP_SN}&channel_id=${BH3_CHANNEL_MAP.yq}`).then(r => r.json()),
                fetch(`${BH3_WIKI_BASE}/v1/home/content/list?app_sn=${BH3_APP_SN}&channel_id=${BH3_CHANNEL_MAP.hb}`).then(r => r.json())
            ]);
            const parseList = (res, channelKey) => {
                if (!res.data || !res.data.list || !res.data.list[0]) return [];
                return res.data.list[0].list.map(item => ({
                    content_id: item.content_id,
                    title: item.title,
                    icon: item.icon,
                    ext: typeof item.ext === 'string' ? item.ext : JSON.stringify(item.ext || {})
                }));
            };
            return {
                js_list: parseList(chars, 'c_18'),
                wq_list: parseList(weapons, 'c_20'),
                syw_list: parseList(stigmatas, 'c_19'),
                yq_list: [...parseList(elves, 'c_21'), ...parseList(partners, 'c_218')]
            };
        } catch (error) {
            logger.error('BH3 wiki访问失败:', error);
            return false;
        }
    }
    /*
原神
js,wq,syw 角色,武器,圣遗物 默认js
获取角色特有id,图标,星级,元素,武器类型
获取武器特有id,图标,星级,武器类型
获取圣遗物特有id,图标

传name回一个id，不传name回全部(包括名字)

星铁
js,gz,yq 角色,光锥,遗器
获取角色id,图标,星级,属性,命途
获取武器id,图标,星级,命途
获取遗器id,图标

绝区零
js,wq,syw,yq 角色,音擎,驱动盘,邦布
获取角色id,图标,星级,属性,强攻类型
获取音擎id,图标,星级,音擎类型
获取驱动盘id,图标
获取邦布id,图标

崩坏3
js,wq,syw,yq 角色,武器,圣痕,人偶
获取角色id,图标,星级,属性,角色名
获取武器id,图标,星级,武器类型
获取圣痕id,图标,星级,位置,属性
获取人偶id,图标
*/
    async data(name = '', type = 'js', isSr = false, isZZZ = false, isBH3 = false) {
        if (isZZZ) {
            return await this.zzz_data(name, type);
        }
        if (isBH3) {
            return await this.bh3_data(name, type);
        }
        let data = await this.tujian(isSr);
        if (!data) return false;
        let list = data.js_list;
        switch (type) {
            case 'wq':
                list = data.wq_list;
                break;
            case 'gz':
                list = data.gz_list;
                break;
            case 'syw':
                list = data.syw_list;
                if (name) return list;
                break;
            case 'yq':
                list = data.yq_list;
                if (name) return list;
        }
        let text;
        if (name) {
            let id; 
            for (let va of list) {
                id = va.content_id;
                if (va.title.replace(/ /g, '') == name) return {
                    id
                };
            }
            return false;
        } else {
            let names = [],
                ids = [],
                icons = [],
                jis = [],
                yuanshus = [],
                wuqis = [],
                shuxs = [],
                mingtus = [];
            data = [];
            for (let n in list) {
                const title = list[n].title.replace(/ /g, '');
                if (title.includes('预告')) continue;
                else if (title.includes('奇偶·')) continue;
                else if (title == '开拓者·毁灭') continue;
                names.push(title);
                ids.push(list[n].content_id);
                icons.push(list[n].icon);
                if (!['syw', 'yq'].includes(type)) {
                    text = JSON.parse(list[n].ext);
                    text = text.c_25 || text.c_5 || text.c_19 || text.c_18;
                    text = text.filter.text;
                    text = JSON.parse(text);
                    if (type == 'gz') {
                        for (let s of text) {
                            if (s.includes('星级')) jis.push(s.replace(/星级\//, ''));
                            else if (s.includes('命途')) mingtus.push(s.replace(/命途\//, ''));
                        }
                        continue;
                    }
                    if (type != 'wq') {
                        for (let s of text) {
                            if (s.includes('星级')) jis.push(s.replace(/星级\//, ''));
                            else if (s.includes('元素')) yuanshus.push(s.replace(/元素\//, ''));
                            else if (s.includes('武器')) wuqis.push(s.replace(/武器\//, ''));
                            else if (s.includes('属性')) shuxs.push(s.replace(/属性\//, ''));
                            else if (s.includes('命途')) mingtus.push(s.replace(/命途\//, ''));
                        }
                    } else {
                        for (let s of text) {
                            if (s.includes('武器星级')) jis.push(s.replace(/武器星级\//, ''));
                            else if (s.includes('武器类型')) wuqis.push(s.replace(/武器类型\//, ''));
                        }
                    }
                }
            }
            // 图鉴别名补缺
            //  const pa='./plugins/xhh/system/default/gz_names.yaml'
            //  const _data=yaml.get(pa)
            //  names.map(v=>{
            //     if(!_data[v]) _data[v]=[v]
            //  })
            //  fs.writeFileSync(pa,YAML.stringify(_data))

            names.map((v, i) => {
                data[i] = {
                    name: v,
                    id: ids[i],
                    icon: JSON.parse(list[i].ext).c_30?.picture?.list[0] || icons[i],
                    ji: jis[i],
                    yuanshu: yuanshus[i],
                    wuqi: wuqis[i],
                    shuxing: shuxs[i],
                    mingtu: mingtus[i],
                };
            });
            return data;
        }
    }

    // 绝区零数据获取
    async zzz_data(name = '', type = 'js') {
        let data = await this.zzz_tujian();
        if (!data) return false;
        let list = data.js_list;
        switch (type) {
            case 'wq':
                list = data.wq_list;
                break;
            case 'syw':
                list = data.syw_list;
                if (name) return list;
                break;
            case 'yq':
                list = data.yq_list;
                if (name) return list;
        }
        if (name) {
            for (let va of list) {
                if (va.title.replace(/ /g, '') == name) return { id: va.content_id };
            }
            return false;
        } else {
            let names = [], ids = [], icons = [], jis = [], attributes = [], types = [], factions = [];
            data = [];
            for (let n in list) {
                const title = list[n].title.replace(/ /g, '');
                if (title.includes('预告')) continue;
                names.push(title);
                ids.push(list[n].content_id);
                icons.push(list[n].icon);
                let text = JSON.parse(list[n].ext);
                text = text.filter?.text || '[]';
                text = JSON.parse(text);
                for (let s of text) {
                    if (s.includes('星级')) jis.push(s.replace(/星级\//, ''));
                    else if (s.includes('属性')) attributes.push(s.replace(/属性\//, ''));
                    else if (s.includes('强攻类型')) types.push(s.replace(/强攻类型\//, ''));
                }
            }
            names.map((v, i) => {
                data[i] = {
                    name: v,
                    id: ids[i],
                    icon: JSON.parse(list[i].ext).c_30?.picture?.list[0] || icons[i],
                    ji: jis[i],
                    yuanshu: attributes[i],
                    wuqi: types[i],
                };
            });
            return data;
        }
    }

    // 崩坏3数据获取
    async bh3_data(name = '', type = 'js') {
        let data = await this.bh3_tujian();
        if (!data) return false;
        let list = data.js_list;
        switch (type) {
            case 'wq':
                list = data.wq_list;
                break;
            case 'syw':
                list = data.syw_list;
                break;
            case 'yq':
                list = data.yq_list;
        }
        if (name) {
            const cleanName = String(name).replace(/[（(](上|中|下)[）)]|·(上|中|下)$|-(上|中|下)$/g, '').replace(/\s+/g, '');
            const isSetItem = va => {
                if (type !== 'syw') return true;
                try {
                    const ext = JSON.parse(va.ext || '{}');
                    const filters = JSON.parse(ext.c_19?.filter?.text || ext.filter?.text || '[]');
                    return filters.some(s => s.includes('圣痕构成') && s.includes('套装'));
                } catch (_) { return false; }
            };
            const matchTitle = va => {
                const cleanTitle = String(va.title).replace(/[（(](上|中|下)[）)]|·(上|中|下)$|-(上|中|下)$/g, '').replace(/\s+/g, '');
                return cleanTitle == cleanName || cleanTitle.startsWith(cleanName) || cleanName.startsWith(cleanTitle);
            };
            let found = list.find(va => matchTitle(va) && isSetItem(va));
            if (!found) found = list.find(va => matchTitle(va));
            if (found) return { id: found.content_id };
            return false;
        } else {
            data = [];
            const channelKey = type == 'wq' ? 'c_20' : type == 'syw' ? 'c_19' : type == 'js' ? 'c_18' : 'c_21';
            for (let n in list) {
                const item = list[n];
                const title = item.title.replace(/ /g, '');
                if (title.includes('预告')) continue;

                let ji = '未知', attribute = '未知', wuqi = type == 'syw' ? '未知' : '未知', isSet = 'false';
                try {
                    const ext = JSON.parse(item.ext || '{}');
                    const filterText = ext[channelKey]?.filter?.text || ext.filter?.text || '[]';
                    const filters = JSON.parse(filterText);
                    for (let s of filters) {
                        if (s.includes('初始阶级')) {
                            const rank = s.replace('初始阶级/', '');
                            ji = rank === 'S' ? '五星' : '四星';
                        } else if (s.includes('星级') || s.includes('武器星级') || s.includes('圣痕星级') || s.includes('人偶星级')) {
                            ji = s.replace(/(武器|圣痕|人偶)?星级\//, '');
                        } else if (s.includes('属性')) {
                            attribute = s.replace('属性/', '');
                        } else if (s.includes('武器类型')) {
                            wuqi = s.replace('武器类型/', '');
                        } else if (s.includes('人偶类型')) {
                            wuqi = s.replace('人偶类型/', '');
                        } else if (s.includes('圣痕位置')) {
                            wuqi = s.replace('圣痕位置/', '');
                        } else if (s.includes('圣痕构成') && s.includes('套装')) {
                            isSet = 'true';
                        }
                    }
                } catch (err) {
                    try { if ((yaml.get('./plugins/xhh/config/config.yaml') || {}).debug) logger.mark(`[xhh] BH3 wiki ext解析失败: ${title}`); } catch (_) {}
                }

                data.push({
                    name: title,
                    id: item.content_id,
                    icon: item.icon,
                    ji,
                    yuanshu: attribute,
                    wuqi,
                    isSet
                });
            }
            return data;
        }
    }

    //获取详细信息
    async detail(id, isSr = false, isZZZ = false, isBH3 = false) {
        if (isZZZ) {
            return await this.zzz_detail(id);
        }
        if (isBH3) {
            return await this.bh3_detail(id);
        }
        let url = `https://api-takumi-static.mihoyo.com/hoyowiki/genshin/wapi/entry_page?app_sn=ys_obc&entry_page_id=${id}`;
        if (isSr)
            url = `https://api-static.mihoyo.com/common/blackboard/sr_wiki/v1/content/info?app_sn=sr_wiki&content_id=${id}`;
        let res;
        try {
            res = await fetch(url).then(res => res.json());
        } catch (error) {
            logger.error('米游社访问失败');
            return false;
        }
        return res.data;
    }

    // 绝区零详细信息 (nanoka.cc)
    async zzz_detail(id) {
        try {
            let url;
            if (id >= 1000 && id < 2000) {
                url = `${ZZZ_NANOKA_BASE}/zh/character/${id}.json`;
            } else if (id >= 12000 && id < 20000) {
                url = `${ZZZ_NANOKA_BASE}/zh/weapon/${id}.json`;
            } else if (id >= 31000 && id < 40000) {
                url = `${ZZZ_NANOKA_BASE}/zh/equipment/${id}.json`;
            } else if (id >= 53000 && id < 60000) {
                url = `${ZZZ_NANOKA_BASE}/zh/bangboo/${id}.json`;
            } else {
                return false;
            }
            const res = await fetch(url).then(r => r.json());
            return { content: res };
        } catch (error) {
            logger.error('ZZZ nanoka详情访问失败:', error);
            return false;
        }
    }

    // 崩坏3详细信息 (官方 wiki API)
    async bh3_detail(id) {
        try {
            const url = `${BH3_WIKI_BASE}/v1/content/info?app_sn=${BH3_APP_SN}&content_id=${id}`;
            const res = await fetch(url).then(r => r.json());
            if (res.retcode !== 0) return false;
            return { content: res.data.content };
        } catch (error) {
            logger.error('BH3 wiki详情访问失败:', error);
            return false;
        }
    }
}
export default new mys();