import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import favicon from 'serve-favicon';

import jwt from 'jsonwebtoken';
const { sign, verify } = jwt;

import nconf from 'nconf';
import { fileURLToPath } from 'url';
import path from 'path';
import ytdl from 'youtube-dl-exec';
import speakeasy from 'speakeasy';

import { QuickDB } from 'quick.db';
import { DiceRoller } from '@dice-roller/rpg-dice-roller';
import { lookup } from 'dnsbl';

import { PostManager } from './posts.js';
import { BanManager } from './bans.js';
import { Blotter } from './blotter.js';
import { Utils } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VERSION = '1.2.1';
const app = express();
const db = new QuickDB();
const postMngr = new PostManager(db);
const banMngr = new BanManager(db);
const blotter = new Blotter(db);
const utils = new Utils();

console.log('Loading configuration');
nconf.file({ 'file': 'config.json' });
const port = nconf.get('port');
const siteUrl = nconf.get('siteUrl');
const boards = nconf.get('boards');
const adminUsers = nconf.get('staff');
const secretKey = nconf.get('secretKey');
const styles = nconf.get('styles');
const replyCooldown = nconf.get('replyCooldown');
const threadCooldown = nconf.get('threadCooldown');

const postTimestamps = {};

console.log('Preparing server');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(favicon(path.join(__dirname, '..', 'public', 'img', 'favicon.gif')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    'default-src \'self\' https://cdn.jsdelivr.net https://saki.ichoria.org \'unsafe-inline\'; img-src \'self\' data: https:; frame-ancestors \'self\' https://chan.city;'
  );
  res.setHeader('Referrer-Policy', 'strict-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use((req, res, next) => {
  const token = req.cookies.jwt;
  
  req.isLoggedIn = false;
  req.user = null;
  
  if (!token)
    return next();
  
  jwt.verify(token, secretKey, (err, user) => {
    if (err)
      return next();
    req.isLoggedIn = true;
    req.user = user;
    next();
  });
});

app.get('/', async (req, res) => {
  const latestPosts = await postMngr.getLastGlobalPosts(Object.keys(boards));
  const blotterPosts = await blotter.getAllBlotterPosts();
  const username = req.user? (req.user.name ?? '') : '';
  res.render('index', {
    VERSION,
    boards,
    boardNames: Object.keys(boards),
    boardCount: Object.keys(boards).length,
    latestPosts,
    blotterPosts,
    isLoggedIn: req.isLoggedIn,
    username,
  });
});

app.get('/info', (req, res) => {
  res.render('info');
});

app.get('/admin', (req, res) => {
  res.render('admin-login');
});

app.post('/admin/login', (req, res) => {
  const formData = req.body;
  if (formData.password)
    return res.status(404).render('not-found');
  
  const username = formData.name ?? '';
  const password = formData.signum ?? '';
  const totp = formData.totp ?? '';
  
  let originIp = req.socket.remoteAddress;
  if (req.headers['x-forwarded-for'])
    originIp = req.headers['x-forwarded-for'].split(',')[0];
  
  console.log(`Admin login attempt from ${originIp} (username=${username})`);
  
  if (!adminUsers[username] ||
      password !== adminUsers[username].password ||
      !totp.trim().length ||
      req.isLoggedIn)
    return res.redirect('/admin');
  
  const verified = speakeasy.totp.verify({
    secret: adminUsers[username].secret,
    encoding: 'base32',
    token: totp,
    window: 1,
  });
  
  if (!verified) {
    console.log(`Admin TOTP verification failed (password was correct, username=${username})`);
    return res.redirect('/admin');
  }

  console.log(`Successful admin login from ${originIp} (username=${username})`);
  const user = { name: username };
  const accessToken = jwt.sign(user, secretKey, { expiresIn: '2h' });
  res.cookie('jwt', accessToken, {
    maxAge:  2 * 60 * 60 * 1000,
    sameSite: 'strict'
  });
  res.redirect('/');
});

app.get('/admin/logout', (req, res) => {
  if (!req.isLoggedIn)
  return res.status(404).render('not-found');
  res.clearCookie('jwt');
  req.isLoggedIn = false;
  req.user = null;
  res.redirect('/');
});

app.post('/admin/blotter/new', async (req, res) => {
  if (!req.isLoggedIn)
  return res.status(404).render('not-found');
  
  const formData = req.body;
  let result = {
    msg: 'Error: No se introdujo ninguna noticia.',
    refresh: '3',
    url: `${siteUrl}`
  }; 
  
  if (!formData.content || !formData.content.trim().length)
    return res.render('submit', { result });
  
  const post = {
    timestamp: Date.now(),
    username: formData.username,
    content: formData.content.replace(/\n/g, '<br>')
  };
  await blotter.addBlotterPost(post);
  result.msg = 'Post añadido al blotter.';
  res.render('submit', { result });
});

app.get('/admin/blotter/delete', async (req, res) => {
  if (!req.isLoggedIn)
    return res.status(404).render('not-found');
  
  const timestamp = parseInt(req.query.id ?? 0);
  await blotter.deleteBlotterPost(timestamp);
  const result = {
    msg: 'Post removido del blotter.',
    refresh: '2',
    url: `${siteUrl}`,
  };
  res.render('submit', { result });
});

app.get('/admin/ban', async (req, res) => {
  if (!req.isLoggedIn)
    return res.status(404).render('not-found');
  const ip = req.query.ip ?? '';
  const reason = req.query.reason ?? '';
  const now = Date.now();
  const rawBanLength = req.query.length ?? '';
  const author = req.user.name ?? 'Admin';
  
  const banLength = rawBanLength !== '0'?
  utils.parseUnixMillis(rawBanLength) : 0; 
  
  const ban = {
    ip: ip,
    reason: reason,
    timestamp: now,
    expires: banLength? now + banLength : 0,
    author: author,
  };
  await banMngr.addBan(ban);
  
  console.log(`New ban applied by ${author} to ${ip} (reason=${reason})`);
  const result = {
    msg: 'Dirección IP baneada exitosamente.',
    refresh: '3',
    url: `${siteUrl}`,
  };
  res.render('submit', { result });
});

app.get('/admin/unban', async (req, res) => {
  if (!req.isLoggedIn)
    return res.status(404).render('not-found');
  const ip = req.query.ip ?? '';
  let result = {
    msg: 'La dirección IP especificada no está baneada.',
    refresh: '3',
    url: `${siteUrl}`,
  };
  
  const ban = await banMngr.getBan(ip);
  if (!ban) 
    return res.render('submit', { result });
  await banMngr.deleteBan(ip);
  result.msg = 'Se eliminó el baneo a la IP especificada.';
  res.render('submit', { result });
});

app.get('/admin/nuke', async (req, res) => {
  if (!req.isLoggedIn)
    return res.status(404).render('not-found');
  const ip = req.query.ip ?? '';
  const reason = req.query.reason ?? '';
  const now = Date.now();
  const rawBanLength = req.query.length ?? '';
  const author = req.user.name ?? 'Admin';
  
  const banLength = rawBanLength !== '0'?
  utils.parseUnixMillis(rawBanLength) : 0; 
  
  const ban = {
    ip: ip,
    reason: reason,
    timestamp: now,
    expires: banLength? now + banLength : 0,
    author: author,
  };
  await banMngr.addBan(ban);
  
  const boardNames = Object.keys(boards);
  for (const boardName of boardNames) {
    await postMngr.deletePostsByIp(boardName, ip);
  }
  
  const result = {
    msg: 'Posts eliminados e IP baneada.',
    refresh: '3',
    url: `${siteUrl}`,
  };
  res.render('submit', { result });
});

app.get('/admin/close', async (req, res) => {
  if (!req.isLoggedIn)
    return res.status(404).render('not-found');
  const boardName = req.query.board ?? '';
  const threadId = req.query.thread ?? '';
  
  let result = {
    msg: 'El post indicado no es un hilo o no existe.',
    refresh: '2',
    url: `${siteUrl}/${boardName}`,
  };
  const thread = await postMngr.getThread(boardName, parseInt(threadId));
  if (!thread)
    return res.render('submit', { result });
  
  await postMngr.closeThread(boardName, parseInt(threadId));
  result.msg = 'Hilo cerrado exitosamente.';
  res.render('submit', { result });
});

app.get('/delete', async (req, res) => {
  const boardName = req.query.board ?? '';
  const threadId = req.query.thread ?? '';
  const postNumber = req.query.number ?? '';
  
  const post = await postMngr.getPostByIds(
    boardName,
    parseInt(threadId),
    parseInt(postNumber)
  );
  
  if (!post)
    return res.status(404).render('not-found');
  let result = {
    msg: 'No es posible borrar ese post.',
    refresh: '2',
    url: `${siteUrl}/${boardName}`,
  };
  
  let originIp = req.socket.remoteAddress;
  if (req.headers['x-forwarded-for'])
    originIp = req.headers['x-forwarded-for'].split(',')[0];
  
  if (post.ip !== originIp && !req.isLoggedIn)
    return res.render('submit', { result });
  
  await postMngr.deletePost(
    boardName,
    parseInt(threadId),
    parseInt(postNumber) - 1
  );
  result.msg = 'Post borrado exitosamente.';
  res.render('submit', { result });
});

app.get('/:board', async (req, res) => {
  const boardName = req.params['board'];
  
  if (boards[boardName]) {
    const board = boards[boardName];
    const mainThreadList = await postMngr.getLastNThreads(boardName, 30);
    const rawThreads = await postMngr.getLastNThreads(boardName, 10);
    
    const file = req.query.file ?? '';
    const parent = req.query.parent ?? '';
    
    const threadPromises = rawThreads.map(async t => {
      const lastReplies = await postMngr.getLastNReplies(boardName, t.timestamp, 4);
      return Object.assign(t, { replies: lastReplies });
    });
    
    const threads = await Promise.all(threadPromises);
    
    res.render('bbs', {
      VERSION,
      boardName,
      board,
      boards: Object.keys(boards),
      styles,
      threads,
      mainThreadList,
      isLoggedIn: req.isLoggedIn,
      file,
      parent
    });
  } else {
    res.status(404).render('not-found');
  }
});

app.get('/:board/threads/:threadId', async (req, res) => {
  const boardName = req.params['board'];
  const threadId = req.params['threadId'];
  const baseThread = await postMngr.getThread(boardName, threadId);
  
  if (boards[boardName] && baseThread) {
    const board = boards[boardName];
    
    const file = req.query.file ?? '';
    const parent = req.query.parent ?? '';
    
    const replies = await postMngr.getAllReplies(boardName, baseThread.timestamp);
    const thread = Object.assign(baseThread, { replies: replies });
    
    res.render('thread', {
      VERSION,
      boardName,
      board,
      boards: Object.keys(boards),
      styles,
      thread,
      isLoggedIn: req.isLoggedIn,
      file,
      parent
    });
  } else {
    res.status(404).render('not-found');
  }
});

app.get('/:board/list', async (req, res) => {
  const boardName = req.params['board'];
  
  if (boards[boardName]) {
    const board = boards[boardName];
    const threads = await postMngr.getThreadsByBumpOrder(boardName);
    
    res.render('list', {
      VERSION,
      boardName,
      board,
      boards: Object.keys(boards),
      styles,
      threads,
      isLoggedIn: req.isLoggedIn,
    });
  } else {
    res.status(404).render('not-found');
  }
});

app.get('/:board/paint', (req, res) => {
  const boardName = req.params['board'];
  
  if (boards[boardName] && boards[boardName].oekaki) {
    const board = boards[boardName];
    const canvasWidth = req.query.cwidth ?? '400';
    const canvasHeight = req.query.cheight ?? '400';
    
    res.render('paint', {
      VERSION,
      boardName,
      board,
      boards: Object.keys(boards),
      styles,
      isLoggedIn: req.isLoggedIn,
      canvasWidth,
      canvasHeight
    });
  } else {
    res.status(404).render('not-found');
  }
});

app.get('/api/threads', async (req, res) => {
  const boardName = req.query.board ?? '';
  const threadId = req.query.thread ?? '';
  
  const rawReplies = await postMngr.getAllReplies(boardName, parseInt(threadId));
  const replies = rawReplies.map(({ ip, ...rest }) => rest);
  res.json({ replies });
});

app.get('/api/post', async (req, res) => {
  const boardName = req.query.board ?? '';
  const threadId = req.query.thread ?? '';
  const postNumber = req.query.number ?? '';
  
  const rawPost = await postMngr.getPostByIds(
    boardName,
    parseInt(threadId),
    parseInt(postNumber)
  );
  const post = { ...rawPost, ip: undefined };
  res.json({ post });
});

app.post('/submit', async (req, res) => {
  //const userAgent = req.get('User-Agent') || '';
  //if (userAgent.toLowerCase().includes('curl'))
  //  return res.status(403).send('403 Forbidden');
  
  let originIp = req.socket.remoteAddress;
  if (req.headers['x-forwarded-for'])
    originIp = req.headers['x-forwarded-for'].split(',')[0];
  
  const formData = req.body;
  if (!formData.board)
    return res.status(302).send({ redirectTo: '/' });
  
  const ban = await banMngr.getBan(originIp);
  if (ban) {
    if (ban.expires > 0 && Date.now() > ban.expires) {
      await banMngr.deleteBan(originIp);
    } else {
      return res.render('banned', { ban });
    }
  }
  
  const board = formData.board ?? '';
  const parent = parseInt(formData.parent);
  const thread = parent? await postMngr.getThread(board, parent) : null;
  const timestamp = Date.now();
  const userTimestamps = postTimestamps[originIp] || {};
  const lastReplyTimestamp = userTimestamps[`${board}_reply`] || 0;
  const lastThreadTimestamp = userTimestamps[`${board}_thread`] || 0;
  const isKnownSpammer = await lookup(originIp, 'all.s5h.net');
  let result = {
    msg: '',
    refresh: '3',
    url: `${siteUrl}/${formData.board}/`,
  };
  
  result.msg = formData.name || formData.email ?
  'You will regret that.' :
  !formData.board.trim().length ? 
  'No se especificó un tablón.' :
  isKnownSpammer ?
  'Tu dirección IP actual se encuentra en una lista de IPs de spam.' +
  'Esto no es un baneo, para mayor información contacta a admin@ichoria.org' :
  thread && thread.closed ?
  'Este hilo ha sido cerrado y ya no es posible responder.' :
  parent === 0 && (timestamp - lastThreadTimestamp) < threadCooldown ?
  'Debes esperar más tiempo para volver a abrir un hilo.' :
  parent !== 0 && (timestamp - lastReplyTimestamp) < replyCooldown ?
  'Debes esperar unos segundos para volver a postear.' :
  !formData.titulus && parent === 0 ?
  'Por favor ingresa un título.' :
  !formData.epistula.trim() ?
  'Debes escribir algo de texto para postear.' :
  formData.epistula.trim().length < 2?
  'El texto es muy corto para ser admitido.' :
  formData.epistula.trim().length > 8000?
  'El texto es muy largo para ser admitido.' : 'ok';
  
  if (result.msg !== 'ok')
  return res.render('submit', { result });
  
  let imageCount = 0;
  let videoIds = [];
  let content = formData.epistula
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/(https?:\/\/\S+)/g, (match, url) => {
    const imageRegex = /\.(png|gif|jpg|jpeg|bmp|webp)$/i;
    const youtubeRegex = /(vi\/|v=|\/v\/|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/;
    
    const imageMatch = url.match(imageRegex);
    const youtubeMatch = url.match(youtubeRegex);
    
    if (imageMatch && !boards[formData.board].aa) {
      imageCount++;
      if (!url.startsWith('https://'))
      url = 'https://' + url.substring(url.indexOf('://') + 3);
      return `<a href="${url}" target="_blank"><img src="${url}" alt="${url}" loading="lazy"></a>`;
    } else if (youtubeMatch) {
      const videoId = youtubeMatch[2];
      videoIds.push([url, videoId]);
      
      return `### ${videoId} ###`;
    } else {
      return `<a href="${url}" target="_blank">${url}</a>`;
    }
  })
  .replace(/&gt;&gt;(\d+)/g, (match, n) => {
    const boardName = formData.board;
    const threadId = parent !== 0? parent : timestamp;
    return `<a onmouseover="whoAmIQuoting(this);" href="/${boardName}/threads/${threadId}#p${n}">&gt;&gt;${n}</a>`;
  })
  .replace(/^&gt;(.+)$/gm, '<span class="quote">$1</span>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/__(.*?)__/g, '<em>$1</em>')
  .replace(/~~(.*?)~~/g, '<span class="spoiler">$1</span>')
  .replace(/```([\s\S]*?)```/g, '<code><pre class="code-pre">$1</pre></code>')
  .replace(/\n/g, !boards[board].aa? '<br>' : '\n');
  //.replace(/ /g, !boards[board].aa? ' ' : '　');
  
  if (imageCount > 3) {
    result.msg = 'Solo se permite un máximo de 3 imágenes por post.';
    return res.render('submit', { result });
  }
  
  if (boards[board].oekaki && imageCount < 1 && !parent) {
    result.msg = 'Este es un tablón oekaki. Debes pegar al menos una imágen o dibujo para abrir un hilo.';
    return res.render('submit', { result });
  }
  
  const command = formData.imperatum ?? '';
  if (boards[board].game && command) {
    const cmdParts = command.split(' ');
    const cmdName = cmdParts[0];
    const cmdArgs = cmdParts.slice(1);
    
    switch(cmdName) {
      case '/roll':
      case '/dice':
      case '/dado':
        const dicePattern = /^[1-9]d\d{1,}$/;
        const validRolls = [];
        const roller = new DiceRoller();
        const maxRolls = cmdArgs.length < 8? cmdArgs.length : 7;
        let resultString = '';

        for (let i = 0; i < maxRolls; i++)
          if (cmdArgs[i].match(dicePattern))
            validRolls.push(cmdArgs[i]);
        if (!validRolls.length)
          validRolls.push('1d6');
        roller.roll(...validRolls);

        let r = 1;
        resultString += '<div class="roll">'
        roller.log.forEach(roll => {
          const rollResults = roll.rolls.join(', ');
          resultString += `⚄ ${r}. ${roll.notation} : ${rollResults}<br>`;
          r++;
        });
        resultString += `⚄ Total: ${roller.total}</div>`;
        content = resultString.concat(content);
      break;
    }
  }
  
  for(let i = 0; i < videoIds.length; i++) {
    const videoUrl = videoIds[i][0];
    const videoId = videoIds[i][1];
    const regexp = new RegExp(`### ${videoId} ###`, 'g');
    
    try {
      const videoInfo = await ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      addHeader: ['referer:youtube.com', 'user-agent:googlebot']
    });
    
    content = content.replace(regexp,
      `<a href="${videoUrl}" target="_blank">
      <div class="youtube">
      <div class="thumb">
      <img src="https://i.ytimg.com/vi/${videoId}/default.jpg" loading="lazy">
      <span class="duration">${videoInfo.duration_string}</span>
      </div>
      <b>${videoInfo.title}</b><br>${videoInfo.uploader}
      </div>
      </a>`.replace(/\n/g, '')
    );
  } catch (error) {
    console.error('youtube-dl library throw an error', error);
    content = content.replace(regexp, `<a href="${videoUrl}" target="_blank">${videoUrl}</a>`);
  }
}

userTimestamps[`${board}_${parent === 0 ? 'thread' : 'reply'}`] = timestamp;
postTimestamps[originIp] = userTimestamps;

console.log(`${originIp} posted on ${board} (parent=${parent}, title=${formData.titulus ?? ''})`);

const post = {
  timestamp: timestamp,
  number: 0, 
  userId: '',
  lastBump: timestamp,
  lastReply: timestamp,
  sage: formData.sage? true : false,
  capcode: formData.capcode && req.isLoggedIn? true : false,
  enableIds: formData.enableIds? true: false,
  closed: false,
  replyCount: 0,
  ip: originIp,
  parent: parent,
  title: formData.titulus ?? '',
  content: content,
};
await postMngr.addPost(board, post);

const thanksMsgs = [
  'Eres una buena persona.',
  'Recuerda beber agua.',
  'Apreciamos mucho tu contribución ˶ᵔ ᵕ ᵔ˶',
  'Ten un buen día.',
  'Pasa una linda tarde.',
  '¡Por favor vuelve pronto!',
  'Nos interesan tus ideas.',
  'Tu escrito contribuye al conocimiento.',
];
const randomIndex = Math.floor(Math.random() * thanksMsgs.length);
const thanks = thanksMsgs[randomIndex];
result.msg = `¡Gracias por tu post! ${thanks}`;
result.url = post.parent !== 0?
`${siteUrl}/${formData.board}/threads/${post.parent}#postform` :
`${siteUrl}/${formData.board}/threads/${post.timestamp}`; 
result.refresh = '1';
res.render('submit', { result });
});

app.use((req, res, next) => {
  res.status(404).render('not-found');
});

app.listen(port, () => {
  console.log(`Rhizome bbs listening on http://localhost:${port}`);
});
