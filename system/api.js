
async function api(e,data={}){
        let signActId = { gs: 'e202311201442471', sr: 'e202304121516551', zzz: "e202406242138391" }
        const game = data.game
        const uid = data.uid
        const server = getServer(uid,game)
const api_list={
    //账号游戏信息
    GameRoles:{
        url:'https://api-takumi.miyoushe.com/binding/api/getUserGameRolesByStoken',
        obj:{
            method:'GET',
            headers:data.headers
        }},
      createVerification: {
        url: `https://bbs-api.miyoushe.com/misc/wapi/createVerification?gids=2&is_high=false'`,
        obj:{
            method:'GET',
            headers:data.headers
        }
      },
      verifyVerification: {
        url: `https://bbs-api.miyoushe.com/misc/wapi/verifyVerfication`,
        obj:{
            method:'POST',
            headers:data.headers,
            body:JSON.stringify(data.body)
        }
      },
      sign_info: {
        url: `https://api-takumi.mihoyo.com/event/luna/info?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
        obj:{
            method:'GET',
            headers:data.headers
        }
      },
      sign_home: {
        url: `https://api-takumi.mihoyo.com/event/luna/home?act_id=${signActId[game]}&region=${server}&uid=${uid}&lang=zh-cn`,
        obj:{
            method:'GET',
            headers:data.headers
        }
      },
      sign: {
        url: 'https://api-takumi.mihoyo.com/event/luna/sign',
        obj:{
            method:'POST',
            headers:data.headers,
            body:JSON.stringify({ act_id: signActId[game], region: server, uid: uid, lang: 'zh-cn' })
        }
      }
    }

const {url,obj}=api_list[data.type]

let res=false
try {
    res=await fetch(url,obj).then(res=>res.json())
} catch (error) {
    logger.error(error)
}
const sign = data.type.includes('sign')
const _err= sign ? api_err(e,res,false,data.type) : api_err(e,res,data.uid,data.type)
if(_err) {
  // if(res.retcode==1034||res.retcode==10035)
  if(sign) return _err
  return false
}
return res
}

function api_err(e,res,uid,type){
 if(res.retcode==0) return false
 let msg
    switch (res.retcode) {
        case -1:
        case -100:
        case 1001:
        case 10001:
        case 10103:
          msg=`${uid ? 'UID:'+uid : ''}米游社查询失败，无法查询`
        if(/(登录|login)/i.test(res.message)){
         msg=`${uid ? 'UID:'+uid : ''}Cookie失效，请[刷新ck]或[扫码绑定]`
        }    
        break;
        case -10002:
           msg=`${uid ? 'UID:'+uid : ''}${res.message}`
           break
        case 10102:
        case 5003:
        case 10041:
          msg=`${uid ? 'UID:'+uid : ''}米游社账号异常,无法查询！`
          break
        case 1034:
        case 10035:
          // if(type.includes('sign')) res.data.gt res.data.challenge
          msg=`${uid ? 'UID:'+uid : ''}米游社查询遇到验证码,暂时无法查询！`
          break
        default:
          msg='米游社接口异常...'
          logger.error(res)
        break
    }
//    if([1034,10035].includes(res.retcode))
  if(type.includes('sign')) {
    if(res.first_bind) return '签到失败：首次请先手动签到'
    return msg
  }
   e.reply(msg)
   return true
}

function getServer(uid,game){
    if (game === 'zzz') {
      return 'prod_gf_cn'
    }
    const isSr = game==='sr'
    switch (String(uid)[0]) {
      case '1':
      case '2':
      case '3':
        return isSr ? 'prod_gf_cn' : 'cn_gf01' // 官服
      case '5':
        return isSr ? 'prod_qd_cn' : 'cn_qd01' // B服
    }
    return 'prod_gf_cn'
}

export default api