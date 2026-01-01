// import { yaml, render } from '#xhh';
import { api, mhy } from '#xhh';
import NoteUser from '../../genshin/model/mys/NoteUser.js';

export class zzz extends plugin {
    constructor(e) {
        super({
            name: '[小花火]绝区零母带',
            dsc: '绝区零母带查询',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: '^#*(绝区零)?(母带|(绝区零|zzz)(存货|存量|囤货))$',
                    fnc: 'md',
                },
            ],
        });
    }

    async md(e) {
        let qq, uid, ck

        if (e.message.length > 1) {
            for (const message of e.message) {
                if (message.type == 'at' && message.qq != Number(Bot.uin)) qq = message.qq
            }
        }

        if (qq) {
            uid = (await NoteUser.create(qq)).getUid('zzz');
            ck = (await NoteUser.create(qq)).getMysUser('zzz').ck
        } else {
            uid = e.user.getUid('zzz');
            const mys = e.user.getMysUser('zzz');
            ck = mys.ck;
            qq = e.user_id
        }

        if (!uid || !ck) return e.reply('请先扫码绑定账号！');

        //用于匹配用户设备信息
        e.user_id = qq

        //获取headers
        let headers = mhy.getHeaders(e, ck);

        let data = {
            uid,
            headers,
            game: 'zzz',
            type: 'zzz_md',
        };

        let res = await api(e, data);

        data = res.data

        if (!data) return logger.mark(`UID${uid},未找到母带数据`)

        let msg = [
            '绝区零UID：' + uid,
        ]

        for (let v of data.tickets) {
            if (v.ticket_type == 'GACHA_TICKET_TYPE_RECHARGE_MONOCHROME') msg.push(`菲林底片（充值）：${v.ticket_cnt}`)
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_POLYCHROME') msg.push(`菲林：${v.ticket_cnt}`)
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_ENCRYPTED_MASTER_TAPE') msg.push(`加密母带：${v.ticket_cnt}`)
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_MASTER_TAPE') msg.push(`原装母带（常驻）：${v.ticket_cnt}`)
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_BOOPON') msg.push(`邦布券：${v.ticket_cnt}`)
        }

        if (msg.length == 1) return e.reply('暂无数据！', true)
        return e.reply(msg.join('\n'))

















    }





}