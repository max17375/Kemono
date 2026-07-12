const { posts } = require('../../db');
const { workerData, parentPort } = require('worker_threads');
const indexer = require('../../indexer');
const fs = require('fs-extra');
const request = require('request-promise');
const request2 = require('request')
  .defaults({ encoding: null })
const { unraw } = require('unraw');
const nl2br = require('nl2br');
const crypto = require('crypto');
const retry = require('retry');

const requestOptions = (key) => {
  return {
    json: true,
    headers: {
      'cookie': `PHPSESSID=${key}`,
      'origin': 'https://www.pixiv.net'
    }
  };
};

const fileRequestOptions = (key) => {
  return {
    encoding: null,
    headers: {
      'cookie': `PHPSESSID=${key}`,
      'origin': 'https://www.pixiv.net',
    }
  };
};

async function scraper(key) {
  parentPort.postMessage('fanbox scraper fired!');
  const fanboxIndex = await request.get('https://fanbox.pixiv.net/api/plan.listSupporting', requestOptions(key));
  await Promise.all(
    fanboxIndex.body.map((artist) =>
      processFanbox(`https://fanbox.pixiv.net/api/post.listCreator?userId=${artist.user.userId}&limit=100`, key)
    )
  );
}

async function processFanbox(url, key) {
  const data = await request.get(unraw(url), requestOptions(key));
  for (const post of data.body.items) {
    parentPort.postMessage(post);
    if (!post.body) continue;
    const postModel = {
      version: 2,
      service: 'fanbox',
      title: unraw(post.title),
      content: nl2br(unraw(post.body.text || await concatenateArticle(post.body, key))),
      id: post.id,
      user: post.user.userId,
      post_type: post.type, // image, article, embed (undocumented) or file
      published_at: post.publishedDatetime,
      added_at: new Date().getTime(),
      embed: {},
      post_file: {},
      attachments: []
    };

    const postExists = await posts.findOne({id: post.id, service: 'fanbox'});
    if (postExists) continue;

    const filesLocation = 'https://kemono.party/files/fanbox';
    const attachmentsLocation = 'https://kemono.party/attachments/fanbox';
    if (post.body.images) {
      for (const [index, image] of post.body.images.entries()) {
        if (index == 0 && !postModel.post_file['name']) {
          const operation = retry.operation({
            retries: 10,
            factor: 1,
            minTimeout: 1000
          });
          operation.attempt(async() => {
            let randomKey = crypto.randomBytes(20).toString('hex');
            await fs.ensureFile(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`);
            request2.get(unraw(image.originalUrl), fileRequestOptions(key))
              .on('complete', () => {
                fs.rename(
                  `${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`,
                  `${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
                );
              })
              .on('error', err => operation.retry(err))
              .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`))
          })
          
          postModel.post_file['name'] = `${image.id}.${image.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
        } else {
          const operation = retry.operation({
            retries: 10,
            factor: 1,
            minTimeout: 1000
          });
          operation.attempt(async() => {
            let randomKey = crypto.randomBytes(20).toString('hex');
            await fs.ensureFile(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`);
            request2.get(unraw(image.originalUrl), fileRequestOptions(key))
              .on('complete', () => {
                fs.rename(
                  `${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`,
                  `${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
                );
              })
              .on('error', err => operation.retry(err))
              .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`))
          })
          postModel.attachments.push({
            id: image.id,
            name: `${image.id}.${image.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${image.id}.${image.extension}`
          });
        }
      }
    }

    if (post.body.files) {
      for (const [index, file] of post.body.files.entries()) {
        if (index == 0 && !postModel.post_file['name']) {
          const operation = retry.operation({
            retries: 10,
            factor: 1,
            minTimeout: 1000
          });
          operation.attempt(async() => {
            let randomKey = crypto.randomBytes(20).toString('hex');
            await fs.ensureFile(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`);
            request2.get(unraw(file.url), fileRequestOptions(key))
              .on('complete', () => {
                fs.rename(
                  `${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`,
                  `${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
                );
              })
              .on('error', err => operation.retry(err))
              .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/files/fanbox/${post.user.userId}/${post.id}/${randomKey}`))
          })
          postModel.post_file['name'] = `${file.name}.${file.extension}`
          postModel.post_file['path'] = `${filesLocation}/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
        } else {
          const operation = retry.operation({
            retries: 10,
            factor: 1,
            minTimeout: 1000
          });
          operation.attempt(async() => {
            let randomKey = crypto.randomBytes(20).toString('hex');
            await fs.ensureFile(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`);
            request2.get(unraw(file.url), fileRequestOptions(key))
              .on('complete', () => {
                fs.rename(
                  `${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`,
                  `${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
                );
              })
              .on('error', err => operation.retry(err))
              .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/attachments/fanbox/${post.user.userId}/${post.id}/${randomKey}`))
          })
          postModel.attachments.push({
            id: file.id,
            name: `${file.name}.${file.extension}`,
            path: `${attachmentsLocation}/${post.user.userId}/${post.id}/${file.name}.${file.extension}`
          });
        }
      }
    }

    await posts.insertOne(postModel);
  }

  if (data.body.nextUrl) {
    await processFanbox(data.body.nextUrl, key);
  }
}

async function concatenateArticle(body, key) {
  let concatenatedString = '<p>';
  parentPort.postMessage(JSON.stringify(body))
  try {
    for (const block of body.blocks) {
      if (block.type == 'image') {
        const imageInfo = body.imageMap[block.imageId];
        const operation = retry.operation({
          retries: 10,
          factor: 1,
          minTimeout: 1000
        });
        operation.attempt(async() => {
          let randomKey = crypto.randomBytes(20).toString('hex');
          await fs.ensureFile(`${process.env.DB_ROOT}/inline/fanbox/${randomKey}`);
          request2.get(unraw(imageInfo.originalUrl), fileRequestOptions(key))
            .on('complete', () => {
              fs.rename(
                `${process.env.DB_ROOT}/inline/fanbox/${randomKey}`,
                `${process.env.DB_ROOT}/inline/fanbox/${imageInfo.id}.${imageInfo.extension}`
              );
            })
            .on('error', err => operation.retry(err))
            .pipe(fs.createWriteStream(`${process.env.DB_ROOT}/inline/fanbox/${randomKey}`))
        })
        concatenatedString += `<img src="https://kemono.party/inline/fanbox/${imageInfo.id}.${imageInfo.extension}"><br>`
      } else if (block.type == 'p') {
        concatenatedString += `${unraw(block.text)}<br>`
      }
    }
  } catch (_) {}
  concatenatedString += '</p>'
  return concatenatedString
}

scraper(workerData)