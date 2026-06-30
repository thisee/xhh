import { config } from '#xhh';
import { bot } from '../../trss.yunzai/src/bot/Bot';

const ABYSS_CRON = '0 0 4 * * *'; // 每天 4 点检查深渊
const BATTLEFIELD_CRON = '0 0 4 * * *'; // 每天 4 点检查战场
const GODWAR_CRON = '0 0 4 * * *'; // 每天 4 点检查乐土

let notified = new Set();

export class bh3_remind extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三定时提醒',
      dsc: '深渊/战场/乐土 开启/结算定时提醒',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3).*?(提醒|定时提醒|开关提醒).*?(开启|关闭|on|off).*$', fnc: 'toggleRemind' },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3).*?提醒状态$', fnc: 'remindStatus' },
      ],
    });
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
      if (!subscribers.includes(userId)) {
        subscribers.push(userId);
        await this.saveSubscribers(subscribers);
        return e.reply('已开启崩三定时提醒');
      }
      return e.reply('已开启');
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

  // 深渊/战场/乐土数据检查并推送
  async checkAndPush() {
    if (!config().bh3_remind) return;
    const subscribers = await this.getSubscribers();
    if (!subscribers.length) return;

    // 这里可以调用 bh3_note/bh3_battlefield/bh3_godwar 的数据获取逻辑
    // 简化版：仅在每天 4 点检查并推送
    // 实际实现需根据 note 数据中的 schedule_end 判断是否即将开启/结算
    // 这里仅提供框架，具体推送逻辑可后续完善
  }
}

// 定时任务注册
if (globalThis.cron) {
  globalThis.cron.add('bh3_remind_abyss', ABYSS_CRON, async () => {
    if (!config().bh3_remind) return;
    // 检查深渊
  });
  globalThis.cron.add('bh3_remind_battlefield', BATTLEFIELD_CRON, async () => {
    if (!config().bh3_remind) return;
    // 检查战场
  });
  globalThis.cron.add('bh3_remind_godwar', GODWAR_CRON, async () => {
    if (!config().bh3_remind) return;
    // 检查乐土
  });
}

export default bh3_remind;