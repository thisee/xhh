import { config, yaml, pluginPriority } from '#xhh';

logger.info('[bh3_remind] 文件已加载');

const _path = './plugins/xhh/config/';

function getRemindConfig() {
  return yaml.get(_path + 'bh3_remind.yaml') || { enable: true, groups: [], items: [] };
}

export class bh3_remind extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三定时提醒',
      dsc: '深渊/战场/乐土 开启/结算定时提醒',
      event: 'message',
      priority: pluginPriority('bh3_remind', 100),
      rule: [
        { reg: '^#.*', fnc: 'testMatch', priority: pluginPriority('bh3_remind', -1000001) },
        { reg: '^#*(小花火)?(?=.*(崩三|崩坏3|崩坏三|BH3))(?=.*(提醒|定时提醒|开关提醒))(?=.*(开启|关闭|on|off)).*$', fnc: 'toggleRemind', priority: pluginPriority('bh3_remind', -1000001) },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3).*?提醒状态$', fnc: 'remindStatus', priority: pluginPriority('bh3_remind', -1000001) },
      ],
    });
  }

  async testMatch(e) {
    logger.info('[bh3_remind] testMatch triggered, msg: ' + e.msg);
    return false;
  }

  async getSubscribers() {
    const list = await redis.get('xhh:bh3_remind:subscribers');
    return list ? JSON.parse(list) : [];
  }

  async saveSubscribers(list) {
    await redis.set('xhh:bh3_remind:subscribers', JSON.stringify(list));
  }

  async toggleRemind(e) {
    if (!e.isMaster) return e.reply('仅主人可操作');
    const action = e.msg.includes('开启') || e.msg.includes('on');
    const subscribers = await this.getSubscribers();
    const userId = e.user_id;
    if (action) {
      if (subscribers.includes(userId)) {
        return e.reply('已开启');
      }
      subscribers.push(userId);
      await this.saveSubscribers(subscribers);
      return e.reply('已开启崩三定时提醒');
    } else {
      const idx = subscribers.indexOf(userId);
      if (idx > -1) {
        subscribers.splice(idx, 1);
        await this.saveSubscribers(subscribers);
        return e.reply('已关闭崩三定时提醒');
      }
      return e.reply('未开启');
    }
  }

  async remindStatus(e) {
    const subscribers = await this.getSubscribers();
    const isSub = subscribers.includes(e.user_id);
    return e.reply(`崩三定时提醒: ${isSub ? '已开启' : '未开启'}\n订阅人数: ${subscribers.length}`);
  }

  // 解析 cron 表达式，返回下次触发时间（毫秒时间戳）
  parseCron(cronStr) {
    const [min, hour, day, month, week] = cronStr.split(' ');
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(parseInt(min));
    next.setHours(parseInt(hour));
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    // 简单处理：只支持每天固定时间的 cron
    return next.getTime();
  }

  // 检查是否需要发送提醒
  async checkAndPush() {
    const cfg = getRemindConfig();
    if (!cfg.enable) return;
    
    const subscribers = await this.getSubscribers();
    if (!subscribers.length) return;

    const groups = cfg.groups || [];
    if (!groups.length) return;

    const items = cfg.items || [];
    const now = Date.now();

    for (const item of items) {
      if (!item.cron) continue;
      
      try {
        const nextTrigger = this.parseCron(item.cron);
        const diff = nextTrigger - Date.now();
        
        // 如果在未来 5 分钟内触发，发送提醒
        if (diff > 0 && diff < 5 * 60 * 1000) {
          const notifiedKey = `bh3_remind_${item.key}_${Math.floor(Date.now() / (60 * 1000))}`;
          const alreadyNotified = await redis.get(notifiedKey);
          if (alreadyNotified) continue;
          
          // 发送提醒
          for (const groupId of cfg.groups) {
            try {
              await bot.sendGroupMsg(groupId, item.msg, true);
            } catch (err) {
              logger.warn(`[bh3_remind] 发送到群 ${groupId} 失败: ${err.message}`);
            }
          }
          await redis.set(notifiedKey, '1', 60); // 1分钟去重
        }
      } catch (err) {
        logger.error(`[bh3_remind] 检查提醒 ${item.key} 失败: ${err.message}`);
      }
    }
  }
}

// 每分钟检查一次
if (globalThis.cron) {
  globalThis.cron.add('bh3_remind_check', '* * * * *', async () => {
    try {
      const reminder = new bh3_remind({});
      await reminder.checkAndPush();
    } catch (err) {
      logger.error('[bh3_remind] 定时检查失败:', err);
    }
  });
}

export default bh3_remind;