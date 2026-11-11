import assert from 'node:assert/strict';
import { normalizeFeedPosts, safeFeedMediaPath } from '../../lib/feed-normalize.mjs';

const owner='b0000000-0000-0000-0000-00000000000b';
const imagePath=`${owner}/test-photo.jpg`;
assert.equal(safeFeedMediaPath(imagePath),imagePath);
assert.equal(safeFeedMediaPath(`https://example.com/${imagePath}`),'');
assert.equal(safeFeedMediaPath(`${owner}/../private.png`),'');

const posts=normalizeFeedPosts([
 {id:'text-1',author_id:owner,body:'Mətn postu',post_type:'text',media_urls:[],feed_likes:[],feed_comments:[],created_at:'2026-11-11T10:00:00Z'},
 {id:'image-1',author_id:owner,body:'Şəkilli post',post_type:'image',media_urls:[imagePath,`https://evil.example/x.png`,imagePath],feed_likes:null,feed_comments:{invalid:true}},
 {id:'image-broken',author_id:owner,body:'Şəkli əlçatan deyil',post_type:'image',media_urls:{invalid:true}},
 {invalid:true},null
]);
assert.equal(posts.length,3);
assert.equal(posts[0].body,'Mətn postu');
assert.deepEqual(posts[1].media_urls,[imagePath]);
assert.equal(posts[1].media_unavailable,false);
assert.equal(posts[1].feed_comments.length,0);
assert.equal(posts[2].media_unavailable,true);
console.log('PASS  Feed normalizer preserves text/image posts and isolates malformed media rows');
