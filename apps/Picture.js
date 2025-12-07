import { sleep, makeForwardMsg, recallMsg } from '#xhh';
export class picture extends plugin {
  constructor(e) {
    super({
      name: '[小花火]图片处理',
      dsc: '',
      event: 'message',
      priority: 1234,
      rule: [
        {
          reg: '^#?(过期|链接|大小)$',
          fnc: 'lj',
        },
      ],
    });
  }

  async lj(e, gq = false) {
    let imageMessages = [];
    let source;
    if (!e.source && !e.getReply) return false;
    if (e.source) {
      if (e.source.message_id) {
        try {
          source = await Bot.getMsg(e.source.message_id);
        } catch (error) {
          source = await e.bot.getMsg(e.source.message_id);
        }
      } else {
        source = e.isGroup ? (await e.group.getChatHistory(e.source?.seq, 1)).pop() : (await e.friend.getChatHistory((e.source?.time + 1), 1)).pop();
      }
    } else {
      source = await e.getReply();  //无e.source的情况
    }
    if (source) {
      for (let val of source.message) {
        if (val.type === 'image') {
          imageMessages.push(val);
        }
      }
    } else {
      return false;
    }

    if (imageMessages.length <= 0) {
      e.reply('消息中未找到图片...');
      return true;
    }
    if (e.msg.includes('过期')) gq = true;
    let msg = [];
    if (gq) {
      for (let img of imageMessages) {
        msg.push(segment.image(img.url));
      }
      await e.reply(msg);
      await sleep(200);
      recallMsg(e, source.message_id);
      await sleep(200);
      recallMsg(e);
      return true;
    }
    for (let i in imageMessages) {
      let index = Number(i) + 1;
      if (imageMessages[i].file_size)
        imageMessages[i].size = imageMessages[i].file_size;
      msg.push([
        `图片[${index}]：\n${imageMessages[i].url}\n大小:${Math.ceil(imageMessages[i].size / 10000) / 100}MB\n`,
        segment.image(imageMessages[i].url),
      ]);
    }
    msg = await makeForwardMsg(e, msg, '图片链接');
    e.reply(msg);
    return;
  }
}
