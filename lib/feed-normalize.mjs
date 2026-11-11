const MEDIA_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}\.(?:jpg|png|webp)$/i;
const POST_TYPES = new Set(['text', 'image', 'poll', 'question']);

export function safeFeedMediaPath(value) {
  return typeof value === 'string' && MEDIA_PATH.test(value) && !value.includes('..') ? value : '';
}

export function normalizeFeedPost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const rawType = typeof input.post_type === 'string' ? input.post_type : 'text';
  const postType = POST_TYPES.has(rawType) ? rawType : 'text';
  const mediaUrls = Array.isArray(input.media_urls)
    ? [...new Set(input.media_urls.map(safeFeedMediaPath).filter(Boolean))].slice(0, 4)
    : [];
  const comments = Array.isArray(input.feed_comments)
    ? input.feed_comments.filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    : [];
  const likes = Array.isArray(input.feed_likes)
    ? input.feed_likes.filter((item) => item && typeof item.user_id === 'string')
    : [];
  const createdAt = typeof input.created_at === 'string' && Number.isFinite(Date.parse(input.created_at))
    ? input.created_at
    : new Date(0).toISOString();

  return {
    ...input,
    id: typeof input.id === 'string' ? input.id : '',
    author_id: typeof input.author_id === 'string' ? input.author_id : '',
    body: typeof input.body === 'string' ? input.body : '',
    post_type: postType,
    media_urls: mediaUrls,
    media_unavailable: postType === 'image' && mediaUrls.length === 0,
    created_at: createdAt,
    view_count: Number.isFinite(Number(input.view_count)) ? Math.max(0, Number(input.view_count)) : 0,
    profiles: input.profiles && typeof input.profiles === 'object' && !Array.isArray(input.profiles) ? input.profiles : {},
    feed_comments: comments,
    feed_likes: likes
  };
}

export function normalizeFeedPosts(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    try { return normalizeFeedPost(row); } catch { return null; }
  }).filter((row) => row && row.id && row.author_id);
}
