import { mhy } from '#xhh';
async function api(e, data = {}) {
  let signActId = {
    gs: 'e202311201442471',
    sr: 'e202304121516551',
    zzz: 'e202406242138391',
  };
  const game = data.game;
  const uid = data.uid;
  const server = data.server || mhy.getServer(uid, game);
  
  const api_list = {
    //账号游戏信息
    GameRoles: {
      url: 'https://api-takumi.miyoushe.com/binding/api/getUserGameRolesByStoken',
      obj: {
        method: 'GET',
      },
    },
    createVerification: {
      url: `https://bbs-api.miyoushe.com/misc/wapi/createVerification?gids=2&is_high=false'`,
      obj: {
        method: 'GET',
      },
    },
    verifyVerification: {
      url: `https://bbs-api.miyoushe.com/misc/wapi/verifyVerfication`,
      obj: {
        method: 'POST',
        body: JSON.stringify(data.body),
      },
    },
    sign_info: {
      url: `https://api-takumi.mihoyo.com/event/luna/info?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
      obj: {
        method: 'GET',
      },
    },
    sign_home: {
      url: `https://api-takumi.mihoyo.com/event/luna/home?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
      obj: {
        method: 'GET',
      },
    },
    sign: {
      url: 'https://api-takumi.mihoyo.com/event/luna/sign',
      obj: {
        method: 'POST',
        body: JSON.stringify({
          act_id: signActId[game],
          region: server,
          uid: uid,
          lang: 'zh-cn',
        }),
      },
    },
    //货币战争
    huobi: {
      url: `https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/grid_fight?server=${server}&role_id=${uid}`,
      obj: {
        method: 'GET',
      }
    }
  };

  const { url, obj } = api_list[data.type];

  obj.headers = data.headers;

  let res

  try {
    res = await fetch(url, obj).then(res => res.json());
  } catch (error) {
    logger.error(error);
  }
  const sign = data.type.includes('sign');
  const _err = sign
    ? api_err(e, res, false, data.type)
    : api_err(e, res, data.uid, data.type);
  if (_err) {
    // if(res.retcode==1034||res.retcode==10035)
    if (sign) return _err;
    return false;
  }
  return res;
}

function api_err(e, res, uid, type) {
  if (res.retcode == 0) return false;
  let msg;
  switch (res.retcode) {
    case -1:
    case -100:
    case 1001:
    case 10001:
    case 10103:
      msg = `${uid ? 'UID:' + uid : ''}米游社查询失败，无法查询`;
      if (/(登录|login)/i.test(res.message)) {
        msg = `${uid ? 'UID:' + uid : ''}Cookie失效，请[刷新ck]或[扫码绑定]`;
      }
      break;
    case -10002:
      msg = `${uid ? 'UID:' + uid : ''}${res.message}`;
      break;
    case 10102:
    case 5003:
    case 10041:
      msg = `${uid ? 'UID:' + uid : ''}米游社账号异常,无法查询！`;
      break;
    case 1034:
    case 10035:
      // if(type.includes('sign')) res.data.gt res.data.challenge
      msg = `${uid ? 'UID:' + uid : ''}米游社查询遇到验证码,暂时无法查询！`;
      break;
    default:
      msg = '米游社接口异常...';
      logger.error(res);
      break;
  }
  //    if([1034,10035].includes(res.retcode))
  if (type.includes('sign')) {
    if (res.first_bind) return '签到失败：首次请先手动签到';
    return msg;
  }
  e.reply(msg);
  return true;
}

export default api;
