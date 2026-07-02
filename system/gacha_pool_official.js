const NEWS_API = 'https://bbs-api-static.miyoushe.com/painter/wapi/getNewsList';

const GAME_META = {
  gs: {
    name: '原神',
    gid: 2,
    aliases: ['原神', 'gs'],
    keywords: /(祈愿|概率UP|集录祈愿|溯光祈愿)/,
    exclude: /(问题|修复|说明|反馈|预下载|更新说明|版本更新)/
  },
  sr: {
    name: '星穹铁道',
    gid: 6,
    aliases: ['星铁', '崩铁', '星穹铁道', 'sr'],
    keywords: /(活动跃迁|角色活动跃迁|光锥活动跃迁|跃迁)/,
    exclude: /(活动说明|双倍|问题|修复|更新说明)/
  },
  zzz: {
    name: '绝区零',
    gid: 8,
    aliases: ['绝区零', '绝区', 'zzz'],
    keywords: /(限时频段|独家频段|音擎频段|频段|调频)/,
    exclude: /(活动说明|封禁|FAQ|已知问题|壁纸|档案|养成指南|说明书)/
  },
  bh3: {
    name: '崩坏3',
    gid: 1,
    aliases: ['崩三', '崩坏3', '崩坏三', 'bh3'],
    keywords: /(补给|扩充|精准|角色补给|装备补给|服装补给)/,
    exclude: /(封禁|外挂|账号|问题|修复|更新说明)/
  }
};

const CACHE_TTL = 6 * 60 * 60;

class OfficialGachaPool {
  get games() {
    return GAME_META;
  }

  resolveGame(text = '') {
    const raw = String(text).toLowerCase();
    for (const [key, meta] of Object.entries(GAME_META)) {
      if (meta.aliases.some(v => raw.includes(String(v).toLowerCase()))) return key;
    }
    return '';
  }

  normalizeVersion(version = '') {
    return String(version || '').replace(/^v/i, '').replace(/版本/g, '').trim();
  }

  extractVersion(text = '') {
    return this.normalizeVersion(String(text).match(/(\d+\.\d+)/)?.[1] || '');
  }

  cacheKey(game, version = 'latest') {
    return `xhh:gacha_pool:official:${game}:${this.normalizeVersion(version) || 'latest'}`;
  }

  async requestNews(game, pageSize = 30) {
    const meta = GAME_META[game];
    if (!meta) return [];
    const url = `${NEWS_API}?gids=${meta.gid}&page_size=${pageSize}&type=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Referer: 'https://www.miyoushe.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`米游社公告接口 HTTP ${res.status}`);
    const json = await res.json();
    if (json?.retcode !== 0 || !Array.isArray(json?.data?.list)) {
      throw new Error(`米游社公告接口异常：${JSON.stringify(json).slice(0, 180)}`);
    }
    return json.data.list;
  }

  toRecord(game, item = {}) {
    const meta = GAME_META[game];
    const post = item.post || {};
    const images = [];
    for (const img of item.image_list || []) {
      if (img?.url) images.push(img.url);
    }
    for (const img of post.images || []) {
      if (img && !images.includes(img)) images.push(img);
    }
    const cover = item.cover?.url || post.cover || images[0] || '';
    return {
      game,
      gameName: meta?.name || game,
      source: '米游社官方公告',
      title: post.subject || '',
      version: this.extractVersion(post.subject || ''),
      postId: post.post_id || '',
      createdAt: post.created_at ? Number(post.created_at) * 1000 : 0,
      url: this.postUrl(game, post.post_id),
      cover,
      images,
      summary: post.summary || ''
    };
  }

  postUrl(game, postId) {
    const pathMap = { gs: 'ys', sr: 'sr', zzz: 'zzz', bh3: 'bh3' };
    return postId ? `https://www.miyoushe.com/${pathMap[game] || 'ys'}/article/${postId}` : '';
  }

  filterRecords(game, items = [], version = '') {
    const meta = GAME_META[game];
    const ver = this.normalizeVersion(version);
    return items
      .map(v => this.toRecord(game, v))
      .filter(v => {
        const title = v.title || '';
        if (!meta.keywords.test(title)) return false;
        if (meta.exclude.test(title)) return false;
        if (ver && !title.includes(ver)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async fetch(game, { version = '', force = false } = {}) {
    const meta = GAME_META[game];
    if (!meta) return { game, records: [], error: '未知游戏' };
    const ver = this.normalizeVersion(version);
    const key = this.cacheKey(game, ver || 'latest');
    if (!force) {
      const cache = await redis.get(key);
      if (cache) {
        try {
          return { game, records: JSON.parse(cache), cache: true };
        } catch (_) {
          await redis.del(key);
        }
      }
    }
    try {
      const items = await this.requestNews(game);
      let records = this.filterRecords(game, items, ver);
      // 指定版本时，当前 30 条没筛到就扩大一点范围再试。
      if (ver && !records.length) {
        const more = await this.requestNews(game, 80);
        records = this.filterRecords(game, more, ver);
      }
      await redis.set(key, JSON.stringify(records), { EX: CACHE_TTL });
      return { game, records, cache: false };
    } catch (err) {
      const cache = await redis.get(key);
      if (cache) {
        try {
          return { game, records: JSON.parse(cache), cache: true, error: err.message };
        } catch (_) {}
      }
      logger.warn(`[xhh][gacha_pool] ${meta.name} 米游社卡池公告获取失败:`, err);
      return { game, records: [], error: err.message || String(err) };
    }
  }

  async refreshAll() {
    const ret = [];
    for (const game of Object.keys(GAME_META)) {
      ret.push(await this.fetch(game, { force: true }));
    }
    return ret;
  }

  async fetchAll() {
    const ret = [];
    for (const game of Object.keys(GAME_META)) {
      ret.push(await this.fetch(game));
    }
    return ret;
  }
}

export default new OfficialGachaPool();
