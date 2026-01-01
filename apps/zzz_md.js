import { api, mhy, render } from '#xhh';
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
                if (message.type == 'at' && message.qq != Number(Bot.uin)) e.user_id = message.qq
            }
        }

        if (qq) {
            uid = (await NoteUser.create(qq)).getUid('zzz');
            ck = (await NoteUser.create(qq)).getMysUser('zzz').ck
        } else {
            uid = e.user.getUid('zzz');
            const mys = e.user.getMysUser('zzz');
            ck = mys.ck;
        }

        if (!uid || !ck) return e.reply('请先扫码绑定账号！');
        
        qq = e.user_id

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

        if (!data.tickets) return logger.mark(`UID${uid},未找到母带数据`)

        let fldp = 0, fl = 0, jmmd = 0, md = 0, bb = 0, level = '未知', name = '未知'
        let sk = await mhy.getstoken(e, uid);
        if (sk) {
            headers = mhy.getHeaders(e, sk);
            res = await api(e, {
                type: 'GameRoles',
                headers
            })
            if (res.data?.list) {
                res.data.list.forEach(v => {
                    if (v.game_uid == uid) {
                        level = v.level
                        name = v.nickname
                    }
                });
            }
        }
        for (let v of data.tickets) {
            if (v.ticket_type == 'GACHA_TICKET_TYPE_RECHARGE_MONOCHROME') fldp = v.ticket_cnt
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_POLYCHROME') fl = v.ticket_cnt
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_ENCRYPTED_MASTER_TAPE') jmmd = v.ticket_cnt
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_MASTER_TAPE') md = v.ticket_cnt
            else if (v.ticket_type == 'GACHA_TICKET_TYPE_BOOPON') bb = v.ticket_cnt
        }

        render('zzz_md/md', {
            fldp, fl, jmmd, md, bb, uid, qq, name, level
        }, { e, ret: true })

        return true
    }





}