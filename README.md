# rhizomebbs
rhizomebbs is a simplistic BBS/textboard engine for the Spanish-speaking forum
[IchoriaBBS](https://bbs.ichoria.org). Please note that this textboard engine
is project-specific, and not project-agnostic or a general purpose engine.
You may need to fork this software in case you want to use it for your own
project.

## Features
* Multiboard support
* Markup support
* Images support
* ASCII boards
* Staff and admin tools
* Styles
* Javascript cosmetics and utils
* Oekaki support (powered by [PaintBBS NEO](https://github.com/funige/neo))

## Dependencies
You need to install the following software packages:
* Git
* NodeJS and the node package manager
* pm2 (installed globally from npm)
* (optional) nginx

The database is managed by a simple NodeJS SQLite library.

## Installation
1. Clone the repo: `git clone https://github.com/nshebang/rhizomebbs`
2. Install the required libraries: `npm i`
3. Copy `config.template.json` to `config.json` (VERY important)
4. Edit the configuration file (`config.json`) 
5. IMPORTANT: change the default admin credentials:
```
"staff": {
  "new username": "new password"
},
```
6. Add some boards:
```
"boards": {
    "anime": {
    "title": "Anime",
    "info": "Anime board",
    "banner": "anime.png",
    "fakeName": "Weeb",
    "aa": false
  },
}
```
7. Generate a new secret key (required for jwt used in admin "sessions") by
running `openssl rand -hex 64` and copying the resulting string to the
config file:
```
"secretKey": "VERY LONG STRING"
```
rhizomebbs provides a default secret key, but you shouldn't use it as it's
only there for testing the software while in development.

8. Customize or translate the software if needed.
9. Run `npm start` to start the BBS server, and then
navigate to `localhost:port/admin` to verify your admin
username and password. Once you are logged in as administrator,
you can delete posts, ban users, use capcodes, etc

## Running behind a reverse proxy
Example configuration file for /etc/nginx/sites-available/bbs:
```
server {
	listen 80;
	listen [::]:80;
	
	listen 443 ssl;
	listen [::]:443 ssl;
	
	server_name example.tld;
	
	ssl_certificate /etc/letsencrypt/live/example.tld/cert.pem;
	ssl_certificate_key /etc/letsencrypt/live/example.tld/privkey.pem;

	location / {
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://127.0.0.1:BBS_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
	}
}
```

## License
![](/public/img/gnu.png)

This is copyleft software under the terms of the GNU AGPL v3.
The images in /public/img/ belong to their respective authors and
are not covered by the AGPL license.
