import {
    sleep,
    makeForwardMsg,
    recallMsg,
    getSource
} from '#xhh';
export class picture extends plugin {
    constructor(e) {
        super({
            name: '[小花火]图片处理',
            dsc: '',
            event: 'message',
            priority: 1234,
            rule: [{
                reg: '^#?(过期|链接|大小)$',
                fnc: 'lj',
            }, ],
        });
    }

    async lj(e, gq = false) {
        let imageMessages = [];
        let source = await getSource(e)
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
            return false
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