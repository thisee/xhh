import { api, mhy, render, config } from '#xhh';


export class hbzz extends plugin {
    constructor(e) {
        super({
            name: '[小花火]货币战争',
            dsc: '',
            event: 'message',
            priority: 123,
            rule: [
                {
                    reg: '#*(星铁)?货币战争$',
                    fnc: 'hb',
                }
            ]
        })
    }

    async hb(e) {
        //获取uid
        const uid = e.user.getUid('sr');
        //获取ck
        const mys = e.user.getMysUser('sr');
        const ck = mys.ck;
        if (!uid || !ck) return e.reply('请先扫码绑定账号！');

        //获取headers
        let headers = mhy.getHeaders(e, ck);
        headers['x-rpc-client_type'] = 5
        const server = mhy.getServer(uid, 'sr')
        headers.DS = mhy.getDs2(`role_id=${uid}&server=${server}`, '', 4) //补对Ds

        let data = {
            uid,
            headers,
            server,
            type: 'huobi',
        };

        let res = await api(e, data);

        data = res.data

        if (!data?.grid_fight_brief?.season_level) return false
        //qq
        const qq = e.user_id
        //晋升等级
        const season_level = data.grid_fight_brief.season_level
        //职级
        const face = data.grid_fight_brief.division.icon_with_bg
        const level = 'A' + (Number(data.grid_fight_brief.division.level) - 1).toString()
        const name = data.grid_fight_brief.division.name_with_num
        //货币积分
        const weekly_score_cur = data.grid_fight_brief.weekly_score_cur
        const weekly_score_max = data.grid_fight_brief.weekly_score_max
        //战绩记录
        const grid_fight_archive_list = data.grid_fight_archive_list
        const list = []
        for (const k of grid_fight_archive_list) {
            const item = {}
            //A几
            item.A = Number(k.brief.division.level) - 1
            //icon
            item.icon = k.brief.division.icon
            //级别
            item.name = k.brief.division.name_with_num
            //什么博弈
            item.type = k.archive_type == 'ArchiveTypeHard' ? '超频博弈' : '标准博弈'
            //时间
            item.time = k.brief.archive_time
            //评级
            item.rank = k.brief.archive_rank.replace('GridFightArchiveRank', '')
            //小队生命值
            item.hp = k.brief.remain_hp
            //总经济
            item.coin = k.brief.total_coin
            //阵容价值
            item.lineup_coin = k.brief.lineup_coin
            //前台角色
            item.front_roles = k.lineup.front_roles
            //后台的角色
            item.back_roles = k.lineup.back_roles
            //羁绊
            item.trait_list = k.lineup.trait_list
            //投资环境
            item.portal_list = k.lineup.portal_list
            //投资策略
            item.augment_list = k.lineup.augment_list
            //伤害统计
            item.damage_list = k.lineup.damage_list
            //合并前台后台角色id 和 羁绊id
            const id_list = [...item.front_roles, ...item.back_roles, ...item.trait_list]
            if (item.damage_list.length > 0) {
                item.sh_list = []
                let n = 0
                for (const v of item.damage_list) {
                    for (const i of id_list) {
                        if (v.id == i.role_id || v.id == i.trait_id) {
                            i.sh = (Math.ceil(Number(v.damage)) / 10000).toFixed(2) + '万'
                            item.sh_list.push(i)
                            n++
                            break
                        }
                    }
                    if (n == 5) break //只显示5个
                }
                //以第一个伤害为100%计算后面的伤害比例
                for (let i = 0; i < 5; i++) {
                    if (item.damage_list[i]) item.sh_list[i].sh_l = (Number(item.damage_list[i].damage) / Number(item.damage_list[0].damage) * 100).toFixed(2) + '%'
                }
            }
            list.push(item)
        }

        if(!list.length) e.reply(`UID:${uid},未找到货币战争记录`)

        let num = config().huobi_num
        if (!num || num < 1 || num > 3) num = 2


        const data_ = {
            uid,
            qq,
            season_level,
            face,
            level,
            name,
            weekly_score_cur,
            weekly_score_max,
            list,
            config_num: num
        }

        render('huobi/huobi', data_, { e, ret: true })
    }




}