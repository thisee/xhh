import fetch from 'node-fetch';
import md5 from 'md5';
import lodash from 'lodash';
import fs from 'fs';
import YAML from 'yaml';
import { yaml, api, config } from '#xhh';

class mhy {
  constructor() {
    this.fp_url = 'https://public-data-api.mihoyo.com/device-fp/api/getFp';
    this.mysSalt = 'rtvTthKxEyreVXQCnhluFgLXPOFKPHlA'; //k2 2.71.1
    this.mysSalt2 = 't0qEgfub6cvueAPgR5m9aQWWVciEer7v'; //6x
    this.mysSalt3 = 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs'; //4x
  }

  async shebei(e, info) {
    if (info?.device_fp && info?.device_id) return this.bd(e, yaml_url, info.device_id, info.device_fp);
    if (!info?.oaid) return logger.error('设备格式错误');
    let ck = this.getUser(e)?.ck;
    if (!ck) return e.reply('请先扫码绑定米游社后，在绑定设备');
    const { deviceName, deviceModel, oaid, deviceFingerprint, deviceBoard } = info;
    const device_ = deviceFingerprint.split('/')[0];
    if (!oaid || oaid.includes('error') || /^0+$/.test(oaid)) return e.reply('设备oaid获取失败，你的设备不支持获取');
    let body = {
      device_id: oaid,
      seed_id: this.randomString(16),
      seed_time: new Date().getTime() + '',
      platform: '2',
      device_fp: '38d7f0aac0ab7',
      app_name: 'bbs_cn',
      ext_fields: `{"cpuType":"arm64-v8a","romCapacity":"512","productName":"${deviceName}","romRemain":"459","manufacturer":"${device_}","appMemory":"512","hostname":"${device_}","screenSize":"1440x3022","osVersion":"13","aaid":"${this.getDeviceGuid()}","vendor":"中国电信","accelerometer":"0.061016977x0.8362915x9.826724","buildTags":"release-keys","model":"${deviceModel}","brand":"${device_}","oaid":"${oaid}","hardware":"qcom","deviceType":"${deviceName}","devId":"REL","serialNumber":"unknown","buildTime":"1690889245000","buildUser":"builder","ramCapacity":"229481","magnetometer":"80.64375x-14.1x77.90625","display":"${deviceModel} release-keys","ramRemain":"110308","deviceInfo":"${deviceFingerprint}","gyroscope":"7.9894776E-4x-1.3315796E-4x6.6578976E-4","vaid":"${this.getDeviceGuid()}","buildType":"user","sdkVersion":"33","board":"${deviceBoard}"}`,
      bbs_device_id: this.getDeviceGuid(),
    };

    let headers = this.getHeaders(e, ck, true, info);

    let res = await fetch(this.fp_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).then(res => res.json());
    let fp;
    if (res.data?.code == 200) {
      fp = res.data.device_fp;
      headers['x-rpc-device_fp'] = fp;
    } else {
      logger.error(res);
      return e.reply('设备绑定失败,未能获取到device_fp');
    }
    const device_id = headers['x-rpc-device_id'];
    const device_name = headers['x-rpc-device_name'];
    body = this.getbody_(device_id, device_name);
    const res1 = await fetch(
      'https://bbs-api.miyoushe.com/apihub/api/deviceLogin',
      { method: 'POST', headers, body: JSON.stringify(body) }
    ).then(res => res.json());
    const res2 = await fetch(
      'https://bbs-api.miyoushe.com/apihub/api/saveDevice',
      { method: 'POST', headers, body: JSON.stringify(body) }
    ).then(res => res.json());
    if (res1.retcode == 0 && res2.retcode == 0) {
      return this.bd(e, device_id, fp, info);
    } else {
      logger.error(res1, res2);
    }
    return;
  }

  //绑定设备参数保存到文件
  async bd(e, device_id, fp, info) {
    let a_ = {
      device_id: device_id,
      fp: fp,
      device_info: info || '',
    };
    const yaml_url = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
    fs.writeFileSync(yaml_url, YAML.stringify(a_), 'utf-8');
    let ltuid = this.getUser(e).ltuid;
    //作用ZZZ-plugin???
    await redis.set(`ZZZ:DEVICE_FP:${ltuid}:FP`, fp);
    await redis.set(`ZZZ:DEVICE_FP:${ltuid}:ID`, device_id);
    e.reply('常用设备信息绑定成功!');
  }

  getbody_(device_id, device_name) {
    return {
      app_version: '2.71.1',
      device_id: device_id,
      device_name: device_name,
      os_version: '29',
      platform: 'Android',
      registration_id: this.randomString(19),
    };
  }

  getUser(e) {
    const user =
      e.user.getMysUser() ||
      e.user.getMysUser('sr') ||
      e.user.getMysUser('zzz');
    return user;
  }

  getHeaders(e, ck, Ds_ = true, info) {
    let device_id, device_fp;
    if (!info) {
      const yaml_url = `./plugins/xhh/data/fp/${e.user_id}.yaml`;
      if (fs.existsSync(yaml_url)) {
        const data = YAML.parse(fs.readFileSync(yaml_url, 'utf-8'));
        device_id = data.device_id;
        device_fp = data.fp;
        info = data.device_info;
      }
    }
    return {
      Origin: 'https://app.mihoyo.com',
      'User-Agent': `Mozilla/5.0 (Linux; Android 13; ${info?.deviceModel || 'Mi 10'} Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.186 Mobile Safari/537.36 miHoYoBBS/2.71.1`,
      'Content-Type': 'application/json, text/plain, */*',
      Referer: 'https://app.mihoyo.com',
      'X-Requested-With': 'com.mihoyo.hyperion',
      'x-rpc-app_version': '2.71.1',
      'x-rpc-sys_version': '13',
      'x-rpc-client_type': '2',
      'x-rpc-device_id': device_id || this.getDeviceGuid(),
      'x-rpc-device_name': info
        ? info.deviceFingerprint.split('/')[0] + ' ' + info.deviceModel
        : this.randomString(lodash.random(1, 10)),
      'x-rpc-device_model': info?.deviceModel || 'Mi 10',
      'x-rpc-channel': 'miyousheluodi',
      'x-rpc-verify_key': 'bll8iq97cem8',
      'x-rpc-app_id': 'bll8iq97cem8',
      'x-rpc-device_fp': device_fp || '38d7f0aac0ab7',
      DS: Ds_ ? this.getDs() : this.getDs2(),
      Cookie: ck ?? '',
    };
  }

  //刷新ck
  async refresh_cookies(e, headers, SToken, id) {
    //用SToken获取cookie_token和ltoken(v1)
    let urls = [
      `https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoBySToken?stoken=${SToken}&uid=${id}`,
      'https://passport-api.mihoyo.com/account/auth/api/getLTokenBySToken',
    ];
    let res, Cookie, ltoken;
    for (let url of urls) {
      res = await fetch(url, { method: 'GET', headers }).then(res =>
        res.json()
      );
      if (res.data?.cookie_token) Cookie = res.data?.cookie_token;
      if (res.data?.ltoken) ltoken = res.data?.ltoken;
    }
    if (!e.no_reply) e.no_reply = e.reply;
    let sendMsg = [];
    e.reply = msg => {
      sendMsg.push(msg);
    };
    if (!Cookie || !ltoken) {
      sendMsg.push(`米游社UID:${id}刷新cookie失败,请重新[扫码绑定]`);
      return { sendMsg };
    }
    e.msg = `ltoken=${ltoken};ltuid=${id};cookie_token=${Cookie}`;
    let userck = (
      await import(`file://${process.cwd()}/plugins/genshin/model/user.js`)
    ).default;
    e.ck = e.msg;
    await new userck(e).bing();
    if (config().hbxx) sendMsg = [sendMsg[0]]
    return { sendMsg, ltoken };
  }

  //通过uid获取stoken
  async getstoken(e, uid) {
    const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    const path2 = `./plugins/xiaoyao-cvs-plugin/data/yaml/${e.user_id}.yaml`;
    let data;
    if (fs.existsSync(path)) {
      data = yaml.get(path)[uid];
      if (!data) return false;
      return data.ck_stoken;
    } else if (fs.existsSync(path2)) {
      data = yaml.get(path2)[uid];
      if (!data) return false;
      return `stuid=${data.stuid};stoken=${data.stoken};mid=${data.mid};`;
    }
    return false;
  }

  //stoken(刷新ck用)
  async getSToken(e) {
    const path = `./plugins/xhh/data/Stoken/${e.user_id}.yaml`;
    const path2 = `./plugins/xiaoyao-cvs-plugin/data/yaml/${e.user_id}.yaml`;
    let data,
      data_ = {};
    if (fs.existsSync(path)) {
      data = yaml.get(path);
      for (let k in data) {
        data_[data[k].stuid] = [data[k].stoken, data[k].ck_stoken];
      }
      return data_;
    }

    if (fs.existsSync(path2)) {
      let sj = {};
      data = yaml.get(path2);
      for (let k in data) {
        data_[data[k].stuid] = [
          data[k].stoken,
          `stuid=${data[k].stuid};stoken=${data[k].stoken};mid=${data[k].mid};`,
          data[k].mid,
          data[k].ltoken,
        ];
      }
      /*
          hk4e_cn国服原神
          hkrpg_cn国服星铁
          nap_cn国服绝区零
          */
      const game_list = ['hk4e_cn', 'hkrpg_cn', 'nap_cn'];
      for (const key in data_) {
        const headers = this.getHeaders(e, data_[key][1]);
        let res = await api(e, { type: 'GameRoles', headers: headers });
        res.data.list.map(v => {
          if (game_list.includes(v.game_biz)) {
            sj[v.game_uid] = {
              uid: v.game_uid,
              stuid: key,
              stoken: data_[key][0],
              ck_stoken: data_[key][1],
              mid: data_[key][2],
              ltoken: data_[key][3],
              region_name: v.region_name,
              region: v.region,
            };
          }
        });
        data_[key].splice(2); //删除多余数据
      }
      fs.writeFileSync(path, YAML.stringify(sj), 'utf-8');
      return [data_, sj];
    }
    return false;
  }

  getDeviceGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    return (
      S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4()
    );
  }
  getDs(salt = this.mysSalt) {
    const randomStr = this.randomString(6);
    const timestamp = Math.floor(Date.now() / 1000);
    let Ds = md5(`salt=${salt}&t=${timestamp}&r=${randomStr}`);
    return `${timestamp},${randomStr},${Ds}`;
  }

  getDs2(query = '', body = '', salt = this.mysSalt2) {
    if (salt == 4) salt = this.mysSalt3
    let t = Math.round(new Date().getTime() / 1000);
    let r = Math.floor(Math.random() * 900000 + 100000);
    let DS = md5(`salt=${salt}&t=${t}&r=${r}&b=${body}&q=${query}`);
    return `${t},${r},${DS}`;
  }

  /** 签到ds */
  getDsSign() {
    /** @Womsxd */
    const n = 'jEpJb9rRARU2rXDA9qYbZ3selxkuct9a';
    const t = Math.round(new Date().getTime() / 1000);
    const r = lodash
      .sampleSize('abcdefghijklmnopqrstuvwxyz0123456789', 6)
      .join('');
    const DS = md5(`salt=${n}&t=${t}&r=${r}`);
    return `${t},${r},${DS}`;
  }

  randomString(length, os = false) {
    let randomStr = '';
    for (let i = 0; i < length; i++) {
      randomStr += lodash.sample(
        os ? '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
          : 'abcdefghijklmnopqrstuvwxyz0123456789'
      );
    }
    return randomStr;
  }

  getServer(uid, game) {
    if (game === 'zzz') {
      return 'prod_gf_cn';
    }
    const isSr = game === 'sr';
    switch (String(uid)[0]) {
      case '1':
      case '2':
      case '3':
        return isSr ? 'prod_gf_cn' : 'cn_gf01'; // 官服
      case '5':
        return isSr ? 'prod_qd_cn' : 'cn_qd01'; // B服
    }
    return 'prod_gf_cn';
  }

}




export default new mhy();
