const request = require('request-promise');
const { unraw } = require('unraw');
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const { posts, lookup } = require('./db');
posts.createIndex({ added_at: -1 });

async function getPatreonName(userId) {
  const api = 'https://www.patreon.com/api/user';
  const user = await cloudscraper.get(`${api}/${userId}`, { json: true });
  return user.data.attributes.vanity || user.data.attributes.full_name;
}

async function indexer() {
  const postsData = await posts
    .find({})
    .sort({ added_at: -1 })
    .project({ version: 1, user: 1, service: 1 })
    .toArray();

  for (const post of postsData) {
    const service = post.service || 'patreon';
    const indexExists = await lookup.findOne({id: post.user, service});
    if (indexExists) continue;

    switch (service) {
      case 'patreon': {
        await lookup.insertOne({
          version: post.version,
          service: 'patreon',
          id: post.user,
          name: await getPatreonName(post.user)
        });
        break;
      }
      case 'fanbox': {
        const api = 'https://fanbox.pixiv.net/api/creator.get?userId';
        const user = await request.get(`${api}=${post.user}`, {
          json: true,
          headers: {
            'origin': 'https://www.pixiv.net'
          }
        });
        await lookup.insertOne({
          version: post.version,
          service: 'fanbox',
          id: post.user,
          name: unraw(user.body.user.name)
        });
        break;
      }
      case 'gumroad': {
        const api = 'https://kemono.party/proxy/gumroad/user';
        const user = await request.get(`${api}/${post.user}`, { json: true });
        await lookup.insertOne({
          version: post.version,
          service: 'gumroad',
          id: post.user,
          name: user.name
        })
        break;
      }
      default: {
        try {
          await lookup.insertOne({
            version: post.version,
            service: 'patreon',
            id: post.user,
            name: await getPatreonName(post.user)
          });
        } catch (_) {}
      }
    }
  }
}

module.exports = () => indexer()