import {
  mhy,
  yaml,
  QR,
  sleep,
  reply_recallMsg,
  recallMsg,
  makeForwardMsg,
  api,
  config,
} from '#xhh';
import YAML from 'yaml';
import fs from 'fs';
import moment from 'moment';

export class user extends plugin {
  constructor(e) {
    super({
      name: '[小花火]user',
      dsc: '',
      event: 'message',
      handler: [
        {
          key: 'mys.req.err_',
          fn: 'mysReqErrHandler_',
        },
      ],
      priority: -100,
      rule: [
        {
          reg: '^#?(删除|绑定)*设备(.*)$',
          fnc: 'fp',
        },
        {
          reg: '^#?扫码(登录|绑定|登陆)$',
          fnc: 'sm',
        },
        {
          reg: '^#?(绑定)?设备(绑定)?帮助$',
          fnc: 'help',
        },
        {
          reg: '^#?删除stoken$',
          fnc: 'del',
        },
        {
          reg: '^#?刷新(cookie|ck)$',
          fnc: 'refresh_ck',
        },
      ],
    });
  }

  fp(e) {
    if (Number(Bot.uin) != 263243846) return false;
    if (e.msg.includes('删除')) return this.Delete(e);
    let msg = e.msg.replace(/绑定|设备|#/g, '');
    let info;
    try {
      info = JSON.parse(msg);
    } catch (err) {
      return false;
    }
    if (e.isGroup) {
      // e.reply('请私聊绑定设备'
      recallMsg(e);
    }
    return mhy.shebei(e, info);
  }

  async help(e) {
    if (Number(Bot.uin) != 263243846) return false;
    const msg = [
      '[注意点]',
      '1.绑定设备主要是解决小花火查询米游社报的异常问题，小花火通过模拟你的常用设备访问米游社获取fp设备指纹参数，用于后续查询米游社时使用',
      '2.如果你不信任小花火，请不要使用此功能\n',
      '[绑定设备]',
      '方法一（仅适用于部分安卓设备）：',
      '1. 使用常用米游社手机下载下面链接的APK文件（复制到浏览器打开），并安装',
      'https://e-e.lanzouw.com/isfXD2f00v6f',
      '密码:xhh',
      '2. 打开app后点击按钮复制设备信息',
      '3. 给小花火发送：设备（+设备信息）',
      '--------------------------------',
      '方法二：',
      '1. 使用抓包软件抓取常用手机的米游社APP请求',
      '2. 在请求头内找到【x-rpc-device_id】和【x-rpc-device_fp】',
      '3. 自行构造如下格式的信息：',
      '   {"device_id": "x-rpc-device_id的内容", "device_fp": "x-rpc-device_fp的内容"}',
      '4. 给小花火发送：设备（+设备信息）',
      '--------------------------------',
      '[删除设备]',
      '发送[删除设备]即可',
    ].join('\n');
    e.reply(await makeForwardMsg(e, msg));
  }

  async sm(e) {
    if (!config().sm) return false;
    let CD = config().sm_cd || 0;
    let now_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
    const last_time = await redis.get(`xhh_sm:${e.user_id}_CD`);
    if (last_time && !e.isMaster) {
      const seconds = moment(now_time).diff(moment(last_time), 'seconds');
      e.reply(
        '扫码登录CD中，请不要重复触发！剩余时间：' + (CD - seconds) + '秒',
        true
      );
      return true;
    }

    let url = 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch'; //获取二维码
    const app_id = 2;
    /**
    1 《崩坏3》
    2 《未定事件簿》
    4 《原神》
    7 《崩坏学园2》
    8 《崩坏：星穹铁道》
    12 《绝区零》
     * 
     */

    let headers = mhy.getHeaders(e);

    let body = {
      app_id: app_id,
      device: headers['x-rpc-device_id'],
    };
    let res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).then(res => res.json());

    const sm_url = res.data.url;

    let img = segment.image(
      (await QR.toDataURL(sm_url)).replace(
        'data:image/png;base64,',
        'base64://'
      )
    );

    const re = await reply_recallMsg(
      e,
      [
        '请在60秒内使用手机米游社扫码登录',
        img,
        '调用[未定事件铺]接口,获取米游社game_token,谁触发谁扫码,请不要帮别人绑定自己的米游社！！！',
      ],
      60,
      true
    );

    await sleep(2000);

    url = 'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/query'; //查询二维码状态
    let ticket = sm_url.split('ticket=')[1];
    body['ticket'] = ticket;
    let zt;
    now_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
    await redis.set(`xhh_sm:${e.user_id}_CD`, now_time, { EX: CD }); //进入CD
    for (var n = 1; n < 150; n++) {
      await sleep(1000);
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }).then(res => res.json());
      if (res.retcode != 0) return e.reply('二维码已过期~', true);
      if (res.data.stat == 'Init') continue;
      if (res.data.stat == 'Scanned' && !zt) {
        zt = true;
        recallMsg(e, re.message_id);
        e.reply('二维码已被扫，请确认登录~', true);
      }
      if (res.data.stat == 'Confirmed') {
        const data = JSON.parse(res.data.payload.raw);
        //通过game_token获取SToken
        url =
          'https://passport-api.mihoyo.com/account/ma-cn-session/app/getTokenByGameToken';
        body = {
          account_id: Number(data.uid),
          game_token: data.token,
        };
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }).then(res => res.json());
        //SToken
        const SToken = res.data.token.token;
        //stuid
        const stuid = data.uid;
        //mid
        const mid = res.data.user_info.mid;
        //用SToken获取cookie
        const ck = `stuid=${stuid};stoken=${SToken};mid=${mid};`;
        headers.Cookie = ck;
        const { sendMsg, ltoken } = await mhy.refresh_cookies(
          e,
          headers,
          SToken,
          stuid
        );
        if (SToken && stuid && mid && ltoken) {
          res = await api(e, { type: 'GameRoles', headers: headers });
          let data_ = {};
          /*
          hk4e_cn国服原神
          hkrpg_cn国服星铁
          nap_cn国服绝区零
          */
          const game_list = ['hk4e_cn', 'hkrpg_cn', 'nap_cn'];
          res.data.list.map(v => {
            if (game_list.includes(v.game_biz)) {
              data_[v.game_uid] = {
                uid: v.game_uid,
                stuid: stuid,
                stoken: SToken,
                ck_stoken: `stuid=${stuid};stoken=${SToken};mid=${mid};`,
                mid: mid,
                ltoken: ltoken,
                region_name: v.region_name,
                region: v.region,
              };
            }
          });
          let yaml_url = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
          await this.process_files(yaml_url, data_);
          const yaml_path = './plugins/xiaoyao-cvs-plugin/data/yaml/';
          if (fs.existsSync(yaml_path)) {
            yaml_url = `${yaml_path}${e.user_id}.yaml`;
            for (let k in data_) {
              data_[k]['userId'] = Number(e.user_id);
              data_[k]['is_sign'] = true;
            }
            await this.process_files(yaml_url, data_);
          }
        }
        if (e.no_reply) e.reply = e.no_reply;
        e.reply(await makeForwardMsg(e, sendMsg));
        break;
      }
    }
    return true;
  }

  //删除设备
  Delete(e) {
    const path = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
    if (!fs.existsSync(path)) return e.reply('你没有绑定过设备', true);
    fs.unlinkSync(path);
    e.reply('删除成功!', true);
    return true;
  }

  //删除stoken
  del(e) {
    const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    const path2 = `./plugins/xiaoyao-cvs-plugin/data/yaml/${e.user_id}.yaml`;
    if (!fs.existsSync(path) && !fs.existsSync(path2)) {
      return e.reply('你没有绑定过stoken', true);
    }
    if (fs.existsSync(path2)) fs.unlinkSync(path2);
    if (fs.existsSync(path)) fs.unlinkSync(path);
    e.reply('删除成功!', true);
    return true;
  }

  //刷新ck
  async refresh_ck(e) {
    let msgs = [],kg;
    let data_ = await mhy.getSToken(e);
    if (!data_) return e.reply(`未绑定米游社，请发送[扫码绑定]`, true);
    const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    let data;
    if (!Array.isArray(data_)) data = yaml.get(path);
    else ((data = data_[1]), (data_ = data_[0]));
    for (let k in data_) {
      const [SToken, ck] = data_[k];
      const headers = mhy.getHeaders(e, ck);
      const { sendMsg, ltoken } = await mhy.refresh_cookies(
        e,
        headers,
        SToken,
        k
      );
      if (ltoken && data) {
        for (let m in data) {
          if (data[m].stoken == SToken) {
            data[m].ltoken = ltoken;
            kg = 1;
          }
        }
      }
      msgs.push(...sendMsg);
    }
    if (kg) fs.writeFileSync(path, YAML.stringify(data), 'utf-8');
    if (e.no_reply) e.reply = e.no_reply;
    msgs.map((v,i)=>{
      if(typeof msgs[i] === 'string') msgs[i] = msgs[i].replace(/绑定Cookie/g, '刷新Cookie');
    })
    e.reply(await makeForwardMsg(e, msgs));
  }

  async process_files(yaml_url, data_) {
    if (!fs.existsSync(yaml_url)) {
      fs.writeFileSync(yaml_url, YAML.stringify(data_), 'utf-8');
    } else {
      const _data_ = await yaml.get(yaml_url);
      for (let k in data_) {
        if (_data_[k]?.hasOwnProperty('is_sign'))
          data_[k]['is_sign'] = _data_[k].is_sign;
        _data_[k] = data_[k];
      }
      fs.writeFileSync(yaml_url, YAML.stringify(_data_), 'utf-8');
    }
  }

  async mysReqErrHandler_(e, args, reject) {
    if (Number(Bot.uin) != 263243846) return false;
    let { data, mysApi, type } = args;
    if (
      ![1034, 5003, 10035, 10041, 10104].includes(Number(args?.res?.retcode))
    ) {
      return reject();
    }
    const yaml_url = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
    if (!fs.existsSync(yaml_url)) return reject();
    let data_ = fs.readFileSync(yaml_url, 'utf-8');
    data_ = YAML.parse(data_);
    let fp;
    if (data_.fp) fp = data_.fp;
    if (!fp) return reject();
    try {
      if (data?.headers) {
        data.headers = {
          ...data.headers,
          'x-rpc-device_fp': fp,
        };
      } else {
        if (!data) data = {};
        data.headers = { 'x-rpc-device_fp': fp };
      }
      let res = await mysApi.getData(type, data);
      if (![1034, 5003, 10035, 10041, 10104].includes(Number(res?.retcode))) {
        return res;
      }
      return reject();
    } catch (err) {
      logger.info(err);
    }
    return reject();
  }
}
