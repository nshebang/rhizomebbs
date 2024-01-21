const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');
const jwt = require('jsonwebtoken');
const nconf = require('nconf');
const path = require('path');
const { QuickDB } = require('quick.db');

const PostManager = require('./posts');
const BanManager = require('./bans');
const Utils = require('./utils');

const VERSION = '1.0.0';
const app = express();
const db = new QuickDB();
const postMngr = new PostManager(db);
const banMngr = new BanManager(db);
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

app.get('/', (req, res) => {
  res.render('index', {
    VERSION,
    boards,
    boardNames: Object.keys(boards),
    boardCount: Object.keys(boards).length, 
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

  const username = formData.name;
  const password = formData.signum;
  if (password !== adminUsers[username] || req.isLoggedIn)
    return res.redirect('/admin');

  console.log(`New admin login. username=${username},time=${new Date().toISOString()}`);
  const user = { name: username };
  const accessToken = jwt.sign(user, secretKey, { expiresIn: '2h' });
  res.cookie('jwt', accessToken);
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
  const originIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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

  const originIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const formData = req.body;
  if (!formData.board) {
    res.status(302).send({ redirectTo: '/' });
    return;
  }
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
  let result = {
    msg: '',
    refresh: '3',
    url: `${siteUrl}/${formData.board}/`,
  };

  result.msg = formData.name || formData.email ?
      'You will regret that.' :
    !formData.board.trim().length ? 
      'No se especificó un tablón.' :
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

  userTimestamps[`${board}_${parent === 0 ? 'thread' : 'reply'}`] = timestamp;
  postTimestamps[originIp] = userTimestamps;
  
  let imageCount = 0;
  const content = formData.epistula
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/(https?:\/\/\S+)/g, (match, url) => {
      const imageExtensions = /\.(png|gif|jpg|jpeg|bmp|webp)$/i;    
      if (url.match(imageExtensions) && !boards[formData.board].aa) {
        imageCount++;
        return `<a href="${url}" target="_blank"><img src="${url}" alt="${url}" loading="lazy"></a>`;
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
    .replace(/\n/g, '<br>');

  if (imageCount > 3) {
    result.msg = 'Solo se permite un máximo de 3 imágenes por post.';
    res.render('submit', { result });
    return;
  }

  const post = {
    timestamp: timestamp,
    number: 0, 
    userId: '',
    lastBump: timestamp,
    lastReply: 0,
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
