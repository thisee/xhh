import mys from './mys.js'
import render from './render.js'
import yaml from './yaml.js'
import uploadRecord from './uploadRecord.js'
import yyjson from './yyjson.js'
import bili from './bili.js'
import mhy from './mhy.js'
import QR from "qrcode"
import api from './api.js'
import { MysSign,zd_MysSign} from './sign.js'
import { Version } from '../../miao-plugin/components/index.js'

const isTrss = Version.name == 'TRSS-Yunzai' ? true : false
//撤回消息
const recallMsg = (e, id) => {
    e.isGroup ? e.group.recallMsg(id || e.message_id) : e.friend.recallMsg(id || e.message_id)
}
//延时撤回
const reply_recallMsg = async (e, message, time, is_quote_reply = false) => {
    let rclFailRpl = await e.reply(message, is_quote_reply)
    setTimeout(() => {
        recallMsg(e, rclFailRpl.message_id)
    }, time * 1000)
    return rclFailRpl
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

//合并转发消息
async function makeForwardMsg(e, msg = [], dec = '') {
    let name = Bot.nickname
    let id = Bot.uin
    if(typeof msg=='string') msg=[msg]
    if (e?.isGroup) {
        try {
            let info = await e.bot.getGroupMemberInfo(e.group_id, id)
            name = info.card || info.nickname
        } catch (err) { }
    }
    let userInfo = {
        user_id: id,
        nickname: name,
    }
    let forwardMsg = []
    for (const message of msg) {
        if (!message) {
            continue
        }
        forwardMsg.push({
            ...userInfo,
            message: message,
        })
    }
    let msg_=await Bot.makeForwardMsg(forwardMsg)
    
    if(!msg_){
    if (e?.group?.makeForwardMsg) {
      msg_= await e.group.makeForwardMsg(forwardMsg)
    } else if (e?.friend?.makeForwardMsg) {
      msg_ = await e.friend.makeForwardMsg(forwardMsg)
    } else {
      return msg.join("\n")
    }
    }
    
    if (dec&&msg_.data) {
        if (!isTrss) msg_.data.meta?.detail?.news=[{'text':dec}]
        else msg_.data.unshift({...userInfo,message: dec})
    }
    return msg_
}

//制作消息命令
 function makeMessage(e,msg) {
    Bot.em("message.private.friend", {
      self_id: e.self_id,
      message_id: e.message_id,
      user_id: e.user_id,
      sender: e.sender,
      friend: e.friend,
      reply: e.reply.bind(e),
      post_type: "message",
      message_type: "private",
      sub_type: "friend",
      message: [{ type: "text", text: msg }],
      raw_message: msg,
    })
  }

//获取配置
const config = () => {
    return  yaml.get('./plugins/xhh/config/config.yaml')
}


export {
    mys,
    render,
    yaml,
    uploadRecord,
    yyjson,
    QR,
    bili,
    api,
    mhy,
    isTrss,
    recallMsg,
    reply_recallMsg,
    sleep,
    makeForwardMsg,
    makeMessage,
    config,
    MysSign,
    zd_MysSign
}
