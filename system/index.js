import mys from './mys.js';
import render from './render.js';
import splitImage from './process_images.js';
import yaml from './yaml.js';
import yyjson from './yyjson.js';
import bili from './bili.js';
import mhy from './mhy.js';
import QR from 'qrcode';
import api from './api.js';
import {
    MysSign,
    zd_MysSign,
    BbsSign,
} from './sign.js';

let isTrss = true

try {
    const module = await import('../../miao-plugin/components/index.js');
    isTrss = module.Version.name === 'TRSS-Yunzai';
} catch (err) {

}

//撤回消息
const recallMsg = (e, id) => {
    e.isGroup ? e.group.recallMsg(id || e.message_id) : e.friend.recallMsg(id || e.message_id);
};

//延时撤回
const reply_recallMsg = async (e, message, time, is_quote_reply = false) => {
    let rclFailRpl = await e.reply(message, is_quote_reply);
    setTimeout(() => {
        recallMsg(e, rclFailRpl.message_id);
    }, time * 1000);
    return rclFailRpl;
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function isForwardCompatMode() {
    try {
        return !!config().hbxx;
    } catch (_) {
        return false;
    }
}

function forwardPlainText(message) {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.map(forwardPlainText).filter(Boolean).join('\n');
    if (typeof message === 'object') {
        if (message.type === 'text') return message.text || message.data?.text || '';
        if (message.type === 'image') return '[图片]';
        if (message.type === 'node') return forwardPlainText(message.data?.content || message.data?.message || '');
        return message.data?.text || message.text || '';
    }
    return String(message || '');
}

function normalizeForwardMessage(message) {
    if (!isForwardCompatMode()) return message;
    // 兼容模式：去掉合并转发里的嵌套node，避免部分OneBot/NapCat适配器报“合并消息内嵌合并消息”。
    if (Array.isArray(message)) {
        const arr = message
            .filter(v => v?.type !== 'node')
            .map(v => normalizeForwardMessage(v))
            .filter(Boolean);
        return arr.length ? arr : forwardPlainText(message);
    }
    if (message?.type === 'node') return forwardPlainText(message);
    return message;
}

//合并转发消息
async function makeForwardMsg(e, msg = [], dec = '', Id = '', isGroup = true) {
    let name = Bot.nickname;
    let id = Number(Bot.uin);
    if (typeof msg == 'string') msg = [msg];
    if (e?.isGroup) {
        try {
            let info = await e.bot.getGroupMemberInfo(e.group_id, id);
            name = info.card || info.nickname;
        } catch (err) {}
    }
    let userInfo = {
        user_id: id,
        nickname: name,
    };
    let forwardMsg = [];
    for (const message of msg) {
        if (!message) {
            continue;
        }
        const safeMessage = normalizeForwardMessage(message);
        if (!safeMessage) continue;
        forwardMsg.push({
            ...userInfo,
            message: safeMessage,
        });
    }
    let msg_ = false;

    if (!msg_ || !msg_.data) {
        try {
            if (e?.group?.makeForwardMsg) {
                msg_ = await e.group.makeForwardMsg(forwardMsg);
            } else if (e?.friend?.makeForwardMsg) {
                msg_ = await e.friend.makeForwardMsg(forwardMsg);
            } else if (Id) {
                try {
                    //兼容napcat-adapter，解决napcat-adapter的Bot.makeForwardMsg发不出去的bug
                    msg_ = isGroup ? await Bot.pickGroup(Id).makeForwardMsg(forwardMsg) : await Bot.pickFriend(Id).makeForwardMsg(forwardMsg);
                } catch (err) {
                    msg_ = await Bot.makeForwardMsg(forwardMsg);
                }
            } else {
                return msg.map(forwardPlainText).filter(Boolean).join('\n');
            }
        } catch (err) {
            if (isForwardCompatMode()) {
                logger.warn?.('[xhh] 合并转发生成失败，已按hbxx兼容模式改为纯文本:', err?.message || err);
                return msg.map(forwardPlainText).filter(Boolean).join('\n');
            }
            throw err;
        }
    }

    if (dec && msg_.data) {
        if (msg_.data.meta?.detail) {
            msg_.data.meta.detail.news = [{
                text: dec
            }];
        } else {
            if (Array.isArray(msg_.data)) msg_.data.unshift({
                ...userInfo,
                message: dec
            });
        }
    }
    return msg_;
}

//制作消息命令
function makeMessage(e, msg) {
    Bot.em('message.private.friend', {
        self_id: e.self_id,
        message_id: e.message_id,
        user_id: e.user_id,
        sender: e.sender,
        friend: e.friend,
        reply: e.reply.bind(e),
        post_type: 'message',
        message_type: 'private',
        sub_type: 'friend',
        message: [{
            type: 'text',
            text: msg
        }],
        raw_message: msg,
    });
}

//获取配置
const config = () => {
    return yaml.get('./plugins/xhh/config/config.yaml');
};

const pluginPriority = (name, defaultVal) => {
    const cfg = config();
    const key = name + '_priority';
    return cfg[key] ?? defaultVal;
};


async function getSource(e) {
    //引用回复
    if (!e.source && !e.getReply) return false;

    let source = {};
    
    if (e.source) {
        if (e.source.message_id) {
            try {
                source = await Bot.getMsg(e.source.message_id);
            } catch (error) {
                try {
                    source = await e.bot.getMsg(e.source.message_id);
                } catch (_) {
                    return false;
                }
            }
        } else {
            source = e.isGroup ? (await e.group.getChatHistory(e.source?.seq, 1)).pop() : (await e.friend.getChatHistory((e.source?.time + 1), 1)).pop();
        }
    } else {
        source = await e.getReply(); //无e.source的情况
    }
    
    return source
}



export {
    mys,
    render,
    splitImage,
    yaml,
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
    pluginPriority,
    getSource,
    MysSign,
    zd_MysSign,
    BbsSign,
};