import fs from 'fs'
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
                    reg: '#货币战争$',
                    fnc: 'hb',
                }
            ]
        })
    }

    async hb(e) {
        //没精力写，先放着框架
        if (e.user_id != 1213763661) return false

        //获取uid
        const uid = e.user.getUid('sr');

        //获取ck
        const mys = e.user.getMysUser('sr');
        const ck = mys.ck;

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
        fs.writeFileSync('./plugins/example/cs/货币.json', JSON.stringify(res), 'utf-8')
        e.reply('ok')
    }




}