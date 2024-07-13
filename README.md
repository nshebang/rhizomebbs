# rhizomebbs
rhizomebbs is the textboard engine made for the Spanish-speaking forum
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
* Mandatory 2FA for admins (via TOTPs)
* Styles
* Javascript cosmetics and utils
* Oekaki support (powered by [PaintBBS NEO](https://github.com/funige/neo))

## Dependencies
You need to install the following software packages:
* Git
* NodeJS and the node package manager
* pm2 (installed globally from npm)
* (optional) nginx

The database is managed by a simple NodeJS SQLite3 library, and the migration
will be executed automatically the first time you run the software, so you
don't need to install any additional database packages or do any extra actions.

## Installation
1. Clone the repo: `git clone https://github.com/nshebang/rhizomebbs`
2. Install the required libraries: `npm i`
3. Copy `config.template.json` to `config.json` (VERY important)
4. Edit the configuration file (`config.json`) 
5. IMPORTANT: [change the default admin account (click for details)](#creating-administrator-accounts)
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
username, password and TOTP. Once you are logged in as administrator,
you can delete posts, ban users, use capcodes, etc

## Creating administrator accounts

You can add administrator accounts by editing your config.json file
(which is initially a clone of config.template.json). Just after copying the
configuration template, the initial config.json file looks like this:

```
"staff": {
  "admin": {
    "password": "password",
    "secret": "<some random TOTP string>"
  }
},
```

Please note that rhizomebbs requires **all administrator accounts** to log in
using both their standard password and 2FA one-time passwords
(yes, two factor authentication is mandatory). You need to
tell your staff members to download some sort of TOTP authenticator like
like [Aegis](https://getaegis.app/) (free and open source) or
[Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)
(proprietary). If a member is particularly paranoid about privacy and
doesn't own a smartphone, they can use some desktop app like 
[OTPClient](https://flathub.org/apps/com.github.paolostivanin.OTPClient) (Linux)
or just a standard password manager like [KeePassXC](https://keepassxc.org/)
(Linux, Windows and other OS).

Once your entire staff team (including you) has installed their respective
TOTP applications, you need to follow these steps to add an administrator account:

1. Add the admin username and password to the config.json file:

```
"staff": {
  "new admin username": {
    "password": "new password",
    "secret": don't add it yet, leave it blank for now
  }
},
```

2. Run `npm run genAdminSecret`. This will produce an output like the following:

```
Secret: <some secret key>
OTP link: <OTP link for the new admin>
QR Code: <a huge base64 link to a QR code image>
```

3. Add the string next to "Secret: " to your new user object in config.json:

```
"staff": {
  "new admin username": {
    "password": "new password",
    "secret": "<some secret key>"
  }
},
```

4. Give your new user the OTP link and QR Code link (usually, the QR code
is way more useful). They should scan the QR code using their 2FA app, and then
use the one-time password it'll generate for them to log in to their account.

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
  }
}
```

## License
![](/public/img/gnu.png)

This is copyleft software under the terms of the GNU AGPL v3.
The images in /public/img/ belong to their respective authors and
are not covered by the AGPL license.
