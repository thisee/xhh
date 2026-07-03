import { yaml, pluginPriority } from '#xhh';
import { getAnyCurrentAbyssText } from '../system/bh3_abyss_boss.js';

const _path = './plugins/xhh/config/';
const cfgFile = _path + 'bh3_remind.yaml';

function getRemindConfig() {
  return yaml.get(cfgFile) || { enable: false, groups: [], items: [] };
}

function normalizeGroups(groups = []) {
  return [...new Set((groups || []).map(v => String(v).trim()).filter(Boolean))];
}

function cronValues(field, min, max) {
  if (field === '*' || field == null) return null;
  const values = [];
  for (const part of String(field).split(',')) {
    if (/^\d+$/.test(part)) values.push(Number(part));
    else if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      for (let i = a; i <= b; i++) values.push(i);
    }
  }
  return values.filter(v => v >= min && v <= max);
}

function sameMinute(a, b) {
  return Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000);
}

function fmtTime(d) {
  if (!d) return '-';
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} 周${week} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export class bh3_remind extends plugin {
  constructor(e) {
    super({
      name: '[小花火]崩三定时提醒',
      dsc: '深渊/战场/乐土 开启/结算定时提醒',
      event: 'message',
      priority: pluginPriority('bh3_remind', 100),
      rule: [
        { reg: '^#*(小花火)?(?=.*(崩三|崩坏3|崩坏三|BH3))(?=.*(提醒|定时提醒|开关提醒))(?=.*(开启|关闭|on|off)).*$', fnc: 'toggleRemind', priority: pluginPriority('bh3_remind', -1000001) },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3).*?提醒状态$', fnc: 'remindStatus', priority: pluginPriority('bh3_remind', -1000001) },
        { reg: '^#*(小花火)?(崩三|崩坏3|崩坏三|BH3)?提醒测试$', fnc: 'remindTest', priority: pluginPriority('bh3_remind', -1000001) },
      ],
    });

    this.task = {
      cron: '0 * * * * *',
      name: '[小花火]崩三提醒检查',
      fnc: () => this.checkAndPush(),
      log: false,
    };
  }

  getDueTime(item, now = new Date()) {
    const parts = String(item.cron || '').trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minField, hourField, dayField, monthField, weekField] = parts;
    const mins = cronValues(minField, 0, 59);
    const hours = cronValues(hourField, 0, 23);
    const days = cronValues(dayField, 1, 31);
    const months = cronValues(monthField, 1, 12);
    const weeks = cronValues(weekField, 0, 7);
    if (!mins?.length || !hours?.length) return null;

    const advance = Number(item.advance_minutes || 0);
    for (let offset = -1; offset <= 7; offset++) {
      const base = new Date(now);
      base.setDate(now.getDate() + offset);
      base.setSeconds(0, 0);
      const cronWeek = base.getDay();
      const weekOk = !weeks || weeks.includes(cronWeek) || (cronWeek === 0 && weeks.includes(7));
      const dayOk = !days || days.includes(base.getDate());
      const monthOk = !months || months.includes(base.getMonth() + 1);
      if (!weekOk || !dayOk || !monthOk) continue;
      for (const h of hours) {
        for (const m of mins) {
          const eventTime = new Date(base);
          eventTime.setHours(h, m, 0, 0);
          const pushTime = new Date(eventTime.getTime() - advance * 60000);
          if (sameMinute(pushTime, now)) return { eventTime, pushTime };
        }
      }
    }
    return null;
  }

  getNextDueTime(item, now = new Date()) {
    const parts = String(item.cron || '').trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minField, hourField, dayField, monthField, weekField] = parts;
    const mins = cronValues(minField, 0, 59);
    const hours = cronValues(hourField, 0, 23);
    const days = cronValues(dayField, 1, 31);
    const months = cronValues(monthField, 1, 12);
    const weeks = cronValues(weekField, 0, 7);
    if (!mins?.length || !hours?.length) return null;
    const advance = Number(item.advance_minutes || 0);
    let best = null;
    for (let offset = 0; offset <= 14; offset++) {
      const base = new Date(now);
      base.setDate(now.getDate() + offset);
      base.setSeconds(0, 0);
      const cronWeek = base.getDay();
      const weekOk = !weeks || weeks.includes(cronWeek) || (cronWeek === 0 && weeks.includes(7));
      const dayOk = !days || days.includes(base.getDate());
      const monthOk = !months || months.includes(base.getMonth() + 1);
      if (!weekOk || !dayOk || !monthOk) continue;
      for (const h of hours) {
        for (const m of mins) {
          const eventTime = new Date(base);
          eventTime.setHours(h, m, 0, 0);
          const pushTime = new Date(eventTime.getTime() - advance * 60000);
          if (pushTime.getTime() < now.getTime() - 60000) continue;
          if (!best || pushTime < best.pushTime) best = { eventTime, pushTime };
        }
      }
    }
    return best;
  }

  async toggleRemind(e) {
    if (!e.isMaster) return e.reply('仅主人可操作');
    if (!e.isGroup) return e.reply('请在需要提醒的群聊里操作');
    const cfg = getRemindConfig();
    const groups = normalizeGroups(cfg.groups);
    const gid = String(e.group_id);
    const action = /开启|on/i.test(e.msg || '');

    if (action) {
      if (!groups.includes(gid)) groups.push(gid);
      yaml.set(cfgFile, 'enable', true);
      yaml.set(cfgFile, 'groups', groups);
      return e.reply(`已开启本群崩三定时提醒\n当前提醒群：${groups.join('、')}`);
    }

    const nextGroups = groups.filter(v => v !== gid);
    yaml.set(cfgFile, 'groups', nextGroups);
    if (!nextGroups.length) yaml.set(cfgFile, 'enable', false);
    return e.reply(`已关闭本群崩三定时提醒${nextGroups.length ? `\n剩余提醒群：${nextGroups.join('、')}` : ''}`);
  }

  async remindStatus(e) {
    const cfg = getRemindConfig();
    const groups = normalizeGroups(cfg.groups);
    const enabled = !!cfg.enable && groups.length > 0;
    const inThisGroup = e.isGroup ? groups.includes(String(e.group_id)) : false;
    const itemLines = (cfg.items || []).map(item => {
      const adv = Number(item.advance_minutes || 0);
      const due = this.getNextDueTime(item);
      const eventText = due && due.pushTime.getTime() !== due.eventTime.getTime() ? `（事件${fmtTime(due.eventTime)}）` : '';
      return `- ${item.name || item.key}: ${item.cron}${adv ? `，提前${adv}分钟` : '，准时'}，下次${fmtTime(due?.pushTime)}${eventText}`;
    }).join('\n');
    return e.reply(`崩三定时提醒：${enabled ? '已开启' : '未开启'}${e.isGroup ? `\n本群：${inThisGroup ? '已开启' : '未开启'}` : ''}\n提醒群：${groups.join('、') || '无'}\n${itemLines}`);
  }

  async remindTest(e) {
    if (!e.isMaster) return e.reply('仅主人可操作');
    const cfg = getRemindConfig();
    const groups = normalizeGroups(cfg.groups);
    if (!groups.length) return e.reply('崩三提醒测试失败：提醒群为空，请先在锅巴填写群号或在群内发送 #小花火开启崩三提醒');
    const msg = `【小花火崩三提醒测试】\n如果你看到了这条消息，说明提醒群配置和 Bot 发群消息正常。\n当前配置群：${groups.join('、')}`;
    const results = [];
    for (const groupId of groups) {
      try {
        await bot.sendGroupMsg(groupId, msg);
        results.push(`${groupId}: 成功`);
      } catch (err) {
        results.push(`${groupId}: 失败 ${err.message}`);
      }
    }
    return e.reply(`崩三提醒测试完成：\n${results.join('\n')}`);
  }

  async checkAndPush() {
    const cfg = getRemindConfig();
    const groups = normalizeGroups(cfg.groups);
    if (!cfg.enable || !groups.length) return;
    const items = cfg.items || [];
    const now = new Date();

    for (const item of items) {
      if (!item.cron || !item.msg) continue;
      const due = this.getDueTime(item, now);
      if (!due) continue;
      const dedupKey = `xhh:bh3_remind:sent:${item.key}:${Math.floor(due.pushTime.getTime() / 60000)}`;
      if (await redis.get(dedupKey)) continue;
      logger.mark(`[bh3_remind] 触发提醒 ${item.key || item.name} push=${fmtTime(due.pushTime)} event=${fmtTime(due.eventTime)} groups=${groups.join(',')}`);

      let msg = String(item.msg)
        .replace(/\{time\}/g, `${String(due.eventTime.getHours()).padStart(2, '0')}:${String(due.eventTime.getMinutes()).padStart(2, '0')}`)
        .replace(/\{advance\}/g, String(item.advance_minutes || 0));
      if (item.key === 'abyss_start') {
        const abyssText = await getAnyCurrentAbyssText(true);
        msg += abyssText
          ? `\n\n${abyssText}\n\n发送 #崩三深渊攻略 查看详细作业图。`
          : '\n\n发送 #崩三当前深渊 可快速查询当期 Boss，发送 #崩三深渊攻略 查看作业图。';
      }

      for (const groupId of groups) {
        try {
          await bot.sendGroupMsg(groupId, msg);
          logger.mark(`[bh3_remind] 已发送到群 ${groupId}: ${item.key || item.name}`);
        } catch (err) {
          logger.warn(`[bh3_remind] 发送到群 ${groupId} 失败: ${err.message}`);
        }
      }
      await redis.set(dedupKey, '1', { EX: 7 * 24 * 3600 });
    }
  }
}

export default bh3_remind;
