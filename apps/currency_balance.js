import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { pluginPriority } from '#xhh';
import MysInfo from '../../genshin/model/mys/mysInfo.js';

const DATA_DIR = './plugins/xhh/data/currency_balance';

const GAME_META = {
  gs: {
    name: '原神',
    short: '原石',
    unit: '原石',
    ledgerField: 'current_primogems',
    monthParam: () => moment().month() + 1,
  },
  sr: {
    name: '星穹铁道',
    short: '星琼',
    unit: '星琼',
    ledgerField: 'current_hcoin',
    monthParam: () => moment().format('YYYYMM'),
  },
};

function pickGame(msg = '') {
  if (/星铁|星穹|星琼|sr/i.test(msg)) return 'sr';
  return 'gs';
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function dataPath(qq) {
  return path.join(DATA_DIR, `${qq}.json`);
}

function readData(qq) {
  const file = dataPath(qq);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function writeData(qq, data) {
  ensureDir();
  fs.writeFileSync(dataPath(qq), JSON.stringify(data, null, 2), 'utf8');
}

async function sendMsg(e, msg) {
  if (e.group) return e.group.sendMsg([{ type: 'text', data: { text: msg } }]);
  if (e.friend) return e.friend.sendMsg([{ type: 'text', data: { text: msg } }]);
  return e.reply(msg);
}

export class currency_balance extends plugin {
  constructor() {
    super({
      name: '[小花火]原石星琼余额估算',
      dsc: '基于用户手动基准值和官方札记增量估算原石/星琼余额',
      event: 'message',
      priority: pluginPriority('currency_balance', 100),
      rule: [
        { reg: '^#?(设置|校准|修正)(原神|原石|星铁|星穹|星琼)(余额|数量)\s*\d+$', fnc: 'setBalance' },
        { reg: '^#?(原神|原石|星铁|星穹|星琼)(余额|数量)(估算|查询)?$', fnc: 'queryBalance' },
        { reg: '^#?(删除|清除|重置)(原神|原石|星铁|星穹|星琼)(余额|数量)(估算)?$', fnc: 'deleteBalance' },
      ],
    });
  }

  getTargetQq(e) {
    let qq = e.user_id;
    for (const msg of e.message || []) {
      if (msg.type === 'at' && msg.qq) {
        qq = msg.qq;
        break;
      }
    }
    return String(qq);
  }

  async getLedgerSnapshot(e, game) {
    const meta = GAME_META[game];
    const oldGame = e.game;
    const oldNoTips = e.noTips;
    e.game = game;
    e.noTips = false;
    try {
      const res = await MysInfo.get(e, 'ledger', { month: meta.monthParam() }, { log: false, game });
      if (!res || res.retcode !== 0) {
        return { error: res?.message || '札记接口返回异常，请确认已扫码绑定Cookie且开启札记权限。' };
      }
      const val = Number(res?.data?.month_data?.[meta.ledgerField] || 0);
      return {
        uid: String(e.uid || ''),
        ledgerValue: Number.isFinite(val) ? val : 0,
        monthKey: moment().format('YYYYMM'),
        fetchTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      };
    } finally {
      e.game = oldGame;
      e.noTips = oldNoTips;
    }
  }

  async setBalance(e) {
    const game = pickGame(e.msg || '');
    const meta = GAME_META[game];
    const balance = Number(String(e.msg || '').match(/(\d+)\s*$/)?.[1] || 0);
    if (!Number.isFinite(balance) || balance < 0) return sendMsg(e, `请输入正确的${meta.unit}数量，例如：#设置${meta.short}余额 12345`);

    await sendMsg(e, `正在读取${meta.name}札记基准值，请稍后...`);
    const snap = await this.getLedgerSnapshot(e, game);
    if (snap.error) return sendMsg(e, `设置失败：${snap.error}`);
    const qq = this.getTargetQq(e);
    const data = readData(qq);
    data[game] = {
      game,
      uid: snap.uid,
      baseBalance: balance,
      baseLedgerValue: snap.ledgerValue,
      monthKey: snap.monthKey,
      setTime: snap.fetchTime,
    };
    writeData(qq, data);
    return sendMsg(e, [
      `✅ ${meta.name}${meta.unit}余额基准已设置`,
      `UID：${snap.uid}`,
      `当前手动余额：${balance}`,
      `本月札记累计获取：${snap.ledgerValue}`,
      `后续发送 #${meta.short}余额 可按札记增量估算`,
      '注：官方不提供实时余额；抽卡/商店消耗不会被札记收入自动抵扣，余额不准时请重新校准。',
    ].join('\n'));
  }

  async queryBalance(e) {
    const game = pickGame(e.msg || '');
    const meta = GAME_META[game];
    const qq = this.getTargetQq(e);
    const saved = readData(qq)[game];
    if (!saved) {
      return sendMsg(e, `还没有设置${meta.name}${meta.unit}余额基准。\n请先发送：#设置${meta.short}余额 12345`);
    }
    const snap = await this.getLedgerSnapshot(e, game);
    if (snap.error) return sendMsg(e, `查询失败：${snap.error}`);
    if (snap.uid && saved.uid && String(snap.uid) !== String(saved.uid)) {
      return sendMsg(e, `当前查询UID(${snap.uid})与已保存基准UID(${saved.uid})不一致，请重新发送 #设置${meta.short}余额 数量 校准。`);
    }
    if (snap.monthKey !== saved.monthKey) {
      return sendMsg(e, [
        `${meta.name}${meta.unit}余额估算需要重新校准。`,
        `原因：保存基准月份 ${saved.monthKey}，当前月份 ${snap.monthKey}。`,
        `请发送：#设置${meta.short}余额 当前数量`,
      ].join('\n'));
    }
    const delta = snap.ledgerValue - Number(saved.baseLedgerValue || 0);
    const estimate = Number(saved.baseBalance || 0) + delta;
    return sendMsg(e, [
      `📌 ${meta.name}${meta.unit}余额估算`,
      `UID：${snap.uid || saved.uid}`,
      `估算余额：${estimate}`,
      `基准余额：${saved.baseBalance}`,
      `札记增量：${delta >= 0 ? '+' : ''}${delta}`,
      `基准时间：${saved.setTime}`,
      `获取时间：${snap.fetchTime}`,
      '说明：官方没有实时余额接口，本功能只按“手动基准 + 札记本月获取增量”估算；抽卡/兑换等消耗需要重新校准。',
      'from 小花火',
    ].join('\n'));
  }

  async deleteBalance(e) {
    const game = pickGame(e.msg || '');
    const meta = GAME_META[game];
    const qq = this.getTargetQq(e);
    const data = readData(qq);
    if (!data[game]) return sendMsg(e, `当前没有保存${meta.name}${meta.unit}余额基准。`);
    delete data[game];
    writeData(qq, data);
    return sendMsg(e, `已删除${meta.name}${meta.unit}余额估算基准。`);
  }
}
