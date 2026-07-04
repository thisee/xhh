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
const CACHE_VER = 'v2';

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
    return `xhh:gacha_pool:official:${CACHE_VER}:${game}:${this.normalizeVersion(version) || 'latest'}`;
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

  async requestPostFull(game, postId = '') {
    const meta = GAME_META[game];
    if (!meta || !postId) return null;
    const url = `https://bbs-api.miyoushe.com/post/wapi/getPostFull?gids=${meta.gid}&read=1&post_id=${postId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Referer: 'https://www.miyoushe.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`米游社公告详情 HTTP ${res.status}`);
    const json = await res.json();
    if (json?.retcode !== 0) throw new Error(`米游社公告详情异常：${JSON.stringify(json).slice(0, 180)}`);
    return json?.data?.post?.post || null;
  }

  decodeHtml(text = '') {
    return String(text || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  htmlToText(html = '') {
    return this.decodeHtml(String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
  }

  cleanUpName(name = '') {
    return String(name || '')
      .replace(/[「」『』【】［］\[\]]/g, '')
      .replace(/[（(].*?[）)]/g, '')
      .replace(/^(限定|常驻)?[SA]\s*级/, '')
      .replace(/^\d星/, '')
      .trim();
  }

  pushName(list, name = '') {
    const clean = this.cleanUpName(name);
    if (clean && !list.includes(clean) && clean.length <= 20) list.push(clean);
  }

  extractQuotedNames(text = '') {
    const ret = [];
    const re = /[「\[]([^」\]\n]+)[」\]]/g;
    let m;
    while ((m = re.exec(text))) this.pushName(ret, m[1]);
    return ret;
  }

  extractRankNames(text = '', rank = '5', categories = []) {
    const ret = [];
    const cat = categories.length ? `(?:${categories.join('|')})` : '[\\u4e00-\\u9fa5A-Za-z]*';
    // 取“5星角色/限定S级代理人/4星光锥”后，到“概率/获取概率/跃迁/祈愿/调频/。”之前的名字段。
    const re = new RegExp(`(?:限定)?${rank}(?:星|级)${cat}([\\s\\S]{0,220}?)(?:以及|的?(?:祈愿|跃迁|调频)?(?:获取)?概率|概率|将|，|。)`, 'g');
    let m;
    while ((m = re.exec(text))) {
      for (const name of this.extractQuotedNames(m[1])) this.pushName(ret, name);
    }
    return ret;
  }

  parseUpInfo(game, text = '') {
    const plain = this.htmlToText(text);
    const activeText = plain
      // 不按感叹号切句，避免把「点个关注吧！」这类道具名截断。
      .split(/(?<=。)|\n/g)
      .filter(v => /概率/.test(v) && /(提升|UP|提高|大幅|限时)/i.test(v))
      .join('。') || plain;
    const s = [];
    const a = [];
    if (game === 'gs') {
      for (const v of this.extractRankNames(activeText, '5', ['角色', '武器'])) this.pushName(s, v);
      for (const v of this.extractRankNames(activeText, '4', ['角色', '武器'])) this.pushName(a, v);
    } else if (game === 'sr') {
      for (const v of this.extractRankNames(activeText, '5', ['角色', '光锥'])) this.pushName(s, v);
      for (const v of this.extractRankNames(activeText, '4', ['角色', '光锥'])) this.pushName(a, v);
    } else if (game === 'zzz') {
      for (const v of this.extractRankNames(activeText, 'S', ['代理人', '音擎'])) this.pushName(s, v);
      for (const v of this.extractRankNames(activeText, 'A', ['代理人', '音擎'])) this.pushName(a, v);
    } else if (game === 'bh3') {
      for (const v of this.extractRankNames(activeText, 'S', ['角色', '女武神', '人偶', '协同者', '武器', '圣痕'])) this.pushName(s, v);
      for (const v of this.extractRankNames(activeText, 'A', ['角色', '女武神', '人偶', '协同者', '武器', '圣痕'])) this.pushName(a, v);
      // 崩三补给公告的写法较散，至少把“角色补给/装备补给”里显眼的限定名抓出来。
      if (!s.length) {
        const m = plain.match(/(?:角色补给|扩充补给|装备补给|精准补给)[\s\S]{0,80}?[「『]([^」』]+)[」』]/);
        if (m) this.pushName(s, m[1]);
      }
    }
    return { s: s.slice(0, 6), a: a.slice(0, 8) };
  }

  async enrichRecords(game, records = []) {
    const ret = [];
    for (const record of records) {
      try {
        const full = await this.requestPostFull(game, record.postId);
        const content = full?.content || full?.structured_content || record.summary || '';
        const up = this.parseUpInfo(game, content);
        ret.push({
          ...record,
          contentText: this.htmlToText(content).slice(0, 500),
          up,
          images: full?.images?.length ? full.images : record.images,
          cover: full?.cover || record.cover || full?.images?.[0] || record.images?.[0] || ''
        });
      } catch (err) {
        logger.warn(`[xhh][gacha_pool] ${GAME_META[game]?.name || game} 公告UP解析失败:`, record.title, err);
        ret.push({ ...record, up: this.parseUpInfo(game, record.summary || record.title || '') });
      }
    }
    return ret;
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
      // 详情接口需要逐条请求；当前卡池只展示靠前公告，限制数量避免首次查询卡太久。
      records = await this.enrichRecords(game, records.slice(0, ver ? 16 : 8));
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
